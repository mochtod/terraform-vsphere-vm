# Main Terraform configuration file
# The provider configuration has been moved to providers.tf

data "vsphere_datacenter" "dc" {
  name = var.datacenter
}

data "vsphere_datastore_cluster" "datastore_cluster" {
  name          = var.datastore_cluster
  datacenter_id = data.vsphere_datacenter.dc.id
}

# Get the first datastore from the datastore cluster
data "vsphere_datastore" "datastore" {
  name          = var.datastore
  datacenter_id = data.vsphere_datacenter.dc.id
  count         = var.datastore != null ? 1 : 0
}

# Comment: The vsphere_datastores data source doesn't exist, we'll use a different approach
# Instead, we'll rely on the datastore_cluster resource directly

data "vsphere_compute_cluster" "cluster" {
  name          = var.cluster
  datacenter_id = data.vsphere_datacenter.dc.id
}

data "vsphere_network" "network" {
  name          = var.network
  datacenter_id = data.vsphere_datacenter.dc.id
}

data "vsphere_virtual_machine" "template" {
  name          = var.vm_template
  datacenter_id = data.vsphere_datacenter.dc.id
}

module "netbox_ip" {
  source = "./modules/netbox"

  netbox_token = "b714a966995e1eaf8b8ff919ebac3867321d50da"
  vm_hostname  = var.vm_hostname != null ? var.vm_hostname : var.vm_name
  vm_domain    = var.vm_domain
}

module "vm" {
  source = "./modules/vm"

  vm_name             = var.vm_name
  resource_pool_id    = data.vsphere_compute_cluster.cluster.resource_pool_id
  # Using datastore_cluster_id instead of datastore_id for proper datastore cluster handling
  datastore_cluster_id = data.vsphere_datastore_cluster.datastore_cluster.id
  datastore_id        = null  # Set to null when using datastore_cluster_id
  
  num_cpus            = var.vm_cpus != null ? var.vm_cpus : var.vm_cpu
  memory              = var.vm_memory
  guest_id            = var.vm_guest_id
  
  network_id          = data.vsphere_network.network.id
  adapter_type        = var.vm_network_adapter_type
  
  disk_size           = var.vm_disk_size
  
  template_uuid       = data.vsphere_virtual_machine.template.id
  
  vm_hostname         = var.vm_hostname != null ? var.vm_hostname : var.vm_name
  vm_domain           = var.vm_domain
  ipv4_address        = module.netbox_ip.ipv4_address
  ipv4_netmask        = module.netbox_ip.ipv4_netmask
  ipv4_gateway        = module.netbox_ip.ipv4_gateway
  additional_disks    = var.additional_disks
}
