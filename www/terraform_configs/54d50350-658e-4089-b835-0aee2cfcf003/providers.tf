provider "vsphere" {
  user           = var.vsphere_user
  password       = var.vsphere_password
  vsphere_server = replace(var.vsphere_server, "https://", "")

  # If you have a self-signed cert
  allow_unverified_ssl = true
  
  # Enable debug logging for troubleshooting
  client_debug = true
}

terraform {
  required_providers {
    vsphere = {
      source  = "hashicorp/vsphere"
      version = "~> 2.0"
    }
  }

  required_version = ">= 0.12"
}
