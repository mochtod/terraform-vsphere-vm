#!/bin/bash
# sync-vsphere-credentials.sh
# Enhanced script to synchronize vSphere credentials between govc and Terraform
# Also updates the global_settings.json with the working credential format

echo "===== Synchronizing vSphere Credentials ====="

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
  
  # Extract values without processing
  VSPHERE_USER=$(jq -r '.vsphere.user' "$SETTINGS_FILE")
  VSPHERE_PASSWORD=$(jq -r '.vsphere.password' "$SETTINGS_FILE")
  VSPHERE_SERVER=$(jq -r '.vsphere.server' "$SETTINGS_FILE")
  
  # Extract Netbox values
  NETBOX_URL=$(jq -r '.netbox.url' "$SETTINGS_FILE")
  NETBOX_TOKEN=$(jq -r '.netbox.token' "$SETTINGS_FILE")
  NETBOX_PREFIX_ID=$(jq -r '.netbox.prefix_id' "$SETTINGS_FILE")
else
  echo "jq not found, using fallback parsing method"
  
  # Simple extraction using grep
  VSPHERE_USER=$(grep -o '"user": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  VSPHERE_PASSWORD=$(grep -o '"password": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  VSPHERE_SERVER=$(grep -o '"server": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  
  NETBOX_URL=$(grep -o '"url": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  NETBOX_TOKEN=$(grep -o '"token": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  NETBOX_PREFIX_ID=$(grep -o '"prefix_id": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
fi

# Check if govc is installed
if ! command -v govc &> /dev/null; then
    echo "govc is not installed. Checking for location in govc-helper.js..."
    
    # Extract GOVC_PATH from govc-helper.js
    if [ -f "www/govc-helper.js" ]; then
        GOVC_PATH=$(grep -o "const GOVC_PATH = '[^']*'" "www/govc-helper.js" | cut -d"'" -f2)
        echo "Found GOVC_PATH in govc-helper.js: $GOVC_PATH"
        
        if [ ! -f "$GOVC_PATH" ]; then
            echo "govc not found at $GOVC_PATH"
            echo "Please install govc or update the path in www/govc-helper.js"
            exit 1
        fi
    else
        echo "govc-helper.js not found. Please install govc or specify its path."
        exit 1
    fi
else
    GOVC_PATH=$(which govc)
    echo "Found govc at: $GOVC_PATH"
fi

# Find the working govc credentials format
echo "===== Finding Working govc Credential Format ====="

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
    if $GOVC_PATH ls &>/dev/null; then
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
    echo "Please check your credentials in $SETTINGS_FILE"
    echo "=========================================="
    exit 1
fi

# Extract server without https:// for Terraform
TERRAFORM_SERVER=$(echo "$WORKING_GOVC_URL" | sed 's|https://||' | sed 's|/sdk||')

echo "===== Setting Environment Variables ====="
echo "GOVC_URL=$WORKING_GOVC_URL"
echo "GOVC_USERNAME=$WORKING_GOVC_USERNAME"
echo "GOVC_PASSWORD=*********" 
echo "GOVC_INSECURE=1"

echo "TF_VAR_vsphere_user=$WORKING_GOVC_USERNAME"
echo "TF_VAR_vsphere_password=*********"
echo "TF_VAR_vsphere_server=$TERRAFORM_SERVER"

# Set both govc and Terraform environment variables
export GOVC_URL="$WORKING_GOVC_URL"
export GOVC_USERNAME="$WORKING_GOVC_USERNAME"
export GOVC_PASSWORD="$VSPHERE_PASSWORD"
export GOVC_INSECURE=1

export TF_VAR_vsphere_user="$WORKING_GOVC_USERNAME"
export TF_VAR_vsphere_password="$VSPHERE_PASSWORD"
export TF_VAR_vsphere_server="$TERRAFORM_SERVER"

# Also set Netbox variables
export TF_VAR_netbox_url="$NETBOX_URL"
export TF_VAR_netbox_token="$NETBOX_TOKEN"
export TF_VAR_netbox_prefix_id="$NETBOX_PREFIX_ID"

echo "===== Testing govc Connection ====="
$GOVC_PATH ls

# Update the global_settings.json file with the working credentials format
echo "===== Updating global_settings.json with Working Credential Format ====="

# Create a backup of the original file
cp "$SETTINGS_FILE" "${SETTINGS_FILE}.bak"
echo "Created backup of global_settings.json at ${SETTINGS_FILE}.bak"

# Update the global_settings.json with the working format
# Careful not to save credentials in a way that would break the file
if command -v jq &> /dev/null; then
    # Use jq to update the file (preferred method)
    # Update only the user field, and preserve the original structure
    jq --arg user "$WORKING_GOVC_USERNAME" '.vsphere.user = $user' "$SETTINGS_FILE" > "${SETTINGS_FILE}.tmp"
    # Update the server field
    jq --arg server "$TERRAFORM_SERVER" '.vsphere.server = "https://" + $server' "${SETTINGS_FILE}.tmp" > "${SETTINGS_FILE}.tmp2"
    # Update lastUpdated timestamp
    jq --arg time "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")" '.lastUpdated = $time' "${SETTINGS_FILE}.tmp2" > "${SETTINGS_FILE}.new"
    
    # Replace original file with updated one
    mv "${SETTINGS_FILE}.new" "$SETTINGS_FILE"
    # Clean up temporary files
    rm -f "${SETTINGS_FILE}.tmp" "${SETTINGS_FILE}.tmp2" 2>/dev/null
    
    echo "Updated global_settings.json with working credential format"
else
    echo "Warning: jq not found. Cannot automatically update global_settings.json"
    echo "Please manually update the user format in global_settings.json to: $WORKING_GOVC_USERNAME"
    echo "And the server to: https://$TERRAFORM_SERVER"
fi

echo "===== Verifying Terraform Configuration ====="
terraform init

echo "===== Testing Terraform Provider Connection ====="
terraform providers

echo "===== Creating Credential Verification File ====="

# Create a file showing the working credentials
cat > vsphere-credentials-working.txt << EOF
# Working vSphere Credentials Configuration
# Generated on $(date)

# govc Environment Variables
export GOVC_URL="$WORKING_GOVC_URL"
export GOVC_USERNAME="$WORKING_GOVC_USERNAME"
export GOVC_PASSWORD="***" # Set this to the actual password
export GOVC_INSECURE=1

# Terraform Environment Variables
export TF_VAR_vsphere_user="$WORKING_GOVC_USERNAME"
export TF_VAR_vsphere_password="***" # Set this to the actual password
export TF_VAR_vsphere_server="$TERRAFORM_SERVER"

# Netbox Environment Variables
export TF_VAR_netbox_url="$NETBOX_URL"
export TF_VAR_netbox_token="***" # Set this to the actual token
export TF_VAR_netbox_prefix_id="$NETBOX_PREFIX_ID"
EOF

echo "===== Creating sample tfvars file ====="

# Create a tfvars file with the working credentials
cat > working-credentials.auto.tfvars << EOF
# Working vSphere Credentials
# Generated on $(date)

vsphere_user     = "$WORKING_GOVC_USERNAME"
vsphere_password = "$VSPHERE_PASSWORD"
vsphere_server   = "$TERRAFORM_SERVER"

# Netbox Settings
netbox_url       = "$NETBOX_URL"
netbox_token     = "$NETBOX_TOKEN"
netbox_prefix_id = "$NETBOX_PREFIX_ID"
EOF

echo "===== Credential Synchronization Complete ====="
echo "Credential verification file created: vsphere-credentials-working.txt"
echo "Working credentials tfvars file created: working-credentials.auto.tfvars"
echo ""
echo "To use these credentials in your shell session, run:"
echo "source ./sync-vsphere-credentials.sh"
