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