variable "region" {
  type    = string
  default = "us-east-1"
}
variable "aws_profile" {
  type    = string
  default = "yevhenii"
}
variable "project" {
  type    = string
  default = "onlytools"
}
variable "domain_name" {
  description = "Apex domain; also the hosted zone name."
  type        = string
  default     = "onlytools.click"
}
variable "google_client_id" {
  description = "Google OAuth web client id. Empty = email/password only."
  type        = string
  default     = ""
}
variable "google_client_secret" {
  type      = string
  default   = ""
  sensitive = true
}
variable "google_client_secret_ssm" {
  description = "SSM SecureString holding the Google client secret; overrides google_client_secret when set."
  type        = string
  default     = ""
}
variable "admin_emails" {
  description = "Emails that get platform-admin (and every app role) when their account is created."
  type        = list(string)
  default     = []
}
variable "dev_origins" {
  description = "Local dev origins allowed as OAuth callbacks."
  type        = list(string)
  default     = ["http://localhost:5173"]
}
variable "payments_enabled" {
  description = "Take new Plus payments and donations. Paused by the owner on 2026-11-27 until monobank production works."
  type        = bool
  default     = false
}
variable "budget_name" {
  description = "Existing AWS Budgets budget the dashboard shows (amount, actual, forecast)."
  type        = string
  default     = "Monthly Cost Budget"
}
