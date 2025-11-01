# Backend configuration for Terraform state
# This should be customized per environment

# Uncomment and configure for remote state storage
# terraform {
#   backend "gcs" {
#     bucket = "homeapp-terraform-state"
#     prefix = "terraform/state"
#   }
# }

# For local development, comment out the backend block above
# and use local state storage
