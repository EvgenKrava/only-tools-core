# Admin dashboard: daily snapshot of cost, users and activity; AWS budget with email alerts.
locals {
  api_env = {
    USER_POOL_ID = aws_cognito_user_pool.main.id
    TABLE_NAME   = aws_dynamodb_table.admin.name
    BUDGET_NAME  = var.budget_name
    ACCOUNT_ID   = data.aws_caller_identity.current.account_id
  }
}

resource "aws_dynamodb_table" "admin" {
  name         = "${var.project}-admin"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  attribute {
    name = "pk"
    type = "S"
  }
}

resource "aws_cloudwatch_log_group" "stats" {
  name              = "/aws/lambda/${var.project}-stats"
  retention_in_days = 14
}

resource "aws_lambda_function" "stats" {
  function_name    = "${var.project}-stats"
  role             = aws_iam_role.api.arn
  handler          = "scheduled.handler"
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.api.output_path
  source_code_hash = data.archive_file.api.output_base64sha256
  timeout          = 60
  memory_size      = 512
  environment {
    variables = local.api_env
  }
  depends_on = [aws_cloudwatch_log_group.stats]
}

data "aws_iam_policy_document" "stats_logs" {
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.stats.arn}:*"]
  }
}

resource "aws_iam_role_policy" "stats_logs" {
  name   = "stats-logs"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.stats_logs.json
}

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${var.project}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

resource "aws_iam_role_policy" "scheduler" {
  role = aws_iam_role.scheduler.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "lambda:InvokeFunction", Resource = aws_lambda_function.stats.arn }]
  })
}

# Once a day; Cost Explorer data itself only updates a few times a day.
resource "aws_scheduler_schedule" "stats" {
  name                = "${var.project}-stats-daily"
  schedule_expression = "cron(0 6 * * ? *)"
  flexible_time_window { mode = "OFF" }
  target {
    arn      = aws_lambda_function.stats.arn
    role_arn = aws_iam_role.scheduler.arn
  }
}

# Cost allocation tags so Cost Explorer can split spend by app.
resource "aws_ce_cost_allocation_tag" "app" {
  for_each = toset(["Project", "aws:cloudformation:stack-name"])
  tag_key  = each.key
  status   = "Active"
}

# The account already has a "Monthly Cost Budget" ($20, alerts at 85%/100% actual and 100% forecast).
# A third paid budget would cost $0.62/month, so the dashboard reads that one instead of creating another.
