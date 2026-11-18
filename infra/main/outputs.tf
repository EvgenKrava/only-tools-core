output "web_bucket" { value = aws_s3_bucket.web.bucket }
output "cloudfront_distribution_id" { value = aws_cloudfront_distribution.web.id }
output "site_url" { value = "https://${var.domain_name}" }
