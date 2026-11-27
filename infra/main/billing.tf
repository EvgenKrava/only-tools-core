# Only Tools Plus and donations via monobank internet acquiring (plata by mono).
# One Lambda serves /api/billing/* on the existing HTTP API; a daily schedule renews subscriptions.
# Cost at small scale: Lambda + DynamoDB on-demand + one scheduler run a day = cents per month.
# The monobank token is a SecureString the owner stores by hand (never in Terraform state):
#   aws ssm put-parameter --name /onlytools/payments/mono-token --type SecureString --value <token> --profile yevhenii
# Until it exists, checkout answers 503 "Payments are not set up yet".

locals {
  mono_token_param = "/onlytools/payments/mono-token"
  billing_env = {
    USER_POOL_ID     = aws_cognito_user_pool.main.id
    TABLE_NAME       = aws_dynamodb_table.billing.name
    MONO_TOKEN_PARAM = local.mono_token_param
    PAYMENTS_ENABLED = tostring(var.payments_enabled)
    SITE_URL         = "https://${var.domain_name}"
  }
}

resource "aws_dynamodb_table" "billing" {
  name         = "${var.project}-billing"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"
  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
  # Payments are money records: keep 35 days of restore points (on-demand PITR costs cents here).
  point_in_time_recovery {
    enabled = true
  }
  deletion_protection_enabled = true
}

# Free vs Plus limits, read by FoodLog and CarLog at runtime.
resource "aws_ssm_parameter" "plan_limits" {
  name  = "/${var.project}/plans/limits"
  type  = "String"
  value = jsonencode(jsondecode(file("${path.module}/../../apps/billing/limits.json")))
}

data "archive_file" "billing" {
  type        = "zip"
  source_dir  = "${path.module}/../../apps/billing/dist"
  output_path = "${path.module}/.build/billing.zip"
}

resource "aws_cloudwatch_log_group" "billing" {
  for_each          = toset(["billing", "billing-daily"])
  name              = "/aws/lambda/${var.project}-${each.key}"
  retention_in_days = 30
}

resource "aws_iam_role" "billing" {
  name               = "${var.project}-billing"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "billing" {
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = [for g in aws_cloudwatch_log_group.billing : "${g.arn}:*"]
  }
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query", "dynamodb:Scan"]
    resources = [aws_dynamodb_table.billing.arn]
  }
  statement {
    actions   = ["cognito-idp:AdminAddUserToGroup", "cognito-idp:AdminRemoveUserFromGroup", "cognito-idp:AdminGetUser"]
    resources = [aws_cognito_user_pool.main.arn]
  }
  statement {
    # SecureString with the AWS-managed aws/ssm key: GetParameter is enough.
    actions   = ["ssm:GetParameter"]
    resources = ["arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${local.mono_token_param}"]
  }
}

resource "aws_iam_role_policy" "billing" {
  role   = aws_iam_role.billing.id
  policy = data.aws_iam_policy_document.billing.json
}

resource "aws_lambda_function" "billing" {
  function_name    = "${var.project}-billing"
  role             = aws_iam_role.billing.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.billing.output_path
  source_code_hash = data.archive_file.billing.output_base64sha256
  timeout          = 29
  memory_size      = 256
  environment {
    variables = local.billing_env
  }
  depends_on = [aws_cloudwatch_log_group.billing]
}

resource "aws_lambda_function" "billing_daily" {
  function_name    = "${var.project}-billing-daily"
  role             = aws_iam_role.billing.arn
  handler          = "scheduled.handler"
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.billing.output_path
  source_code_hash = data.archive_file.billing.output_base64sha256
  timeout          = 300
  memory_size      = 256
  environment {
    variables = local.billing_env
  }
  depends_on = [aws_cloudwatch_log_group.billing]
}

resource "aws_apigatewayv2_integration" "billing" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.billing.invoke_arn
  payload_format_version = "2.0"
}

# Public: the pricing page, donations, order status after the redirect, and monobank's webhook (signed).
resource "aws_apigatewayv2_route" "billing_public" {
  for_each  = toset(["GET /api/billing/plans", "POST /api/billing/donate", "GET /api/billing/order/{id}", "POST /api/billing/webhook"])
  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.billing.id}"
}

# Signed in: my subscription, checkout, cancel/resume, admin summary.
resource "aws_apigatewayv2_route" "billing" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "ANY /api/billing/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.billing.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "billing" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.billing.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_iam_role_policy" "scheduler_billing" {
  name = "billing-daily"
  role = aws_iam_role.scheduler.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "lambda:InvokeFunction", Resource = aws_lambda_function.billing_daily.arn }]
  })
}

# 07:00 Kyiv (05:00 UTC in winter): renewals, retries, expiries.
resource "aws_scheduler_schedule" "billing_daily" {
  name                         = "${var.project}-billing-daily"
  schedule_expression          = "cron(0 7 * * ? *)"
  schedule_expression_timezone = "Europe/Kyiv"
  flexible_time_window { mode = "OFF" }
  target {
    arn      = aws_lambda_function.billing_daily.arn
    role_arn = aws_iam_role.scheduler.arn
    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "billing_errors" {
  for_each            = { api = aws_lambda_function.billing.function_name, daily = aws_lambda_function.billing_daily.function_name }
  alarm_name          = "${each.value}-errors"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = each.value }
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
}
