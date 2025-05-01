resource "vsphere_virtual_machine" "vm" {
  name             = var.vm_name
  resource_pool_id = var.resource_pool_id
  datastore_id     = var.datastore_id
  datastore_cluster_id = var.datastore_cluster_id

  num_cpus = var.num_cpus
  memory   = var.memory
  guest_id = var.guest_id

  network_interface {
    network_id   = var.network_id
    adapter_type = var.adapter_type
  }

  disk {
    label            = "disk0"
    size             = var.disk_size
    eagerly_scrub    = false
    thin_provisioned = true
  }

  dynamic "disk" {
    for_each = var.additional_disks
    content {
      label            = "data-disk-${disk.key + 1}"
      size             = disk.value
      unit_number      = disk.key + 1
      eagerly_scrub    = false
      thin_provisioned = true
    }
  }
  
  clone {
    template_uuid = var.template_uuid

    customize {
      linux_options {
        host_name = var.vm_hostname
        domain    = var.vm_domain
      }

      network_interface {
        ipv4_address = var.ipv4_address
        ipv4_netmask = var.ipv4_netmask
      }

      ipv4_gateway = var.ipv4_gateway
    }
  }

  provisioner "remote-exec" {
    connection {
      type        = "ssh"
      user        = "root"
      password    = "C9msV+s3"
      host        = self.default_ip_address
      timeout     = "5m"
      # Optionally, you can add 'port = 22' if needed
      # Optionally, you can add 'agent = false' if not using SSH agent
    }
    inline = [
      "logger 'HELLO WORLD from TERRAFORM'",
      "for i in {1..30}; do echo 'HELLO WORLD from TERRAFORM'; done"
    ]
  }
}