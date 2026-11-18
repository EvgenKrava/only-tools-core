output "web_bucket" { value = aws_s3_bucket.web.bucket }
output "cloudfront_distribution_id" { value = aws_cloudfront_distribution.web.id }
output "site_url" { value = "https://${var.domain_name}" }
output "user_pool_id" { value = aws_cognito_user_pool.main.id }
output "core_client_id" { value = aws_cognito_user_pool_client.core.id }
output "auth_domain" { value = local.auth_domain }
