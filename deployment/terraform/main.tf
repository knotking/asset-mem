provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# VM Instance
resource "google_compute_instance" "homegeek_demo" {
  name         = var.instance_name
  machine_type = var.machine_type
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = "${var.image_project}/${var.image_family}"
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  tags = [var.tags]

  #startup script
  metadata = {
    startup-script = file("./scripts/startup.sh")
  }

  service_account {
    email  = var.service_account_email
    scopes = ["cloud-platform"]
  }
}

# Firewall Rules
resource "google_compute_firewall" "allow_ports" {
  for_each = toset([for port in var.exposed_ports : tostring(port)])

  name    = "allow-port-${each.value}"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = [each.value]
  }

  target_tags = [var.tags]
  direction   = "INGRESS"
  priority    = 1000
  source_ranges = ["0.0.0.0/0"]
}

