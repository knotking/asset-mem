# File Search Cloud Function Module
# Handles Gemini File Search processing via Pub/Sub triggers

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

variable "service_account_email" {
  description = "Service account email for Cloud Functions"
  type        = string
}

variable "gcs_bucket" {
  description = "GCS bucket name for file storage"
  type        = string
}

variable "file_search_upload_topic_id" {
  description = "Full resource ID of the file search upload topic"
  type        = string
}

variable "file_search_result_topic_name" {
  description = "Name of the file search result topic"
  type        = string
}

variable "file_search_refresh_topic_id" {
  description = "Full resource ID of the file search refresh topic"
  type        = string
}

variable "gemini_api_key_secret_id" {
  description = "Secret Manager secret ID for Gemini API key"
  type        = string
  default     = "gemini-api-key"
}

# ==================== File Search Upload Function ====================

resource "google_cloudfunctions2_function" "file_search_upload" {
  name     = "file-search-upload-${var.environment}"
  location = var.region
  project  = var.project_id

  build_config {
    runtime     = "python313"
    entry_point = "file_search_upload"

    source {
      storage_source {
        bucket = var.gcs_bucket
        object = "function-source-file-search.zip" # Placeholder, deployed via CI/CD
      }
    }
  }

  service_config {
    max_instance_count               = 10
    max_instance_request_concurrency = 1
    available_memory                 = "1Gi"
    timeout_seconds                  = 540  # 9 minutes for large file processing
    service_account_email            = var.service_account_email

    environment_variables = {
      GCP_PROJECT_ID             = var.project_id
      GCP_REGION                 = var.region
      GCS_BUCKET                 = var.gcs_bucket
      FILE_SEARCH_RESULT_TOPIC   = var.file_search_result_topic_name
    }

    # Mount Gemini API key from Secret Manager
    secret_environment_variables {
      key        = "GEMINI_API_KEY"
      project_id = var.project_id
      secret     = var.gemini_api_key_secret_id
      version    = "latest"
    }
  }

  event_trigger {
    trigger_region        = var.region
    event_type            = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic          = var.file_search_upload_topic_id
    retry_policy          = "RETRY_POLICY_RETRY"
    service_account_email = var.service_account_email
  }

  lifecycle {
    ignore_changes = [
      build_config[0].source,
      build_config[0].docker_repository,
    ]
  }
}

# ==================== File Search Refresh Function ====================

resource "google_cloudfunctions2_function" "file_search_refresh" {
  name     = "file-search-refresh-${var.environment}"
  location = var.region
  project  = var.project_id

  build_config {
    runtime     = "python313"
    entry_point = "file_search_refresh"

    source {
      storage_source {
        bucket = var.gcs_bucket
        object = "function-source-file-search.zip" # Same source as upload function
      }
    }
  }

  service_config {
    max_instance_count               = 5
    max_instance_request_concurrency = 1
    available_memory                 = "1Gi"
    timeout_seconds                  = 540
    service_account_email            = var.service_account_email

    environment_variables = {
      GCP_PROJECT_ID             = var.project_id
      GCP_REGION                 = var.region
      GCS_BUCKET                 = var.gcs_bucket
      FILE_SEARCH_RESULT_TOPIC   = var.file_search_result_topic_name
    }

    # Mount Gemini API key from Secret Manager
    secret_environment_variables {
      key        = "GEMINI_API_KEY"
      project_id = var.project_id
      secret     = var.gemini_api_key_secret_id
      version    = "latest"
    }
  }

  event_trigger {
    trigger_region        = var.region
    event_type            = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic          = var.file_search_refresh_topic_id
    retry_policy          = "RETRY_POLICY_RETRY"
    service_account_email = var.service_account_email
  }

  lifecycle {
    ignore_changes = [
      build_config[0].source,
      build_config[0].docker_repository,
    ]
  }
}

# ==================== Outputs ====================

output "upload_function_name" {
  description = "Name of the file search upload function"
  value       = google_cloudfunctions2_function.file_search_upload.name
}

output "upload_function_uri" {
  description = "URI of the file search upload function"
  value       = google_cloudfunctions2_function.file_search_upload.service_config[0].uri
}

output "refresh_function_name" {
  description = "Name of the file search refresh function"
  value       = google_cloudfunctions2_function.file_search_refresh.name
}

output "refresh_function_uri" {
  description = "URI of the file search refresh function"
  value       = google_cloudfunctions2_function.file_search_refresh.service_config[0].uri
}

