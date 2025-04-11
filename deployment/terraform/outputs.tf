output "instance_ip" {
  description = "The public IP address of the VM instance"
  value       = google_compute_instance.homegeek_demo.network_interface[0].access_config[0].nat_ip
}

output "instance_name" {
  description = "The name of the VM instance"
  value       = google_compute_instance.homegeek_demo.name
}

output "instance_zone" {
  description = "The zone where the VM instance is running"
  value       = google_compute_instance.homegeek_demo.zone
}