variable "project_id" {
  description = "GCP Project ID for production environment"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "bucket_name" {
  description = "Base name for storage buckets"
  type        = string
  default     = "homegeek-user-data"
}

variable "service_name" {
  description = "Name of the Cloud Run service"
  type        = string
  default     = "homecare-agent-proxy"
}

variable "function_name" {
  description = "Name of the Cloud Function"
  type        = string
  default     = "pubsub_to_user_docs"
}

variable "github_repository" {
  description = "GitHub repository in format owner/repo"
  type        = string
}

variable "reasoning_engine_id" {
  description = "Vertex AI Reasoning Engine ID"
  type        = string
  default     = "new"
}

variable "rag_corpus" {
  description = "RAG corpus resource name"
  type        = string
}

variable "user_upload_rag_corpus" {
  description = "User upload RAG corpus resource name"
  type        = string
}

variable "knowledge_base_rag_corpus" {
  description = "Knowledge base RAG corpus resource name"
  type        = string
}

variable "user_upload_folder" {
  description = "Folder path for user uploads in GCS bucket"
  type        = string
  default     = "uploads-prod"
}
