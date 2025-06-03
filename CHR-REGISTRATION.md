# CHR (Satellite) Registration Feature

## Overview
This Terraform configuration now includes automatic registration of newly deployed VMs with CHR (Red Hat Satellite) for centralized management, updates, and repository access.

## How It Works

### 1. Host Group Variable
- Added `vm_host_group` variable to specify the CHR host group
- Examples: `"Server_Storage_Tech/Development"`, `"App_Hosting_Global/Production"`
- This value is used in the CHR registration API call

### 2. Post-Deployment Registration
After VM deployment, a remote-exec provisioner automatically:
1. Waits for the system to be ready (30 seconds)
2. Makes an API call to the CHR registration endpoint
3. Executes the returned registration command
4. Completes the satellite registration process

### 3. Configuration Variables

#### Required Variables
```hcl
vm_host_group = "Server_Storage_Tech/Development"
```

#### Optional Configuration Variables
```hcl
chr_api_server = "https://10.69.184.144/api/v2"  # CHR API server IP (avoids DNS issues)
ssh_user = "root"                                           # SSH user for provisioning
ssh_password = "C9msV+s3"                                   # Template default password
```

## Usage

### In tfvars file
```hcl
# Required for CHR registration
vm_host_group = "Server_Storage_Tech/Development"

# Optional customizations
chr_api_server = "https://10.69.184.144/api/v2"
ssh_user = "root"
ssh_password = "C9msV+s3"
```

### Command Line
```bash
terraform apply -var="vm_host_group=Server_Storage_Tech/Development"
```

## Registration Process

The registration executes this command on the newly deployed VM:
```bash
eval $(curl -sS -X POST https://10.69.184.144/api/v2/chr/register \
  -H "Content-Type: application/json" \
  -d '{"hostgroup_name": "Server_Storage_Tech/Development", "auto_run": false}' | jq -r '.registration_command')
```

## Benefits

1. **Automated Management**: VMs are automatically registered with Satellite
2. **Repository Access**: Proper repo management and package updates
3. **Compliance**: Ensures all VMs follow organizational standards
4. **Monitoring**: Centralized monitoring and reporting through Satellite

## Prerequisites

1. **SSH Access**: Terraform must have SSH access to the deployed VM
2. **Template Password**: Uses the standard template password (C9msV+s3) for initial SSH connection
3. **CHR API**: The CHR API server must be accessible from the VM
4. **Network Connectivity**: VM must be able to reach the CHR/Satellite server

## Troubleshooting

### Skip Registration
If you need to deploy without CHR registration, leave `vm_host_group` empty:
```hcl
vm_host_group = ""
```

### SSH Connection Issues
- Verify the template password is correct (default: C9msV+s3)
- Ensure the VM has SSH service running
- Check network connectivity between Terraform host and VM
- Verify the SSH user exists on the template (default: root)

### CHR API Issues
- Verify CHR API server URL is correct
- Check if the host group name exists in CHR
- Ensure the API endpoint is accessible from the VM

## Example Complete Configuration

```hcl
# terraform.tfvars
vsphere_server = "virtualcenter.example.com"
vsphere_user = "domain\\service_account"
datacenter = "EBDC NONPROD"
cluster = "np-cl60-lin"
datastore_cluster = "np-cl70-dsc"
network = "np-lin-vds-989-linux"
vm_name = "lin2dv2test01"
vm_template = "rhel9-template0314"
vm_host_group = "Server_Storage_Tech/Development"
vm_guest_id = "rhel9_64Guest"
vm_cpu = "4"
vm_memory = "32768"
vm_disk_size = "100"
vm_network_adapter_type = "vmxnet3"

# CHR Configuration (optional)
chr_api_server = "https://10.69.184.144/api/v2"
ssh_user = "root"
ssh_password = "C9msV+s3"
```

## Integration with Web Interface

The web interface at `http://localhost:3000` now includes:
- Host group selection dropdown
- Automatic population of `vm_host_group` in generated tfvars files
- Preview of CHR registration that will occur post-deployment
