output "ipv4_address" {
  description = "The IPv4 address assigned from Netbox"
  value       = local.ip_address
}

output "ipv4_netmask" {
  description = "The IPv4 netmask assigned from Netbox"
  value       = local.netmask
}

output "ipv4_gateway" {
  description = "The IPv4 gateway calculated for the assigned address"
  value       = local.gateway
}
