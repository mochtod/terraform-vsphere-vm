# Product Context

## Why This Project Exists
TerraSphere is a web-based interface for provisioning and managing virtual machines in a vSphere environment using Terraform. It exists to simplify the VM creation process by providing a user-friendly web interface instead of requiring users to write Terraform code directly.

## Problems It Solves
- Eliminates the need for users to learn Terraform syntax and commands
- Standardizes VM provisioning across the organization
- Provides a centralized management interface for all VMs
- Integrates with external systems like Netbox for IP allocation and Ansible Automation Platform for post-deployment configuration
- Offers visual workflow for VM configuration, planning, and deployment
- Maintains deployment history and workspace management

## How It Should Work
1. Users access a web interface to create VM workspaces
2. They select infrastructure components (datacenter, cluster, datastore cluster, network)
3. They configure VM specifications (CPU, memory, disk, OS, etc.)
4. The system generates Terraform plans and allows users to review before applying
5. Upon approval, the system executes Terraform to provision the VM in vSphere
6. Users can manage, monitor, and customize deployed VMs
7. The system maintains workspace state for future modifications or deletions
