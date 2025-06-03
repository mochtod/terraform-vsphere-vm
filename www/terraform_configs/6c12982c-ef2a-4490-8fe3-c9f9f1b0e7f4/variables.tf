variable "vsphere_user" {
  description = "vSphere username"
  type        = string
}

variable "vsphere_password" {
  description = "vSphere password"
  type        = string
  sensitive   = true
}

variable "vsphere_server" {
  description = "vSphere server address"
  type        = string
}

variable "datacenter" {
  description = "The name of the datacenter"
  type        = string
}

variable "cluster" {
  description = "The name of the cluster"
  type        = string
}

variable "datastore_cluster" {
  description = "The name of the datastore cluster"
  type        = string
}

variable "datastore" {
  description = "The name of the datastore"
  type        = string
  default     = null
}

variable "network" {
  description = "The name of the network"
  type        = string
}

variable "vm_name" {
  description = "The name of the virtual machine"
  type        = string
}

variable "vm_cpu" {
  description = "The number of CPUs for the virtual machine"
  type        = number
}

# Renaming vm_cpu to vm_cpus for consistency with main.tf
variable "vm_cpus" {
  description = "The number of CPUs for the virtual machine"
  type        = number
  default     = null
}

variable "vm_memory" {
  description = "The amount of memory (in MB) for the virtual machine"
  type        = number
  validation {
    condition     = can(regex("^[0-9]+$", var.vm_memory))
    error_message = "The memory value must be a number in MB."
  }
}

variable "vm_disk_size" {
  description = "The size of the virtual machine disk (in GB)"
  type        = number
}

variable "vm_template" {
  description = "The name of the VM template to use"
  type        = string
}

variable "vm_guest_id" {
  description = "The guest OS ID for the virtual machine"
  type        = string
  default     = "rhel9_64Guest" # Default for RHEL 9
}

variable "vm_network_adapter_type" {
  description = "The network adapter type for the virtual machine"
  type        = string
  default     = "vmxnet3"
}

variable "vm_hostname" {
  description = "The hostname for the virtual machine"
  type        = string
  default     = null
}

variable "vm_domain" {
  description = "The domain name for the virtual machine"
  type        = string
  default     = "local"
}

variable "vm_ipv4_address" {
  description = "The IPv4 address for the virtual machine"
  type        = string
  default     = null
}

variable "vm_ipv4_netmask" {
  description = "The IPv4 netmask for the virtual machine (as integer, e.g. 24)"
  type        = number
  default     = 24
}

variable "vm_ipv4_gateway" {
  description = "The IPv4 gateway for the virtual machine"
  type        = string
  default     = null
}

variable "template_name" {
  description = "The name of the VM template to use"
  type        = string
  default     = null
}

variable "additional_disks" {
  description = "List of additional data disks (in GB) to attach to the VM. Does not include the system/root disk."
  type        = list(number)
  default     = []
  validation {
    condition     = (length(var.additional_disks) == 0 ? 0 : sum(var.additional_disks)) <= 1536
    error_message = "The total size of all additional disks must not exceed 1536 GB (1.5TB)."
  }
}

# Netbox variables
variable "netbox_url" {
  description = "Netbox API URL"
  type        = string
  default     = ""
}

variable "netbox_token" {
  description = "Netbox API token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "netbox_prefix_id" {
  description = "Netbox prefix ID for IP allocation"
  type        = string
  default     = ""
}

variable "vm_host_group" {
  description = "The host group for CHR (Satellite) registration"
  type        = string
  default     = ""
}

variable "chr_api_server" {
  description = "The CHR API server URL for registration"
  type        = string
  default     = "https://satellite.chrobinson.com"
}

variable "satellite_username" {
  description = "Username for CHR Satellite API authentication"
  type        = string
  default     = "chradmin"
}

variable "satellite_password" {
  description = "Password for CHR Satellite API authentication"
  type        = string
  default     = "C9msV+s3"
  sensitive   = true
}

variable "ssh_password" {
  description = "SSH password for post-deployment provisioning (template default password)"
  type        = string
  default     = "C9msV+s3"
  sensitive   = true
}

variable "ssh_user" {
  description = "SSH user for post-deployment provisioning"
  type        = string
  default     = "root"
}
