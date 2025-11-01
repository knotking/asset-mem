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
