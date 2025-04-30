# The proper format for a .tfvars file is key = value pairs (without the 'variable' keyword)
vm_name = "lin2dv2terraform"
vsphere_user = "chr\\mochtodpa"
# vsphere_password should be set as an environment variable TF_VAR_vsphere_password for security
vsphere_server = "virtualcenter.chrobinson.com"
datacenter = "EBDC NONPROD"
cluster = "np-cl60-lin"  # Corrected cluster parameter
datastore_cluster = "np-cl60-dsc"  # Changed from datastore to datastore_cluster to match variable in main.tf
network = "np-lin-vds-989-linux"
vm_template = "rhel9-template0314"
vm_cpu = 4
vm_cpus = 4
vm_memory = 32768  # Memory in MB (32GB)
vm_disk_size = 100  # Disk size in GB
vm_guest_id = "rhel9_64Guest"
vm_network_adapter_type = "vmxnet3"
# Remove the hardcoded password from here and use environment variables or a secure vault instead
