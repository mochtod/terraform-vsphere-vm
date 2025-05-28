#!/bin/bash
# set-govc-env.sh
# Enhanced script to set up govc binary and credentials for vSphere connectivity

# Function to find the govc binary
find_govc() {
    # Check multiple possible locations
    for location in "/usr/local/bin/govc" "/usr/bin/govc" "./govc" "$(which govc 2>/dev/null)"; do
        if [ -f "$location" ]; then
            echo "GOVC binary found at $location"
            GOVC_PATH="$location"
            
            # Ensure it has execute permissions (if possible without sudo)
            chmod +x "$GOVC_PATH" 2>/dev/null || true
            
            # Test the binary
            GOVC_VERSION=$("$GOVC_PATH" version 2>/dev/null)
            if [ $? -eq 0 ]; then
                echo "GOVC version: $GOVC_VERSION"
                echo "GOVC is properly installed and executable"
                return 0
            fi
        fi
    done
    
    # If we didn't find a working govc binary
    echo "GOVC binary not found or not executable"
    echo "Please ensure GOVC is installed and available in your PATH"
    
    # Check if we're in WSL and suggest download instructions
    if grep -q Microsoft /proc/version 2>/dev/null; then
        echo "You appear to be running in WSL. To install govc:"
        echo "wget https://github.com/vmware/govmomi/releases/download/v0.30.0/govc_Linux_x86_64.tar.gz"
        echo "tar -xzf govc_Linux_x86_64.tar.gz"
        echo "chmod +x govc"
        echo "sudo mv govc /usr/local/bin/"
    fi
    
    return 1
}

# Try to locate govc
find_govc || exit 1

# Setup environment variables for testing
echo ""
echo "Setting up environment variables for GOVC..."
echo "You can source this script to set these variables in your current shell:"
echo "source set-govc-env.sh"
echo ""

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
echo "TF_VAR_vsphere_server=$TERRAFORM_SERVER"

# Set both govc and Terraform environment variables
export GOVC_URL="$WORKING_GOVC_URL"
export GOVC_USERNAME="$WORKING_GOVC_USERNAME"
export GOVC_PASSWORD="$VSPHERE_PASSWORD"
export GOVC_INSECURE=1

export TF_VAR_vsphere_user="$WORKING_GOVC_USERNAME"
export TF_VAR_vsphere_password="$VSPHERE_PASSWORD"
export TF_VAR_vsphere_server="$TERRAFORM_SERVER"
echo ""
echo "IMPORTANT: These variables are set in the current shell session only."
echo "To use in a new terminal, you must source this script again."
echo ""
echo "Test GOVC connectivity with:"
echo "$GOVC_PATH about"
echo ""
echo "Test Terraform with:"
echo "terraform init && terraform plan"
