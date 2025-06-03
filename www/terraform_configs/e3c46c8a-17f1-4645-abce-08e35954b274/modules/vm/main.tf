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

  # Post-deployment provisioner to register with CHR (Satellite)
  provisioner "remote-exec" {
    inline = [
      "echo 'Starting post-deployment provisioning...'",
      "sleep 30",
      "echo 'System ready for CHR registration'",
      
      # Only proceed if host group is specified
      "if [ ! -z '${var.vm_host_group}' ]; then",
      "  echo 'Installing jq if not present...'",
      "  if ! command -v jq &> /dev/null; then",
      "    if command -v yum &> /dev/null; then",
      "      sudo yum install -y jq",
      "    elif command -v apt-get &> /dev/null; then",
      "      sudo apt-get update && sudo apt-get install -y jq",
      "    fi",
      "  fi",
      
      "  echo 'Configuring DNS and network resolution for CHR registration...'",
      "  sudo cp /etc/resolv.conf /etc/resolv.conf.backup.$(date +%s)",
      
      "  echo 'Adding CHR corporate DNS servers...'",
      "  {",
      "    echo 'nameserver ${var.dns_servers[0]}'",
      "    echo 'nameserver ${var.dns_servers[1]}'", 
      "    echo 'search ${var.dns_domain}'",
      "  } | sudo tee /etc/resolv.conf > /dev/null",
      
      "  CHR_URL='${var.chr_api_server}'",
      "  CHR_HOSTNAME=$(echo \"$CHR_URL\" | sed 's|https\\?://||' | sed 's|/.*||' | sed 's|:.*||')",
      "  CHR_IP='${var.chr_satellite_ip}'",
      
      "  echo \"CHR hostname: $CHR_HOSTNAME\"",
      "  echo \"CHR IP fallback: $CHR_IP\"",
      
      "  if ! grep -q \"$CHR_HOSTNAME\" /etc/hosts; then",
      "    echo \"Adding $CHR_HOSTNAME to /etc/hosts...\"",
      "    echo \"$CHR_IP $CHR_HOSTNAME\" | sudo tee -a /etc/hosts",
      "  fi",
      
      "  echo 'Testing connectivity to CHR satellite...'",
      "  if ping -c 2 $CHR_IP > /dev/null 2>&1; then",
      "    echo 'Network connectivity to CHR satellite: OK'",
      "  else",
      "    echo 'Warning: Cannot ping CHR satellite, but proceeding with registration attempt'",
      "  fi",
      
      "  if nslookup $CHR_HOSTNAME > /dev/null 2>&1; then",
      "    echo 'DNS resolution for CHR hostname: OK'",
      "  else",
      "    echo 'DNS resolution failed, relying on /etc/hosts entry'",
      "  fi",
      
      "  echo 'Starting CHR registration process...'",
      "  echo 'Host group: ${var.vm_host_group}'",
      "  echo 'CHR API Server: ${var.chr_api_server}'",
      "  echo 'Using authentication: Username=${var.chr_username}, Password=********'",
      
      "  RETRY_COUNT=0",
      "  MAX_RETRIES=3",
      "  REGISTRATION_SUCCESS=false",
      
      "  while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ \"$REGISTRATION_SUCCESS\" = \"false\" ]; do",
      "    echo \"CHR registration attempt $((RETRY_COUNT + 1)) of $MAX_RETRIES...\"",
      
      "    echo 'Requesting registration command from CHR API...'",
      "    REGISTRATION_CMD=$(curl -sS \\",
      "      --connect-timeout 30 \\", 
      "      --max-time 120 \\",
      "      --insecure \\",
      "      --resolve \"$CHR_HOSTNAME:443:$CHR_IP\" \\",
      "      --resolve \"$CHR_HOSTNAME:80:$CHR_IP\" \\",
      "      -u \"${var.chr_username}:${var.chr_password}\" \\",
      "      -X POST \\",
      "      '${var.chr_api_server}/chr/register' \\",
      "      -H 'Content-Type: application/json' \\",
      "      -d '{\"hostgroup_name\": \"${var.vm_host_group}\", \"auto_run\": false}' \\",
      "      | jq -r '.registration_command' 2>/dev/null)",
      
      "    if [ \"$REGISTRATION_CMD\" != \"null\" ] && [ ! -z \"$REGISTRATION_CMD\" ] && [ \"$REGISTRATION_CMD\" != \"\" ]; then",
      "      echo 'Registration command received from CHR API'",
      "      echo 'Executing CHR registration command...'",
      
      "      if timeout 300 bash -c \"$REGISTRATION_CMD\"; then",
      "        echo 'CHR registration completed successfully!'",
      "        REGISTRATION_SUCCESS=true",
      
      "        echo 'Verifying registration status...'",
      "        if command -v subscription-manager &> /dev/null; then",
      "          subscription-manager status || echo 'Registration verification completed'",
      "        fi",
      "      else",
      "        echo 'Registration command execution failed or timed out'",
      "      fi",
      "    else",
      "      echo 'Failed to retrieve valid registration command from CHR API'",
      "      echo 'API Response: '\"$REGISTRATION_CMD\"",
      
      "      echo 'Testing direct connectivity to CHR API...'",
      "      echo 'Sending API status request to ${var.chr_api_server}/api/status'",
      "      API_STATUS=$(curl -sS --connect-timeout 10 --max-time 30 --insecure \\",
      "        --resolve \"$CHR_HOSTNAME:443:$CHR_IP\" \\",
      "        -u \"${var.chr_username}:${var.chr_password}\" \\",
      "        '${var.chr_api_server}/api/status')",
      "      echo \"API Status Response: $API_STATUS\"",
      "      if [ -z \"$API_STATUS\" ]; then",
      "        echo 'API connectivity test failed - empty response'",
      "      elif echo \"$API_STATUS\" | grep -q '404'; then",
      "        echo 'API connectivity test failed - 404 Not Found'",
      "        echo 'Check API endpoint path: ${var.chr_api_server}/api/status'",
      "      elif echo \"$API_STATUS\" | grep -q 'Unauthorized'; then",
      "        echo 'API connectivity test failed - Authentication failed'",
      "        echo 'Check username and password credentials'",
      "      else",
      "        echo 'API connectivity test completed'",
      "      fi",
      "    fi",
      
      "    if [ \"$REGISTRATION_SUCCESS\" = \"false\" ]; then",
      "      RETRY_COUNT=$((RETRY_COUNT + 1))",
      "      if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then",
      "        echo \"Waiting 30 seconds before retry attempt $((RETRY_COUNT + 1))...\"",
      "        sleep 30",
      "      fi",
      "    fi",
      "  done",
      
      "  if [ \"$REGISTRATION_SUCCESS\" = \"true\" ]; then",
      "    echo 'CHR registration process completed successfully!'",
      "    echo 'VM is now registered with CHR Satellite and ready for management'",
      "  else",
      "    echo 'CHR registration failed after $MAX_RETRIES attempts'",
      "    echo 'VM deployment completed, but CHR registration was unsuccessful'",
      "    echo 'Manual registration may be required - contact system administrator'",
      "    echo 'VM is functional but not managed by CHR Satellite'",
      "    logger \"CHR registration failed for VM: $(hostname)\"",
      "  fi",
      "else",
      "  echo 'No host group specified - skipping CHR registration'",
      "  echo 'VM deployment completed without CHR integration'",
      "fi"
    ]

    connection {
      type        = "ssh"
      user        = var.ssh_user
      host        = var.ipv4_address
      password    = var.ssh_password
      timeout     = "10m"
    }
  }
}
