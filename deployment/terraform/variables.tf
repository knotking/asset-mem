variable "project_id" {
  description = "The GCP project ID"
  default     = "homegeekdemo"
}

variable "region" {
  description = "The GCP region"
  default     = "us-central1"
}

variable "zone" {
  description = "The GCP zone"
  default     = "us-central1-a"
}

variable "instance_name" {
  description = "The name of the VM instance"
  default     = "homegeekdemo"
}

variable "machine_type" {
  description = "The machine type"
  default     = "e2-medium"
}

variable "image_family" {
  description = "The OS image family"
  default     = "ubuntu-2204-lts"
}

variable "image_project" {
  description = "The project containing the OS image"
  default     = "ubuntu-os-cloud"
}

variable "tags" {
  description = "Network tags"
  default     = "homegeek-demo"
}

variable "exposed_ports" {
  description = "Ports to expose"
  type        = list(number)
  default     = [5678, 5432, 6333, 8000]
}

variable "service_account_email" {
  description = "Service account email"
  default     = "321433914812-compute@developer.gserviceaccount.com"
}

variable "gcs_bucket_name" {
  description = "GCS bucket name for backups"
  default     = "homegeekdemo"
}

variable "static_ip" {
  description = "The static IP address to assign to the VM instance"
  default     = "demo"
}