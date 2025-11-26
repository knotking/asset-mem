variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment (staging or prod)"
  type        = string
}

# User upload topic
resource "google_pubsub_topic" "user_upload" {
  name    = "user-upload-topic-${var.environment}"
  project = var.project_id

  message_retention_duration = "604800s" # 7 days
}

# User upload subscription
resource "google_pubsub_subscription" "user_upload" {
  name    = "user-upload-subscription-${var.environment}"
  topic   = google_pubsub_topic.user_upload.name
  project = var.project_id

  message_retention_duration = "604800s"
  retain_acked_messages      = false
  ack_deadline_seconds       = 60

  expiration_policy {
    ttl = "" # Never expire
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}

# User upload result topic
resource "google_pubsub_topic" "user_upload_result" {
  name    = "user-upload-result-topic-${var.environment}"
  project = var.project_id

  message_retention_duration = "604800s" # 7 days
}

# User upload result subscription
resource "google_pubsub_subscription" "user_upload_result" {
  name    = "user-upload-result-subscription-${var.environment}"
  topic   = google_pubsub_topic.user_upload_result.name
  project = var.project_id

  message_retention_duration = "604800s"
  retain_acked_messages      = false
  ack_deadline_seconds       = 60

  expiration_policy {
    ttl = "" # Never expire
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}

output "user_upload_topic_name" {
  description = "Name of the user upload topic"
  value       = google_pubsub_topic.user_upload.name
}

output "user_upload_topic_id" {
  description = "Full resource ID of the user upload topic"
  value       = google_pubsub_topic.user_upload.id
}

output "user_upload_result_topic_name" {
  description = "Name of the user upload result topic"
  value       = google_pubsub_topic.user_upload_result.name
}

output "user_upload_result_topic_id" {
  description = "Full resource ID of the user upload result topic"
  value       = google_pubsub_topic.user_upload_result.id
}

# ==================== Gemini File Search Topics ====================

# File search upload topic - triggers file processing
resource "google_pubsub_topic" "file_search_upload" {
  name    = "file-search-upload-topic-${var.environment}"
  project = var.project_id

  message_retention_duration = "604800s" # 7 days
}

# File search upload subscription
resource "google_pubsub_subscription" "file_search_upload" {
  name    = "file-search-upload-subscription-${var.environment}"
  topic   = google_pubsub_topic.file_search_upload.name
  project = var.project_id

  message_retention_duration = "604800s"
  retain_acked_messages      = false
  ack_deadline_seconds       = 300  # 5 minutes for file processing

  expiration_policy {
    ttl = "" # Never expire
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}

# File search result topic - notifies completion
resource "google_pubsub_topic" "file_search_result" {
  name    = "file-search-result-topic-${var.environment}"
  project = var.project_id

  message_retention_duration = "604800s" # 7 days
}

# File search result subscription
resource "google_pubsub_subscription" "file_search_result" {
  name    = "file-search-result-subscription-${var.environment}"
  topic   = google_pubsub_topic.file_search_result.name
  project = var.project_id

  message_retention_duration = "604800s"
  retain_acked_messages      = false
  ack_deadline_seconds       = 60

  expiration_policy {
    ttl = "" # Never expire
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}

# File refresh topic - triggers re-upload of expiring files
resource "google_pubsub_topic" "file_search_refresh" {
  name    = "file-search-refresh-topic-${var.environment}"
  project = var.project_id

  message_retention_duration = "604800s" # 7 days
}

# File refresh subscription
resource "google_pubsub_subscription" "file_search_refresh" {
  name    = "file-search-refresh-subscription-${var.environment}"
  topic   = google_pubsub_topic.file_search_refresh.name
  project = var.project_id

  message_retention_duration = "604800s"
  retain_acked_messages      = false
  ack_deadline_seconds       = 300

  expiration_policy {
    ttl = "" # Never expire
  }

  retry_policy {
    minimum_backoff = "60s"
    maximum_backoff = "3600s"
  }
}

# Cloud Scheduler job to trigger file refresh every 6 hours
resource "google_cloud_scheduler_job" "file_refresh_scheduler" {
  name        = "file-search-refresh-scheduler-${var.environment}"
  project     = var.project_id
  region      = "us-central1"
  description = "Triggers refresh of expiring Gemini files every 6 hours"
  schedule    = "0 */6 * * *"  # Every 6 hours
  time_zone   = "UTC"

  pubsub_target {
    topic_name = google_pubsub_topic.file_search_refresh.id
    data       = base64encode("{\"action\": \"refresh_expiring_files\", \"hours_before_expiry\": 6}")
  }
}

output "file_search_upload_topic_name" {
  description = "Name of the file search upload topic"
  value       = google_pubsub_topic.file_search_upload.name
}

output "file_search_upload_topic_id" {
  description = "Full resource ID of the file search upload topic"
  value       = google_pubsub_topic.file_search_upload.id
}

output "file_search_result_topic_name" {
  description = "Name of the file search result topic"
  value       = google_pubsub_topic.file_search_result.name
}

output "file_search_result_topic_id" {
  description = "Full resource ID of the file search result topic"
  value       = google_pubsub_topic.file_search_result.id
}

output "file_search_refresh_topic_name" {
  description = "Name of the file search refresh topic"
  value       = google_pubsub_topic.file_search_refresh.name
}

output "file_search_refresh_topic_id" {
  description = "Full resource ID of the file search refresh topic"
  value       = google_pubsub_topic.file_search_refresh.id
}
