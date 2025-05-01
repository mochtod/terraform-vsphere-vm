# Netbox IP Address Management Module

terraform {
  required_providers {
    http = {
      source  = "hashicorp/http"
      version = "~> 3.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

# Get available IPs from the specified prefix
data "http" "available_ips" {
  url = "${var.netbox_url}/api/ipam/prefixes/${var.prefix_id}/available-ips/"
  
  method = "GET"
  
  request_headers = {
    Authorization = "Token ${var.netbox_token}"
    Accept        = "application/json"
  }
  
  # Skip TLS certificate validation
  insecure = true
}

# Since the HTTP provider doesn't support resource blocks, 
# we'll use a null_resource with a local-exec provisioner
# to create the IP address in Netbox when needed
resource "null_resource" "create_ip" {
  triggers = {
    # This ensures the resource is recreated if any of these values change
    netbox_url    = var.netbox_url
    prefix_id     = var.prefix_id
    vm_hostname   = var.vm_hostname
    vm_domain     = var.vm_domain
  }  # Use a local-exec provisioner with curl to create the IP address
  # This will run during the apply phase
  provisioner "local-exec" {
    # Use bash for cross-platform compatibility with WSL/Git Bash on Windows
    command = "bash -c \"curl -k -X POST '${var.netbox_url}/api/ipam/ip-addresses/' -H 'Authorization: Token ${var.netbox_token}' -H 'Content-Type: application/json' -H 'Accept: application/json' -d '{\\\"address\\\": \\\"${local.ip_data.address}\\\", \\\"status\\\": \\\"active\\\", \\\"dns_name\\\": \\\"${var.vm_hostname}.${var.vm_domain}\\\", \\\"description\\\": \\\"Created by Terraform\\\"}'\"" 
  }

  # Ensure this resource is created after we've obtained an available IP
  depends_on = [data.http.available_ips]
}

# Extract IP components from the obtained IP address
locals {
  ip_data       = jsondecode(data.http.available_ips.response_body)[0]
  ip_address    = split("/", local.ip_data.address)[0]
  netmask       = split("/", local.ip_data.address)[1]
  gateway       = cidrhost("${local.ip_address}/${local.netmask}", 1)
}
