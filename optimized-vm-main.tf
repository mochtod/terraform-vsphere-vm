# Optimized CHR Registration Configuration
# This file demonstrates production-ready timeout and retry optimizations

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

  # OPTIMIZED: Reduced timeout for credential file (lightweight operation)
  provisioner "file" {
    content     = "CHR_USERNAME=${var.chr_username}\nCHR_PASSWORD=${var.chr_password}"
    destination = "/tmp/chr_credentials.env"
    
    connection {
      type        = "ssh"
      user        = var.ssh_user
      host        = var.ipv4_address
      password    = var.ssh_password
      timeout     = "3m"  # OPTIMIZED: Reduced from 5m to 3m
    }
  }
  
  provisioner "remote-exec" {
    inline = [
      "echo 'Starting post-deployment provisioning...'",
      "echo 'Creating log directory and files...'",
      "mkdir -p /var/log/chr_registration",
      "touch /var/log/chr_registration/main.log",
      "chmod 755 /var/log/chr_registration/main.log",
      "echo \"$(date '+%Y-%m-%d %H:%M:%S') - Starting CHR registration process\" > /var/log/chr_registration/main.log",
      "sleep 30",
      "echo 'System ready for CHR registration' | tee -a /var/log/chr_registration/main.log",
      
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
      
      "  echo \"CHR hostname: $CHR_HOSTNAME\" | tee -a /var/log/chr_registration/main.log",
      "  echo \"CHR IP fallback: $CHR_IP\" | tee -a /var/log/chr_registration/main.log",
      
      "  if ! grep -q \"$CHR_HOSTNAME\" /etc/hosts; then",
      "    echo \"Adding $CHR_HOSTNAME to /etc/hosts...\" | tee -a /var/log/chr_registration/main.log",
      "    echo \"$CHR_IP $CHR_HOSTNAME\" | sudo tee -a /etc/hosts",
      "  fi",
      
      # OPTIMIZED: Enhanced network quality assessment
      "  echo '=== NETWORK QUALITY ASSESSMENT ===' | tee -a /var/log/chr_registration/main.log",
      "  PING_RESULT=$(ping -c 3 $CHR_IP 2>/dev/null | grep 'avg' | cut -d'/' -f5 2>/dev/null || echo '0')",
      "  PING_TIME=$(echo $PING_RESULT | cut -d'.' -f1)",
      "  echo \"Average ping time: ${PING_TIME}ms\" | tee -a /var/log/chr_registration/main.log",
      
      # OPTIMIZED: Dynamic timeout adjustment based on network conditions
      "  if [ \"$PING_TIME\" -gt 100 ]; then",
      "    TIMEOUT_MULTIPLIER=2",
      "    echo 'High latency detected - increasing timeouts' | tee -a /var/log/chr_registration/main.log",
      "  elif [ \"$PING_TIME\" -gt 50 ]; then",
      "    TIMEOUT_MULTIPLIER=1.5",
      "    echo 'Moderate latency detected - slightly increasing timeouts' | tee -a /var/log/chr_registration/main.log",
      "  else",
      "    TIMEOUT_MULTIPLIER=1",
      "    echo 'Good network conditions detected' | tee -a /var/log/chr_registration/main.log",
      "  fi",
      
      # OPTIMIZED: Calculate dynamic timeouts
      "  CONNECT_TIMEOUT=$(echo \"45 * $TIMEOUT_MULTIPLIER\" | bc 2>/dev/null || echo 45)",
      "  MAX_TIMEOUT=$(echo \"180 * $TIMEOUT_MULTIPLIER\" | bc 2>/dev/null || echo 180)",
      "  REG_TIMEOUT=$(echo \"420 * $TIMEOUT_MULTIPLIER\" | bc 2>/dev/null || echo 420)",
      
      "  echo \"Using dynamic timeouts - Connect: ${CONNECT_TIMEOUT}s, Max: ${MAX_TIMEOUT}s, Registration: ${REG_TIMEOUT}s\" | tee -a /var/log/chr_registration/main.log",
      
      "  echo 'Testing connectivity to CHR satellite...' | tee -a /var/log/chr_registration/main.log",
      "  if ping -c 2 $CHR_IP > /dev/null 2>&1; then",
      "    echo 'Network connectivity to CHR satellite: OK' | tee -a /var/log/chr_registration/main.log",
      "  else",
      "    echo 'Warning: Cannot ping CHR satellite, but proceeding with registration attempt' | tee -a /var/log/chr_registration/main.log",
      "  fi",
      
      "  if nslookup $CHR_HOSTNAME > /dev/null 2>&1; then",
      "    echo 'DNS resolution for CHR hostname: OK' | tee -a /var/log/chr_registration/main.log",
      "  else",
      "    echo 'DNS resolution failed, relying on /etc/hosts entry' | tee -a /var/log/chr_registration/main.log",
      "  fi",
      
      # OPTIMIZED: Enhanced HTTP connectivity test with dynamic timeout
      "  echo 'Testing HTTP connectivity to CHR satellite...' | tee -a /var/log/chr_registration/main.log",
      "  CURL_TEST=$(curl -s -o /dev/null -w '%%{http_code}' --connect-timeout $CONNECT_TIMEOUT --max-time $MAX_TIMEOUT --insecure \"${var.chr_api_server}\")",
      "  if [ \"$CURL_TEST\" -ge 200 ] && [ \"$CURL_TEST\" -lt 600 ]; then",
      "    echo \"HTTP connectivity to CHR satellite: OK (Status code: $CURL_TEST)\" | tee -a /var/log/chr_registration/main.log",
      "  else",
      "    echo \"Warning: HTTP connectivity test failed (Status code: $CURL_TEST)\" | tee -a /var/log/chr_registration/main.log",
      "    echo \"Attempting to diagnose connectivity issues...\" | tee -a /var/log/chr_registration/main.log",
      "    traceroute $CHR_HOSTNAME 2>&1 | head -10 | tee -a /var/log/chr_registration/main.log || echo \"Traceroute not available\" | tee -a /var/log/chr_registration/main.log",
      "  fi",
      
      "  echo '======================================================' | tee -a /var/log/chr_registration/main.log",
      "  echo '===== STARTING CHR REGISTRATION PROCESS ==============' | tee -a /var/log/chr_registration/main.log",
      "  echo '======================================================' | tee -a /var/log/chr_registration/main.log",
      "  echo 'Host group: ${var.vm_host_group}' | tee -a /var/log/chr_registration/main.log",
      "  echo 'CHR API Server: ${var.chr_api_server}' | tee -a /var/log/chr_registration/main.log",
      "  echo 'Using authentication with user: ${var.chr_username}' | tee -a /var/log/chr_registration/main.log",
      
      # OPTIMIZED: Enhanced retry strategy with exponential backoff
      "  RETRY_COUNT=0",
      "  MAX_RETRIES=4",  # OPTIMIZED: Increased from 3 to 4 retries
      "  REGISTRATION_SUCCESS=false",
      "  RETRY_DELAYS=(30 60 120 240)",  # OPTIMIZED: Exponential backoff delays
      "  CIRCUIT_BREAKER_FAILURES=0",
      "  CIRCUIT_BREAKER_THRESHOLD=2",
      
      "  while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ \"$REGISTRATION_SUCCESS\" = \"false\" ]; do",
      "    echo \"CHR registration attempt $((RETRY_COUNT + 1)) of $MAX_RETRIES...\" | tee -a /var/log/chr_registration/main.log",
      
      # OPTIMIZED: Circuit breaker implementation
      "    if [ $CIRCUIT_BREAKER_FAILURES -ge $CIRCUIT_BREAKER_THRESHOLD ]; then",
      "      echo 'Circuit breaker activated - testing satellite health before retry...' | tee -a /var/log/chr_registration/main.log",
      "      HEALTH_CHECK=$(curl -s -o /dev/null -w '%%{http_code}' --connect-timeout 10 --max-time 30 --insecure \"${var.chr_api_server}/health\" || echo '000')",
      "      if [ \"$HEALTH_CHECK\" -lt 200 ] || [ \"$HEALTH_CHECK\" -ge 500 ]; then",
      "        echo \"Satellite health check failed (HTTP $HEALTH_CHECK) - skipping remaining retries\" | tee -a /var/log/chr_registration/main.log",
      "        break",
      "      else",
      "        echo 'Satellite health check passed - continuing with registration' | tee -a /var/log/chr_registration/main.log",
      "        CIRCUIT_BREAKER_FAILURES=0",
      "      fi",
      "    fi",
      
      "    echo 'Requesting registration command from CHR API...' | tee -a /var/log/chr_registration/main.log",
      "    echo \"$(date '+%Y-%m-%d %H:%M:%S') - CURL API CALL: ${var.chr_api_server}/chr/register\" | tee -a /var/log/chr_registration/main.log",
      "    # Source credentials from file to avoid Terraform output suppression",
      "    source /tmp/chr_credentials.env",
      "    # Show request info for debugging",
      "    echo \"Full API URL: ${var.chr_api_server}/chr/register\" | tee -a /var/log/chr_registration/main.log",
      "    echo \"Sending POST request with hostgroup_name: ${var.vm_host_group}\" | tee -a /var/log/chr_registration/main.log",
      "    # Create separate request file to make debugging easier",
      "    cat > /tmp/chr_request.json << EOF",
      "{\"hostgroup_name\": \"${var.vm_host_group}\", \"auto_run\": false}",
      "EOF",
      "    echo \"Request payload:\" | tee -a /var/log/chr_registration/main.log",
      "    cat /tmp/chr_request.json | tee -a /var/log/chr_registration/main.log",
      
      # OPTIMIZED: Enhanced API call with dynamic timeouts and better error handling
      "    API_RESPONSE=$(curl -s \\",
      "      --connect-timeout $CONNECT_TIMEOUT \\", 
      "      --max-time $MAX_TIMEOUT \\",
      "      --insecure \\",
      "      --resolve \"$CHR_HOSTNAME:443:$CHR_IP\" \\",
      "      --resolve \"$CHR_HOSTNAME:80:$CHR_IP\" \\",
      "      -u \"$CHR_USERNAME:$CHR_PASSWORD\" \\",
      "      -X POST \\",
      "      '${var.chr_api_server}/chr/register' \\",
      "      -H 'Content-Type: application/json' \\",
      "      -d @/tmp/chr_request.json \\",
      "      -w '\\nHTTP_CODE:%{http_code}\\nTIME_TOTAL:%{time_total}\\nTIME_CONNECT:%{time_connect}' \\",
      "      -o /tmp/chr_response.json 2>/tmp/curl_error.log)",
      
      "    # Extract HTTP status code and timing information",
      "    HTTP_CODE=$(echo \"$API_RESPONSE\" | grep 'HTTP_CODE:' | cut -d':' -f2)",
      "    TIME_TOTAL=$(echo \"$API_RESPONSE\" | grep 'TIME_TOTAL:' | cut -d':' -f2)",
      "    TIME_CONNECT=$(echo \"$API_RESPONSE\" | grep 'TIME_CONNECT:' | cut -d':' -f2)",
      
      "    echo \"HTTP Status Code: $HTTP_CODE\" | tee -a /var/log/chr_registration/main.log",
      "    echo \"Connection Time: ${TIME_CONNECT}s, Total Time: ${TIME_TOTAL}s\" | tee -a /var/log/chr_registration/main.log",
      "    echo \"API Response:\" | tee -a /var/log/chr_registration/main.log",
      "    cat /tmp/chr_response.json | tee -a /var/log/chr_registration/main.log",
      
      # OPTIMIZED: Enhanced error categorization for intelligent retry decisions
      "    ERROR_TYPE=\"UNKNOWN\"",
      "    SHOULD_RETRY=true",
      
      "    if [ -z \"$HTTP_CODE\" ] || [ \"$HTTP_CODE\" = \"000\" ]; then",
      "      ERROR_TYPE=\"NETWORK_TIMEOUT\"",
      "      echo 'Network timeout or connection failure detected' | tee -a /var/log/chr_registration/main.log",
      "      CIRCUIT_BREAKER_FAILURES=$((CIRCUIT_BREAKER_FAILURES + 1))",
      "    elif [ \"$HTTP_CODE\" = \"401\" ] || [ \"$HTTP_CODE\" = \"403\" ]; then",
      "      ERROR_TYPE=\"AUTH_FAILURE\"",
      "      SHOULD_RETRY=false",
      "      echo 'Authentication failure - will not retry' | tee -a /var/log/chr_registration/main.log",
      "    elif [ \"$HTTP_CODE\" = \"404\" ]; then",
      "      ERROR_TYPE=\"API_NOT_FOUND\"",
      "      SHOULD_RETRY=false",
      "      echo 'API endpoint not found - will not retry' | tee -a /var/log/chr_registration/main.log",
      "    elif [ \"$HTTP_CODE\" -ge 500 ]; then",
      "      ERROR_TYPE=\"SERVER_ERROR\"",
      "      echo 'Server error detected - will retry' | tee -a /var/log/chr_registration/main.log",
      "      CIRCUIT_BREAKER_FAILURES=$((CIRCUIT_BREAKER_FAILURES + 1))",
      "    fi",
      
      "    REGISTRATION_CMD=$(cat /tmp/chr_response.json | jq -r '.registration_command' 2>/dev/null)",
      "    echo \"$(date '+%Y-%m-%d %H:%M:%S') - API CALL COMPLETED\" | tee -a /var/log/chr_registration/main.log",
      
      "    if [ \"$REGISTRATION_CMD\" != \"null\" ] && [ ! -z \"$REGISTRATION_CMD\" ] && [ \"$REGISTRATION_CMD\" != \"\" ]; then",
      "      echo 'Registration command received from CHR API' | tee -a /var/log/chr_registration/main.log",
      "      echo 'Executing CHR registration command...' | tee -a /var/log/chr_registration/main.log",
      "      echo \"$REGISTRATION_CMD\" > /tmp/chr_reg_cmd.sh",
      "      chmod +x /tmp/chr_reg_cmd.sh",
      
      # OPTIMIZED: Dynamic registration timeout based on network conditions
      "      if timeout $REG_TIMEOUT bash /tmp/chr_reg_cmd.sh; then",
      "        echo 'CHR registration completed successfully!' | tee -a /var/log/chr_registration/main.log",
      "        REGISTRATION_SUCCESS=true",
      
      "        echo 'Verifying registration status...' | tee -a /var/log/chr_registration/main.log",
      "        if command -v subscription-manager &> /dev/null; then",
      "          subscription-manager status || echo 'Registration verification completed' | tee -a /var/log/chr_registration/main.log",
      "        fi",
      "      else",
      "        echo 'Registration command execution failed or timed out' | tee -a /var/log/chr_registration/main.log",
      "        ERROR_TYPE=\"REGISTRATION_TIMEOUT\"",
      "      fi",
      "    else",
      "      echo 'Failed to retrieve valid registration command from CHR API' | tee -a /var/log/chr_registration/main.log",
      "      echo \"API Response: $(cat /tmp/chr_response.json)\" | tee -a /var/log/chr_registration/main.log",
      
      "      echo 'Testing direct connectivity to CHR API...' | tee -a /var/log/chr_registration/main.log",
      "      echo 'Sending API status request to ${var.chr_api_server}/status' | tee -a /var/log/chr_registration/main.log",
      "      echo \"$(date '+%Y-%m-%d %H:%M:%S') - CURL STATUS CHECK: ${var.chr_api_server}/status\" | tee -a /var/log/chr_registration/main.log",
      
      # OPTIMIZED: Status check with dynamic timeout
      "      echo \"Testing API endpoint: ${var.chr_api_server}/status\" | tee -a /var/log/chr_registration/main.log", 
      "      curl -s --connect-timeout $CONNECT_TIMEOUT --max-time $MAX_TIMEOUT --insecure \\",
      "        --resolve \"$CHR_HOSTNAME:443:$CHR_IP\" \\",
      "        -u \"$CHR_USERNAME:$CHR_PASSWORD\" \\",
      "        '${var.chr_api_server}/status' > /tmp/chr_status.json",
      
      "      echo \"API Status Response:\" | tee -a /var/log/chr_registration/main.log",
      "      cat /tmp/chr_status.json | tee -a /var/log/chr_registration/main.log",
      "      API_STATUS=$(cat /tmp/chr_status.json)",
      
      "      echo \"$(date '+%Y-%m-%d %H:%M:%S') - STATUS CHECK COMPLETED\" | tee -a /var/log/chr_registration/main.log",
      "      if [ -z \"$API_STATUS\" ]; then",
      "        echo 'API connectivity test failed - empty response' | tee -a /var/log/chr_registration/main.log",
      "      elif echo \"$API_STATUS\" | grep -q '404'; then",
      "        echo 'API connectivity test failed - 404 Not Found' | tee -a /var/log/chr_registration/main.log",
      "        echo 'Check API endpoint path: ${var.chr_api_server}/status' | tee -a /var/log/chr_registration/main.log",
      "      elif echo \"$API_STATUS\" | grep -q 'Unauthorized'; then",
      "        echo 'API connectivity test failed - Authentication failed' | tee -a /var/log/chr_registration/main.log",
      "        echo 'Check username and password credentials' | tee -a /var/log/chr_registration/main.log",
      "      else",
      "        echo 'API connectivity test completed' | tee -a /var/log/chr_registration/main.log",
      "      fi",
      "    fi",
      
      # OPTIMIZED: Intelligent retry decision based on error type
      "    if [ \"$REGISTRATION_SUCCESS\" = \"false\" ]; then",
      "      if [ \"$SHOULD_RETRY\" = \"false\" ]; then",
      "        echo \"Error type $ERROR_TYPE indicates retries will not help - aborting\" | tee -a /var/log/chr_registration/main.log",
      "        break",
      "      fi",
      
      "      RETRY_COUNT=$((RETRY_COUNT + 1))",
      "      if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then",
      # OPTIMIZED: Exponential backoff with jitter
      "        BASE_DELAY=${RETRY_DELAYS[$RETRY_COUNT]}",
      "        JITTER=$((RANDOM % 20 - 10))",  # ±10 seconds jitter
      "        ACTUAL_DELAY=$((BASE_DELAY + JITTER))",
      "        echo \"Waiting ${ACTUAL_DELAY} seconds before retry attempt $((RETRY_COUNT + 1)) (base: ${BASE_DELAY}s, jitter: ${JITTER}s)...\" | tee -a /var/log/chr_registration/main.log",
      "        sleep $ACTUAL_DELAY",
      "      fi",
      "    fi",
      "  done",
      
      "  if [ \"$REGISTRATION_SUCCESS\" = \"true\" ]; then",
      "    echo '======================================================' | tee -a /var/log/chr_registration/main.log",
      "    echo '===== CHR REGISTRATION PROCESS SUCCEEDED =============' | tee -a /var/log/chr_registration/main.log",
      "    echo '======================================================' | tee -a /var/log/chr_registration/main.log",
      "    echo \"$(date '+%Y-%m-%d %H:%M:%S') - REGISTRATION SUCCESSFUL\" | tee -a /var/log/chr_registration/main.log",
      "    echo 'VM is now registered with CHR Satellite and ready for management' | tee -a /var/log/chr_registration/main.log",
      "  else",
      "    echo '======================================================' | tee -a /var/log/chr_registration/main.log",
      "    echo '===== CHR REGISTRATION PROCESS FAILED ================' | tee -a /var/log/chr_registration/main.log",
      "    echo '======================================================' | tee -a /var/log/chr_registration/main.log",
      "    echo \"$(date '+%Y-%m-%d %H:%M:%S') - REGISTRATION FAILED AFTER $MAX_RETRIES ATTEMPTS\" | tee -a /var/log/chr_registration/main.log",
      "    echo \"Final error type: $ERROR_TYPE\" | tee -a /var/log/chr_registration/main.log",
      "    echo \"Circuit breaker failures: $CIRCUIT_BREAKER_FAILURES\" | tee -a /var/log/chr_registration/main.log",
      "    echo 'VM deployment completed, but CHR registration was unsuccessful' | tee -a /var/log/chr_registration/main.log",
      "    echo 'Manual registration may be required - contact system administrator' | tee -a /var/log/chr_registration/main.log",
      "    echo 'VM is functional but not managed by CHR Satellite' | tee -a /var/log/chr_registration/main.log",
      "    logger \"CHR registration failed for VM: $(hostname), Error: $ERROR_TYPE\"",
      "  fi",
      "else",
      "  echo 'No host group specified - skipping CHR registration' | tee -a /var/log/chr_registration/main.log",
      "  echo 'VM deployment completed without CHR integration' | tee -a /var/log/chr_registration/main.log",
      "fi"
    ]

    connection {
      type        = "ssh"
      user        = var.ssh_user
      host        = var.ipv4_address
      password    = var.ssh_password
      timeout     = "15m"  # OPTIMIZED: Increased from 10m to 15m for network variability
    }
  }
}
