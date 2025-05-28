#!/bin/bash
# load-global-settings.sh
# This script loads credentials from global_settings.json and exports them as Terraform variables
# Enhanced to find the correct credential format that works with both govc and Terraform

echo "===== Loading Global Settings ====="

# Path to global_settings.json
SETTINGS_FILE="www/global_settings.json"

# Check if the settings file exists
if [ ! -f "$SETTINGS_FILE" ]; then
  echo "Error: $SETTINGS_FILE not found!"
  exit 1
fi

# Try to use jq if available for better JSON parsing
if command -v jq &> /dev/null; then
  echo "Using jq for JSON parsing"
  
  # Extract values from the JSON file using jq
  # For username, preserve backslashes by using raw output without further processing
  VSPHERE_USER=$(jq -r '.vsphere.user' "$SETTINGS_FILE")
  # For password, ensure we get the raw value with special characters intact
  VSPHERE_PASSWORD=$(jq -r '.vsphere.password' "$SETTINGS_FILE")
  # Don't remove https:// here as we'll test different formats
  VSPHERE_SERVER=$(jq -r '.vsphere.server' "$SETTINGS_FILE")
  NETBOX_URL=$(jq -r '.netbox.url' "$SETTINGS_FILE")
  NETBOX_TOKEN=$(jq -r '.netbox.token' "$SETTINGS_FILE")
  NETBOX_PREFIX_ID=$(jq -r '.netbox.prefix_id' "$SETTINGS_FILE")
else
  echo "jq not found, using fallback parsing method"
  
  # Simple extraction using grep (less robust but works for basic JSON)
  VSPHERE_USER=$(grep -o '"user": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  VSPHERE_PASSWORD=$(grep -o '"password": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  # Don't remove https:// here as we'll test different formats
  VSPHERE_SERVER=$(grep -o '"server": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  NETBOX_URL=$(grep -o '"url": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  NETBOX_TOKEN=$(grep -o '"token": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  NETBOX_PREFIX_ID=$(grep -o '"prefix_id": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
fi

# Print parsed values for debugging (excluding password)
echo "Raw settings from global_settings.json:"
echo "VSPHERE_USER: $VSPHERE_USER"
echo "VSPHERE_SERVER: $VSPHERE_SERVER"
echo "NETBOX_URL: $NETBOX_URL"
echo "NETBOX_PREFIX_ID: $NETBOX_PREFIX_ID"

# Check if govc is installed
if ! command -v govc &> /dev/null; then
    echo "govc is not installed. Checking for location in govc-helper.js..."
    
    # Extract GOVC_PATH from govc-helper.js
    if [ -f "www/govc-helper.js" ]; then
        GOVC_PATH=$(grep -o "const GOVC_PATH = '[^']*'" "www/govc-helper.js" | cut -d"'" -f2)
        echo "Found GOVC_PATH in govc-helper.js: $GOVC_PATH"
        
        if [ ! -f "$GOVC_PATH" ]; then
            echo "govc not found at $GOVC_PATH"
            echo "Using raw credentials without format verification."
        fi
    else
        echo "govc-helper.js not found. Using raw credentials without format verification."
    fi
else
    GOVC_PATH=$(which govc)
    echo "Found govc at: $GOVC_PATH"
fi

# If govc is available, find the working credential format
if [ -n "$GOVC_PATH" ] && [ -f "$GOVC_PATH" ]; then
    echo "===== Finding Working Credential Format ====="

    # Try multiple authentication formats
    declare -a formats=(
        # Format 1: Original values
        "$VSPHERE_SERVER|$VSPHERE_USER"
        
        # Format 2: Add /sdk to URL
        "${VSPHERE_SERVER}/sdk|$VSPHERE_USER"
        
        # Format 3: Remove domain from username
        "$VSPHERE_SERVER|$(echo $VSPHERE_USER | cut -d'\' -f2)"
        
        # Format 4: With /sdk and without domain
        "${VSPHERE_SERVER}/sdk|$(echo $VSPHERE_USER | cut -d'\' -f2)"
        
        # Format 5: User@domain format
        "$VSPHERE_SERVER|$(echo $VSPHERE_USER | awk -F'\\\' '{print $2"@"$1}')"
        
        # Format 6: User@domain with /sdk
        "${VSPHERE_SERVER}/sdk|$(echo $VSPHERE_USER | awk -F'\\\' '{print $2"@"$1}')"
        
        # Format 7: Without https://
        "$(echo $VSPHERE_SERVER | sed 's|https://||')|$VSPHERE_USER"
        
        # Format 8: Without https:// and with /sdk
        "$(echo $VSPHERE_SERVER | sed 's|https://||')/sdk|$VSPHERE_USER"
    )

    # Test each format
    success=false
    for format in "${formats[@]}"; do
        url=$(echo $format | cut -d'|' -f1)
        user=$(echo $format | cut -d'|' -f2)
        
        echo "Testing format: URL=$url, User=$user"
        
        # Set environment variables for govc
        export GOVC_URL="$url"
        export GOVC_USERNAME="$user"
        export GOVC_PASSWORD="$VSPHERE_PASSWORD"
        export GOVC_INSECURE=1
        
        # Try a simple govc command (less verbose than about)
        if "$GOVC_PATH" ls &>/dev/null; then
            echo "✅ Success with URL=$url, User=$user"
            WORKING_GOVC_URL="$url"
            WORKING_GOVC_USERNAME="$user"
            success=true
            break
        else
            echo "❌ Failed with URL=$url, User=$user"
        fi
    done

    # Check if any format was successful
    if [ "$success" = false ]; then
        echo "=========================================="
        echo "❌ All govc authentication formats failed!"
        echo "Falling back to raw credentials from global_settings.json"
        echo "=========================================="
        WORKING_GOVC_USERNAME="$VSPHERE_USER"
        TERRAFORM_SERVER=$(echo "$VSPHERE_SERVER" | sed 's|https://||')
    else
        # Extract server without https:// for Terraform
        TERRAFORM_SERVER=$(echo "$WORKING_GOVC_URL" | sed 's|https://||' | sed 's|/sdk||')
        
        echo "===== Using Working Credential Format ====="
        echo "GOVC_URL=$WORKING_GOVC_URL"
        echo "GOVC_USERNAME=$WORKING_GOVC_USERNAME"
        echo "TERRAFORM_SERVER=$TERRAFORM_SERVER"
    fi
else
    echo "govc not available. Using raw credentials from global_settings.json"
    WORKING_GOVC_USERNAME="$VSPHERE_USER"
    TERRAFORM_SERVER=$(echo "$VSPHERE_SERVER" | sed 's|https://||')
fi

# Set environment variables for Terraform
export TF_VAR_vsphere_user="${WORKING_GOVC_USERNAME:-$VSPHERE_USER}"
export TF_VAR_vsphere_password="$VSPHERE_PASSWORD"
export TF_VAR_vsphere_server="${TERRAFORM_SERVER:-$(echo $VSPHERE_SERVER | sed 's|https://||')}"
export TF_VAR_netbox_url="$NETBOX_URL"
export TF_VAR_netbox_token="$NETBOX_TOKEN"
export TF_VAR_netbox_prefix_id="$NETBOX_PREFIX_ID"

echo "===== Terraform Environment Variables Set ====="
echo "TF_VAR_vsphere_user=$TF_VAR_vsphere_user"
echo "TF_VAR_vsphere_server=$TF_VAR_vsphere_server"
echo "TF_VAR_netbox_url=$TF_VAR_netbox_url"
echo "TF_VAR_netbox_prefix_id=$TF_VAR_netbox_prefix_id"

echo "Environment variables for Terraform have been set"
echo "Run your terraform commands in this same session to use these credentials."
