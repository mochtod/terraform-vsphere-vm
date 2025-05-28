#!/bin/bash
# test-govc-connection.sh
# Tests vSphere connection using govc binary directly

set -x

echo "===== Testing vSphere Connection Using govc ====="

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
else
  echo "jq not found, using fallback parsing method"
  
  # Simple extraction using grep
  VSPHERE_USER=$(grep -o '"user": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  VSPHERE_PASSWORD=$(grep -o '"password": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  VSPHERE_SERVER=$(grep -o '"server": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
fi

echo "===== Credential Information ====="
echo "User: $VSPHERE_USER"
echo "Server: $VSPHERE_SERVER"
echo "Password: ${VSPHERE_PASSWORD:0:3}**** (first 3 chars only)"

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

# Test multiple URL formats as in govc-helper.js
echo "===== Testing Multiple Authentication Formats ====="

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
    
    echo "-------------------------------"
    echo "Testing format: URL=$url, User=$user"
    
    # Set environment variables for govc
    export GOVC_URL="$url"
    export GOVC_USERNAME="$user"
    export GOVC_PASSWORD="$VSPHERE_PASSWORD"
    export GOVC_INSECURE=1
    
    # Try to list datacenters
    if $GOVC_PATH about; then
        echo "✅ Success with URL=$url, User=$user"
        echo "========== WORKING CREDENTIALS ==========="
        echo "export GOVC_URL=\"$url\""
        echo "export GOVC_USERNAME=\"$user\""
        echo "export GOVC_PASSWORD=\"****\""
        echo "export GOVC_INSECURE=1"
        echo "=========================================="
        success=true
        break
    else
        echo "❌ Failed with URL=$url, User=$user"
    fi
done

# Check if any format was successful
if [ "$success" = false ]; then
    echo "=========================================="
    echo "❌ All authentication formats failed!"
    echo "Please check your credentials in $SETTINGS_FILE"
    echo "=========================================="
    exit 1
fi

echo "===== Testing Datacenter Listing ====="
$GOVC_PATH ls

echo "===== Testing VM Template Listing ====="
$GOVC_PATH vm.info -t=true

echo "===== Connection Test Complete ====="
echo "govc connection test successful!"
