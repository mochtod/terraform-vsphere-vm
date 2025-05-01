variable "netbox_url" {
  description = "The URL of the Netbox instance"
  type        = string
  default     = "https://netbox.chrobinson.com"
}

variable "netbox_token" {
  description = "The API token for Netbox authentication"
  type        = string
  sensitive   = true
}

variable "prefix_id" {
  description = "The ID of the IP prefix in Netbox"
  type        = string
  default     = "1292"
}

variable "vm_hostname" {
  description = "The hostname for the virtual machine"
  type        = string
}

variable "vm_domain" {
  description = "The domain name for the virtual machine"
  type        = string
}
