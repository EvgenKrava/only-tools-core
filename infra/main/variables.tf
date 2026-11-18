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
