variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment (staging or prod)"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

# Secret definitions
locals {
  secrets = [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBHOOK_SECRET",
    "FIREBASE_WEBHOOK_SECRET",
    "SERP_API_KEY",
    "YELP_API_KEY"
  ]
}

# Create secrets in Secret Manager
resource "google_secret_manager_secret" "secrets" {
  for_each = toset(local.secrets)

  secret_id = "${each.key}-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
  }
}

# Note: Secret values must be added manually via console or gcloud
# Example:
# echo -n "your-secret-value" | gcloud secrets versions add TELEGRAM_BOT_TOKEN-staging --data-file=-

output "secret_ids" {
  description = "Map of secret IDs"
  value = {
    for k, v in google_secret_manager_secret.secrets : k => v.id
  }
}

output "secret_names" {
  description = "List of secret names"
  value       = [for s in google_secret_manager_secret.secrets : s.name]
}
