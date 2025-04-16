# Terraform Configuration for HomeAMA Deployment

This document provides an overview of the resources managed by Terraform for deploying the HomeAMA project on Google Cloud Platform (GCP).

---

## Prerequisites

1. **Terraform**:
   - Ensure Terraform is installed on your system. The required version is `1.9.0`.
   - Download Terraform from [terraform.io](https://www.terraform.io/downloads).

2. **Google Cloud SDK**:
   - Install and configure the Google Cloud SDK. You can download it from [cloud.google.com](https://cloud.google.com/sdk/docs/install).

3. **GCP Project**:
   - Ensure you have a GCP project with the necessary APIs enabled:
     - Compute Engine API
     - Cloud Storage API

4. **Static IP Address**:
   - Create a static IP address in your GCP project and ensure its name matches the `var.environment` variable.

---

## Resources Managed by Terraform

### 1. **Google Compute Instance**
- **Resource**: `google_compute_instance`
- **Purpose**: Creates a virtual machine (VM) instance to host the HomeAMA application.
- **Key Attributes**:
  - **Name**: The name of the instance is defined by `var.instance_name`.
  - **Machine Type**: The machine type is specified by `var.machine_type` (e.g., `e2-medium`).
  - **Boot Disk**: The VM uses an image defined by `var.image_project` and `var.image_family`.
  - **Network Interface**:
    - Attaches the VM to the default network.
    - Assigns a static external IP address (`data.google_compute_address.static_ip.address`).
  - **Startup Script**:
    - Executes the `startup.sh` script located in the `./scripts` directory.
    - Passes the `var.environment` variable as metadata.
  - **Service Account**:
    - Uses the service account specified by `var.service_account_email`.
    - Grants the VM access to the `cloud-platform` scope.

---

### 2. **Google Compute Firewall Rules**
- **Resource**: `google_compute_firewall`
- **Purpose**: Configures firewall rules to allow incoming traffic on specified ports.
- **Key Attributes**:
  - **Name**: Dynamically generated as `allow-port-{port}` for each port in `var.exposed_ports`.
  - **Protocol**: Allows TCP traffic.
  - **Ports**: Opens the ports specified in `var.exposed_ports`.
  - **Target Tags**: Applies the rules to instances with the tags defined in `var.tags`.
  - **Source Ranges**: Allows traffic from all IP addresses (`0.0.0.0/0`).
  - **Direction**: Configured as `INGRESS` to allow incoming traffic.

---

### 3. **Google Compute Address**
- **Resource**: `data.google_compute_address`
- **Purpose**: Fetches the details of a pre-existing static IP address in the specified region.
- **Key Attributes**:
  - **Name**: Matches the `var.environment` variable.
  - **Region**: Defined by `var.region`.

---

## Variables

The following variables are used in the Terraform configuration:

| Variable Name             | Description                                                                 |
|---------------------------|-----------------------------------------------------------------------------|
| `project_id`              | The GCP project ID.                                                        |
| `region`                  | The region where resources will be deployed (e.g., `us-central1`).         |
| `zone`                    | The zone where the VM instance will be created (e.g., `us-central1-a`).    |
| `environment`             | The environment name (e.g., `demo`, `staging`, `prod`).                    |
| `instance_name`           | The name of the VM instance.                                               |
| `machine_type`            | The machine type for the VM (e.g., `e2-standard-2`).                           |
| `image_project`           | The project containing the VM image.                                       |
| `image_family`            | The family of the VM image (e.g., `ubuntu-os-cloud`).                            |
| `service_account_email`   | The email of the service account used by the VM.                           |
| `tags`                    | Network tags applied to the VM for firewall rules.                         |
| `exposed_ports`           | A list of ports to expose via firewall rules (e.g., `[80, 443]`).    |

---

## How to Use

1. **Initialize Terraform**:
   Run the following command to initialize the Terraform working directory:
   ```bash
   terraform init
   ```

2. **Generate a Terraform Plan**:
   Create a plan to preview the changes Terraform will make:
   ```bash
   terraform plan -out=tfplan
   ```

3. **Apply the Terraform Plan**:
   Execute the plan to deploy the resources:
   ```bash
   terraform apply tfplan
   ```

4. **Destroy Resources**:
   To delete all resources managed by Terraform, run:
   ```bash
   terraform destroy
   ```

---

## Notes

- Ensure that the `startup.sh` script in the `./scripts` directory is correctly configured for initializing the VM.
- The static IP address must already exist in your GCP project before running Terraform.
- Use the `terraform plan` command to review changes before applying them to avoid unintended modifications.

For further assistance, refer to the [Terraform Documentation](https://www.terraform.io/docs) or the [Google Cloud Documentation](https://cloud.google.com/docs).