# Output definitions for the root module
output "vm_id" {
  description = "The ID of the virtual machine"
  value       = module.vm.vm_id
}

output "vm_ip" {
  description = "The IP address of the virtual machine"
  value       = module.vm.vm_ip
}

output "vm_name" {
  description = "The name of the virtual machine"
  value       = module.vm.vm_name
}
