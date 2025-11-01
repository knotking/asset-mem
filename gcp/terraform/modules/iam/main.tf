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

variable "github_repository" {
  description = "GitHub repository in format owner/repo"
  type        = string
  default     = "your-org/HomeApp"
}

# Service Account for GitHub Actions Deployment
resource "google_service_account" "github_deployment" {
  account_id   = "githubworkflowdeployment"
  display_name = "GitHub Workflow Deployment Service Account"
  description  = "Service account used by GitHub Actions for deploying services"
  project      = var.project_id
}

# IAM roles for the deployment service account
resource "google_project_iam_member" "deployment_roles" {
  for_each = toset([
    "roles/run.developer",
    "roles/artifactregistry.writer",
    "roles/cloudbuild.builds.editor",
    "roles/serviceusage.serviceUsageConsumer",
    "roles/iam.serviceAccountUser",
    "roles/artifactregistry.repoAdmin",
    "roles/storage.admin",
    "roles/pubsub.editor",
    "roles/aiplatform.user",
    "roles/cloudfunctions.developer",
    "roles/run.admin",
    "roles/secretmanager.secretAccessor"
  ])

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.github_deployment.email}"
}

# Workload Identity Pool for GitHub Actions
resource "google_iam_workload_identity_pool" "github_pool" {
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Workload Identity Pool for GitHub Actions"
  project                   = var.project_id
}

resource "google_iam_workload_identity_pool_provider" "github_provider" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_pool.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Provider"
  description                        = "OIDC identity pool provider for GitHub"
  project                            = var.project_id

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# IAM binding for GitHub Actions to impersonate the service account
resource "google_service_account_iam_member" "github_workload_identity" {
  service_account_id = google_service_account.github_deployment.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_pool.name}/attribute.repository/${var.github_repository}"
}

# Service Account for RAG Engine
resource "google_project_service_identity" "aiplatform_rag" {
  provider = google-beta
  project  = var.project_id
  service  = "aiplatform.googleapis.com"
}

# Grant RAG service account access to storage
resource "google_project_iam_member" "rag_storage_access" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-vertex-rag.iam.gserviceaccount.com"
}

data "google_project" "project" {
  project_id = var.project_id
}

output "deployment_service_account_email" {
  description = "Email of the deployment service account"
  value       = google_service_account.github_deployment.email
}

output "workload_identity_provider" {
  description = "Workload Identity Provider resource name"
  value       = google_iam_workload_identity_pool_provider.github_provider.name
}
