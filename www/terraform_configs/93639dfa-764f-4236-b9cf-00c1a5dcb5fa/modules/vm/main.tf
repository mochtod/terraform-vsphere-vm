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
  }  # Post-deployment provisioner to register with CHR (Satellite)
  provisioner "remote-exec" {
    inline = [
      "# Wait for system to be ready",
      "sleep 30",
      "# Register to CHR (on-premise) - using the selected host group",
      "if [ ! -z '${var.vm_host_group}' ]; then",
      "  echo 'Registering host with CHR using host group: ${var.vm_host_group}'",
      "  eval $(curl -sS -X POST ${var.chr_api_server}/chr/register \\",
      "    -H \"Content-Type: application/json\" \\",
      "    -d '{\"hostgroup_name\": \"${var.vm_host_group}\", \"auto_run\": false}' | jq -r '.registration_command')",      "  echo 'CHR registration completed'",
      "else",
      "  echo 'No host group specified, skipping CHR registration'",
      "fi"
    ]

    connection {
      type        = "ssh"
      user        = var.ssh_user
      host        = var.ipv4_address
      password    = var.ssh_password
      timeout     = "5m"
    }
  }
}