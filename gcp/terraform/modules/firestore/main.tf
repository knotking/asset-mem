# Firestore Module for Gemini File Search Metadata
# Stores file metadata for user-uploaded documents with user_id, datetime (UTC), and file search references

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

# Enable Firestore API
resource "google_project_service" "firestore" {
  project            = var.project_id
  service            = "firestore.googleapis.com"
  disable_on_destroy = false
}

# Firestore Database (Native mode)
resource "google_firestore_database" "file_search" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.firestore]

  # Prevent accidental deletion
  deletion_policy = "DELETE"
}

# Firestore Index for user files - query by user_id and created_at
resource "google_firestore_index" "user_files_by_date" {
  project    = var.project_id
  database   = google_firestore_database.file_search.name
  collection = "gemini_files"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }

  depends_on = [google_firestore_database.file_search]
}

# Firestore Index for user files - query by user_id and property_id
resource "google_firestore_index" "user_files_by_property" {
  project    = var.project_id
  database   = google_firestore_database.file_search.name
  collection = "gemini_files"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "property_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }

  depends_on = [google_firestore_database.file_search]
}

# Firestore Index for file search stores - query by user_id
resource "google_firestore_index" "file_search_stores_by_user" {
  project    = var.project_id
  database   = google_firestore_database.file_search.name
  collection = "file_search_stores"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }

  depends_on = [google_firestore_database.file_search]
}

# Firestore Index for file search stores - query by property_id
resource "google_firestore_index" "file_search_stores_by_property" {
  project    = var.project_id
  database   = google_firestore_database.file_search.name
  collection = "file_search_stores"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "property_id"
    order      = "ASCENDING"
  }

  depends_on = [google_firestore_database.file_search]
}

# TTL policy for temporary files (auto-cleanup after 90 days)
resource "google_firestore_field" "files_ttl" {
  project    = var.project_id
  database   = google_firestore_database.file_search.name
  collection = "gemini_files"
  field      = "expires_at"

  ttl_config {}

  depends_on = [google_firestore_database.file_search]
}

output "database_name" {
  description = "Firestore database name"
  value       = google_firestore_database.file_search.name
}

output "database_id" {
  description = "Firestore database ID"
  value       = google_firestore_database.file_search.id
}

