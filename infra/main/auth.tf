# OnlyTools account: one Cognito user pool shared by every app, managed login on auth.onlytools.click.
locals {
  auth_domain = "auth.${var.domain_name}"
  apps        = ["carlog", "gighunter", "foodlog"]
  # Roles are Cognito groups; they show up in tokens as cognito:groups.
  groups = merge(
    { "platform-admin" = "Opens the Only Tools admin panel; manages every user, role and app setting." },
    { for a in local.apps : "${a}-user" => "May use ${a}." },
    { for a in local.apps : "${a}-admin" => "Moderation inside ${a}." },
  )
  default_groups = ["carlog-user", "foodlog-user"] # GigHunter is invite-only
  admin_groups   = ["platform-admin", "carlog-user", "gighunter-user", "foodlog-user", "carlog-admin", "gighunter-admin", "foodlog-admin"]
  trigger_names  = ["pre-sign-up", "post-confirmation"]
}

resource "aws_cognito_user_pool" "main" {
  name                     = var.project
  user_pool_tier           = "ESSENTIALS" # managed login with branding; free up to 10,000 MAU
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  deletion_protection      = "ACTIVE"

  username_configuration { case_sensitive = false }

  password_policy {
    minimum_length                   = 10
    require_lowercase                = false
    require_uppercase                = false
    require_numbers                  = false
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    string_attribute_constraints {
      min_length = 3
      max_length = 256
    }
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  email_configuration { email_sending_account = "COGNITO_DEFAULT" }

  admin_create_user_config {
    allow_admin_create_user_only = false
    invite_message_template {
      email_subject = "Your Only Tools invite"
      email_message = "You're invited to Only Tools. Sign in at https://onlytools.click with {username}. Temporary password: {####}"
      sms_message   = "Only Tools: {username} / {####}"
    }
  }

  lambda_config {
    pre_sign_up       = aws_lambda_function.trigger["pre-sign-up"].arn
    post_confirmation = aws_lambda_function.trigger["post-confirmation"].arn
  }
}

resource "aws_cognito_user_group" "role" {
  for_each     = local.groups
  user_pool_id = aws_cognito_user_pool.main.id
  name         = each.key
  description  = each.value
}

# The Google client secret lives in SSM (SecureString), put there by the owner; never in git.
data "aws_ssm_parameter" "google_secret" {
  count = var.google_client_secret_ssm == "" ? 0 : 1
  name  = var.google_client_secret_ssm
}

resource "aws_cognito_identity_provider" "google" {
  count         = var.google_client_id == "" ? 0 : 1
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"
  provider_details = {
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret_ssm == "" ? var.google_client_secret : data.aws_ssm_parameter.google_secret[0].value
    authorize_scopes = "openid email profile"
  }
  attribute_mapping = {
    email          = "email"
    email_verified = "email_verified"
    username       = "sub"
    name           = "name"
    picture        = "picture"
  }
  # Cognito fills in Google's endpoints itself; ignoring them avoids a permanent diff.
  lifecycle { ignore_changes = [provider_details["attributes_url"], provider_details["attributes_url_add_attributes"], provider_details["authorize_url"], provider_details["oidc_issuer"], provider_details["token_request_method"], provider_details["token_url"]] }
}

# ---- custom domain auth.onlytools.click ----
resource "aws_acm_certificate" "auth" {
  domain_name       = local.auth_domain
  validation_method = "DNS"
  lifecycle { create_before_destroy = true }
}

resource "aws_route53_record" "auth_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.auth.domain_validation_options : dvo.domain_name => {
      name = dvo.resource_record_name, record = dvo.resource_record_value, type = dvo.resource_record_type
    }
  }
  zone_id         = data.aws_route53_zone.main.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "auth" {
  certificate_arn         = aws_acm_certificate.auth.arn
  validation_record_fqdns = [for r in aws_route53_record.auth_cert_validation : r.fqdn]
}

resource "aws_cognito_user_pool_domain" "auth" {
  domain                = local.auth_domain
  user_pool_id          = aws_cognito_user_pool.main.id
  certificate_arn       = aws_acm_certificate_validation.auth.certificate_arn
  managed_login_version = 2
  # Cognito needs the parent domain to resolve; the landing's apex A record provides it.
  depends_on = [aws_route53_record.web]
}

resource "aws_route53_record" "auth" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.auth_domain
  type    = "A"
  alias {
    name                   = aws_cognito_user_pool_domain.auth.cloudfront_distribution
    zone_id                = aws_cognito_user_pool_domain.auth.cloudfront_distribution_zone_id
    evaluate_target_health = false
  }
}

# ---- app clients: core (landing + admin) and one per app that has moved to the shared sign-in ----
locals {
  app_clients = {
    gighunter = { urls = ["https://gighunter.${var.domain_name}"], callback_path = "/login" }
    carlog    = { urls = ["https://carlog.${var.domain_name}"], callback_path = "/callback" }
    foodlog   = { urls = ["https://foodlog.${var.domain_name}"], callback_path = "/callback" }
  }
}

resource "aws_cognito_user_pool_client" "app" {
  for_each                             = local.app_clients
  name                                 = each.key
  user_pool_id                         = aws_cognito_user_pool.main.id
  generate_secret                      = false
  supported_identity_providers         = concat(["COGNITO"], var.google_client_id == "" ? [] : ["Google"])
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  callback_urls                        = [for o in concat(each.value.urls, var.dev_origins) : "${o}${each.value.callback_path}"]
  logout_urls                          = concat([for o in each.value.urls : "${o}/"], ["https://${var.domain_name}/"], [for o in var.dev_origins : "${o}/"])
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
  access_token_validity                = 1
  id_token_validity                    = 1
  refresh_token_validity               = 30
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
  depends_on = [aws_cognito_identity_provider.google]
}

resource "aws_cognito_managed_login_branding" "app" {
  for_each                    = local.app_clients
  user_pool_id                = aws_cognito_user_pool.main.id
  client_id                   = aws_cognito_user_pool_client.app[each.key].id
  use_cognito_provided_values = true
}

resource "aws_ssm_parameter" "app_client" {
  for_each = local.app_clients
  name     = "/onlytools/auth/clients/${each.key}"
  type     = "String"
  value    = aws_cognito_user_pool_client.app[each.key].id
}

resource "aws_cognito_user_pool_client" "core" {
  name                                 = "core"
  user_pool_id                         = aws_cognito_user_pool.main.id
  generate_secret                      = false
  supported_identity_providers         = concat(["COGNITO"], var.google_client_id == "" ? [] : ["Google"])
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  callback_urls                        = concat(["https://${var.domain_name}/auth/callback"], [for o in var.dev_origins : "${o}/auth/callback"])
  logout_urls                          = concat(["https://${var.domain_name}/"], [for o in var.dev_origins : "${o}/"])
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
  access_token_validity                = 1
  id_token_validity                    = 1
  refresh_token_validity               = 30
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
  depends_on = [aws_cognito_identity_provider.google]
}

resource "aws_cognito_managed_login_branding" "core" {
  user_pool_id                = aws_cognito_user_pool.main.id
  client_id                   = aws_cognito_user_pool_client.core.id
  use_cognito_provided_values = true
}

# ---- triggers ----
data "archive_file" "trigger" {
  for_each    = toset(local.trigger_names)
  type        = "zip"
  source_file = "${path.module}/../../apps/auth-triggers/${each.key}.mjs"
  output_path = "${path.module}/.build/${each.key}.zip"
}

resource "aws_cloudwatch_log_group" "trigger" {
  for_each          = toset(local.trigger_names)
  name              = "/aws/lambda/${var.project}-${each.key}"
  retention_in_days = 14
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "trigger" {
  name               = "${var.project}-auth-triggers"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "trigger" {
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = [for g in aws_cloudwatch_log_group.trigger : "${g.arn}:*"]
  }
  statement {
    actions   = ["cognito-idp:ListUsers", "cognito-idp:AdminLinkProviderForUser", "cognito-idp:AdminAddUserToGroup"]
    resources = ["arn:aws:cognito-idp:${var.region}:${data.aws_caller_identity.current.account_id}:userpool/*"]
  }
}

resource "aws_iam_role_policy" "trigger" {
  role   = aws_iam_role.trigger.id
  policy = data.aws_iam_policy_document.trigger.json
}

resource "aws_lambda_function" "trigger" {
  for_each         = toset(local.trigger_names)
  function_name    = "${var.project}-${each.key}"
  role             = aws_iam_role.trigger.arn
  handler          = "${each.key}.handler"
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.trigger[each.key].output_path
  source_code_hash = data.archive_file.trigger[each.key].output_base64sha256
  timeout          = 10
  memory_size      = 256
  environment {
    variables = {
      DEFAULT_GROUPS = join(",", local.default_groups)
      ADMIN_GROUPS   = join(",", local.admin_groups)
      ADMIN_EMAILS   = join(",", var.admin_emails)
    }
  }
  depends_on = [aws_cloudwatch_log_group.trigger]
}

resource "aws_lambda_permission" "trigger" {
  for_each      = toset(local.trigger_names)
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.trigger[each.key].function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

# ---- values other repos read ----
resource "aws_ssm_parameter" "auth" {
  for_each = {
    "user-pool-id"  = aws_cognito_user_pool.main.id
    "user-pool-arn" = aws_cognito_user_pool.main.arn
    "issuer"        = "https://${aws_cognito_user_pool.main.endpoint}"
    "domain"        = local.auth_domain
    "clients/core"  = aws_cognito_user_pool_client.core.id
  }
  name  = "/onlytools/auth/${each.key}"
  type  = "String"
  value = each.value
}
