variable "vm_name" {
  description = "The name of the virtual machine"
  type        = string
}

variable "resource_pool_id" {
  description = "The resource pool ID to use for the virtual machine"
  type        = string
}

variable "datastore_id" {
  description = "The datastore ID to use for the virtual machine"
  type        = string
  default     = null
}

variable "datastore_cluster_id" {
  description = "The datastore cluster ID to use for the virtual machine (alternative to datastore_id)"
  type        = string
  default     = null
}

variable "network_id" {
  description = "The network ID for the virtual machine"
  type        = string
}

variable "adapter_type" {
  description = "The network adapter type for the virtual machine"
  type        = string
  default     = "vmxnet3"
}

variable "num_cpus" {
  description = "The number of CPUs for the virtual machine"
  type        = number
}

variable "memory" {
  description = "The amount of memory (in MB) for the virtual machine"
  type        = number
}

variable "disk_size" {
  description = "The size of the disk (in GB) for the virtual machine"
  type        = number
}

variable "guest_id" {
  description = "The guest operating system identifier"
  type        = string
}

variable "template_uuid" {
  description = "The UUID of the template to clone from"
  type        = string
}

variable "vm_hostname" {
  description = "The hostname for the virtual machine"
  type        = string
}

variable "vm_domain" {
  description = "The domain name for the virtual machine"
  type        = string
  default     = "local"
}

variable "ipv4_address" {
  description = "The IPv4 address for the virtual machine"
  type        = string
}

variable "ipv4_netmask" {
  description = "The IPv4 netmask for the virtual machine (as integer, e.g. 24)"
  type        = number
  default     = 24
}

variable "ipv4_gateway" {
  description = "The IPv4 gateway for the virtual machine"
  type        = string
}

variable "additional_disks" {
  description = "List of additional data disks (in GB) to attach to the VM. Does not include the system/root disk."
  type        = list(number)
  default     = []
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

variable "dns_servers" {
  description = "List of DNS servers for the VM"
  type        = list(string)
  default     = ["10.69.8.15", "10.69.8.16"]
}

variable "dns_domain" {
  description = "DNS domain for the VM"
  type        = string
  default     = "chrobinson.com"
}

variable "chr_satellite_ip" {
  description = "Fallback IP address for CHR Satellite server"
  type        = string
  default     = "10.69.184.144"
}

variable "chr_username" {
  description = "Username for CHR Satellite API authentication"
  type        = string
  default     = "chradmin"
}

variable "chr_password" {
  description = "Password for CHR Satellite API authentication"
  type        = string
  default     = "C9msV+s3"
  sensitive   = true
}
