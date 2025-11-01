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

variable "service_name" {
  description = "Name of the Cloud Run service"
  type        = string
  default     = "homecare-agent-proxy"
}

variable "service_account_email" {
  description = "Service account email for Cloud Run"
  type        = string
}

variable "gcs_bucket" {
  description = "GCS bucket name"
  type        = string
}

variable "user_upload_topic" {
  description = "Pub/Sub topic for user uploads"
  type        = string
}

variable "user_upload_result_subscription" {
  description = "Pub/Sub subscription for upload results"
  type        = string
}

variable "reasoning_engine_id" {
  description = "Vertex AI Reasoning Engine ID"
  type        = string
  default     = "new"
}

# Note: Cloud Run service is typically deployed via GitHub Actions
# This resource creates a placeholder that can be managed by Terraform
# Actual deployment happens through the GitHub Actions workflow

# Cloud Run service (placeholder/import existing)
# To import existing service:
# terraform import module.cloud_run.google_cloud_run_service.proxy projects/<project-id>/locations/<region>/services/<service-name>

resource "google_cloud_run_service" "proxy" {
  name     = "${var.service_name}-${var.environment}"
  location = var.region
  project  = var.project_id

  template {
    spec {
      service_account_name = var.service_account_email

      containers {
        image = "us-docker.pkg.dev/cloudrun/container/hello" # Placeholder, actual image deployed by GitHub Actions

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "GCP_REGION"
          value = var.region
        }

        env {
          name  = "REASONING_ENGINE_ID"
          value = var.reasoning_engine_id
        }

        env {
          name  = "USER_UPLOAD_TOPIC"
          value = var.user_upload_topic
        }

        env {
          name  = "USER_UPLOAD_RESULT_SUBSCRIPTION"
          value = var.user_upload_result_subscription
        }

        env {
          name  = "GCS_BUCKET"
          value = var.gcs_bucket
        }

        # Secrets from Secret Manager
        dynamic "env" {
          for_each = toset([
            "TELEGRAM_BOT_TOKEN",
            "TELEGRAM_WEBHOOK_SECRET",
            "FIREBASE_WEBHOOK_SECRET"
          ])
          content {
            name = env.value
            value_from {
              secret_key_ref {
                name = "${env.value}-${var.environment}"
                key  = "latest"
              }
            }
          }
        }

        resources {
          limits = {
            cpu    = "1000m"
            memory = "512Mi"
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = "0"
        "autoscaling.knative.dev/maxScale" = "10"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  lifecycle {
    ignore_changes = [
      template[0].spec[0].containers[0].image, # Ignore image changes (managed by GitHub Actions)
      template[0].metadata[0].annotations["client.knative.dev/user-image"],
      template[0].metadata[0].annotations["run.googleapis.com/client-name"],
      template[0].metadata[0].annotations["run.googleapis.com/client-version"],
    ]
  }
}

# Allow unauthenticated access
resource "google_cloud_run_service_iam_member" "public_access" {
  service  = google_cloud_run_service.proxy.name
  location = google_cloud_run_service.proxy.location
  project  = google_cloud_run_service.proxy.project
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "service_url" {
  description = "URL of the Cloud Run service"
  value       = google_cloud_run_service.proxy.status[0].url
}

output "service_name" {
  description = "Name of the Cloud Run service"
  value       = google_cloud_run_service.proxy.name
}
