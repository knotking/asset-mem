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

variable "function_name" {
  description = "Name of the Cloud Function"
  type        = string
  default     = "pubsub_to_user_docs"
}

variable "service_account_email" {
  description = "Service account email for Cloud Function"
  type        = string
}

variable "trigger_topic" {
  description = "Pub/Sub topic that triggers the function"
  type        = string
}

variable "gcs_bucket" {
  description = "GCS bucket name"
  type        = string
}

variable "user_upload_result_topic_path" {
  description = "Full path to user upload result topic"
  type        = string
}

variable "rag_corpus" {
  description = "RAG corpus resource name"
  type        = string
}

variable "user_upload_folder" {
  description = "Folder path for user uploads in GCS bucket"
  type        = string
  default     = "uploads"
}

# Note: Similar to Cloud Run, the actual function code is deployed via GitHub Actions
# This creates the infrastructure that the deployment uses

# Cloud Function (Gen2)
# To import existing function:
# terraform import module.cloud_function.google_cloudfunctions2_function.worker projects/<project-id>/locations/<region>/functions/<function-name>

resource "google_cloudfunctions2_function" "worker" {
  name     = "${var.function_name}-${var.environment}"
  location = var.region
  project  = var.project_id

  build_config {
    runtime     = "python313"
    entry_point = var.function_name

    source {
      storage_source {
        bucket = var.gcs_bucket
        object = "function-source.zip" # Placeholder, actual source deployed by GitHub Actions
      }
    }
  }

  service_config {
    max_instance_count               = 1
    max_instance_request_concurrency = 1
    available_memory                 = "512Mi"
    timeout_seconds                  = 540
    service_account_email            = var.service_account_email

    environment_variables = {
      GCP_PROJECT_ID             = var.project_id
      GCP_REGION                 = var.region
      GCS_BUCKET                 = var.gcs_bucket
      USER_UPLOAD_RESULT_TOPIC   = var.user_upload_result_topic_path
      RAG_CORPUS                 = var.rag_corpus
      USER_UPLOAD_FOLDER         = var.user_upload_folder
    }
  }

  event_trigger {
    trigger_region        = var.region
    event_type            = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic          = var.trigger_topic
    retry_policy          = "RETRY_POLICY_RETRY"
    service_account_email = var.service_account_email
  }

  lifecycle {
    ignore_changes = [
      build_config[0].source, # Ignore source changes (managed by GitHub Actions)
      build_config[0].docker_repository,
    ]
  }
}

output "function_name" {
  description = "Name of the Cloud Function"
  value       = google_cloudfunctions2_function.worker.name
}

output "function_uri" {
  description = "URI of the Cloud Function"
  value       = google_cloudfunctions2_function.worker.service_config[0].uri
}
