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

variable "bucket_name" {
  description = "Base name for the storage bucket"
  type        = string
  default     = "homegeek-user-data"
}

# Main storage bucket for user data
resource "google_storage_bucket" "user_data" {
  name          = "${var.bucket_name}-${var.environment}"
  location      = var.region
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

# Bucket for agent staging (catalog)
resource "google_storage_bucket" "agent_catalog" {
  name          = "homegeek-catalog"
  location      = var.region
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true
}

# Terraform state bucket (if using GCS backend)
resource "google_storage_bucket" "terraform_state" {
  name          = "${var.project_id}-terraform-state"
  location      = var.region
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }
}

output "user_data_bucket_name" {
  description = "Name of the user data bucket"
  value       = google_storage_bucket.user_data.name
}

output "user_data_bucket_url" {
  description = "URL of the user data bucket"
  value       = google_storage_bucket.user_data.url
}

output "agent_catalog_bucket_name" {
  description = "Name of the agent catalog bucket"
  value       = google_storage_bucket.agent_catalog.name
}
