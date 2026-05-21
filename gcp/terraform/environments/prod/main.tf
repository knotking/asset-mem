# Production Environment Configuration

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }

  # Uncomment to use GCS backend for state storage
  # backend "gcs" {
  #   bucket = "homegeek-staging-terraform-state"
  #   prefix = "terraform/prod/state"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "aiplatform.googleapis.com",
    "pubsub.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudfunctions.googleapis.com",
    "eventarc.googleapis.com",
  ])

  project                    = var.project_id
  service                    = each.key
  disable_on_destroy         = false
  disable_dependent_services = false
}

# IAM Module - Service Accounts and Workload Identity
module "iam" {
  source = "../../modules/iam"

  project_id        = var.project_id
  environment       = var.environment
  region            = var.region
  github_repository = var.github_repository

  depends_on = [google_project_service.required_apis]
}

# Storage Module - GCS Buckets
module "storage" {
  source = "../../modules/storage"

  project_id  = var.project_id
  environment = var.environment
  region      = var.region
  bucket_name = var.bucket_name

  depends_on = [google_project_service.required_apis]
}

# Pub/Sub Module - Topics and Subscriptions
module "pubsub" {
  source = "../../modules/pubsub"

  project_id  = var.project_id
  environment = var.environment

  depends_on = [google_project_service.required_apis]
}

# Secrets Module - Secret Manager
module "secrets" {
  source = "../../modules/secrets"

  project_id  = var.project_id
  environment = var.environment
  region      = var.region

  depends_on = [google_project_service.required_apis]
}

# Cloud Run Module - API Service
module "cloud_run" {
  source = "../../modules/cloud-run"

  project_id                       = var.project_id
  environment                      = var.environment
  region                           = var.region
  service_name                     = var.service_name
  service_account_email            = module.iam.deployment_service_account_email
  gcs_bucket                       = module.storage.user_data_bucket_name
  user_upload_topic                = module.pubsub.user_upload_topic_name
  user_upload_result_subscription  = module.pubsub.user_upload_result_topic_name
  reasoning_engine_id              = var.reasoning_engine_id

  depends_on = [
    module.iam,
    module.storage,
    module.pubsub,
    module.secrets
  ]
}

# Cloud Function Module - Worker Function
module "cloud_function" {
  source = "../../modules/cloud-function"

  project_id                      = var.project_id
  environment                     = var.environment
  region                          = var.region
  function_name                   = var.function_name
  service_account_email           = module.iam.deployment_service_account_email
  trigger_topic                   = module.pubsub.user_upload_topic_id
  gcs_bucket                      = module.storage.user_data_bucket_name
  user_upload_result_topic_path   = module.pubsub.user_upload_result_topic_id
  rag_corpus                      = var.rag_corpus
  user_upload_folder              = var.user_upload_folder

  depends_on = [
    module.iam,
    module.storage,
    module.pubsub
  ]
}

# Outputs
output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "deployment_service_account" {
  description = "Deployment service account email"
  value       = module.iam.deployment_service_account_email
}

output "workload_identity_provider" {
  description = "Workload Identity Provider for GitHub Actions"
  value       = module.iam.workload_identity_provider
}

output "cloud_run_url" {
  description = "Cloud Run service URL"
  value       = module.cloud_run.service_url
}

output "user_data_bucket" {
  description = "User data GCS bucket name"
  value       = module.storage.user_data_bucket_name
}

output "pubsub_topics" {
  description = "Pub/Sub topic names"
  value = {
    user_upload        = module.pubsub.user_upload_topic_name
    user_upload_result = module.pubsub.user_upload_result_topic_name
  }
}
