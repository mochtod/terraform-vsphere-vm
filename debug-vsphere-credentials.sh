#!/bin/bash
# debug-vsphere-credentials.sh
# This script helps diagnose and fix credential format issues between govc and Terraform

echo "===== vSphere Credential Debugging Tool ====="

# Set to 1 to show more debugging information
DEBUG=1

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_debug() {
    if [ $DEBUG -eq 1 ]; then
        echo -e "${BLUE}DEBUG: $1${NC}"
    fi
}

log_error() {
    echo -e "${RED}ERROR: $1${NC}"
}

log_success() {
    echo -e "${GREEN}SUCCESS: $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

# Path to global_settings.json
SETTINGS_FILE="www/global_settings.json"

# Check if the settings file exists
if [ ! -f "$SETTINGS_FILE" ]; then
  log_error "$SETTINGS_FILE not found!"
  exit 1
fi

echo "1. Checking global_settings.json format"

# Try to use jq to validate JSON format
if command -v jq &> /dev/null; then
    log_debug "Using jq for JSON validation"
    if jq empty "$SETTINGS_FILE" 2>/dev/null; then
        log_success "global_settings.json is valid JSON"
        
        # Extract values
        VSPHERE_USER=$(jq -r '.vsphere.user' "$SETTINGS_FILE")
        VSPHERE_PASSWORD=$(jq -r '.vsphere.password' "$SETTINGS_FILE")
        VSPHERE_SERVER=$(jq -r '.vsphere.server' "$SETTINGS_FILE")
        
        # Check for empty or null values
        if [ "$VSPHERE_USER" == "null" ] || [ -z "$VSPHERE_USER" ]; then
            log_error "vsphere.user is missing or null in global_settings.json"
        else
            log_success "vsphere.user is present: $VSPHERE_USER"
        fi
        
        if [ "$VSPHERE_PASSWORD" == "null" ] || [ -z "$VSPHERE_PASSWORD" ]; then
            log_error "vsphere.password is missing or null in global_settings.json"
        else
            log_success "vsphere.password is present and not empty"
        fi
        
        if [ "$VSPHERE_SERVER" == "null" ] || [ -z "$VSPHERE_SERVER" ]; then
            log_error "vsphere.server is missing or null in global_settings.json"
        else
            log_success "vsphere.server is present: $VSPHERE_SERVER"
        fi
    else
        log_error "global_settings.json is NOT valid JSON! Please fix the file format."
        exit 1
    fi
else
    log_warn "jq not found - skipping JSON validation"
    
    # Simple extraction using grep
    VSPHERE_USER=$(grep -o '"user": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
    VSPHERE_PASSWORD=$(grep -o '"password": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
    VSPHERE_SERVER=$(grep -o '"server": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
    
    if [ -z "$VSPHERE_USER" ]; then
        log_error "Could not extract vsphere.user from global_settings.json"
    fi
    
    if [ -z "$VSPHERE_PASSWORD" ]; then
        log_error "Could not extract vsphere.password from global_settings.json"
    fi
    
    if [ -z "$VSPHERE_SERVER" ]; then
        log_error "Could not extract vsphere.server from global_settings.json"
    fi
fi

echo -e "\n2. Testing govc connectivity"

# Check if govc is installed
if ! command -v govc &> /dev/null; then
    log_debug "govc binary not found in PATH. Checking for location in govc-helper.js..."
    
    # Extract GOVC_PATH from govc-helper.js
    if [ -f "www/govc-helper.js" ]; then
        GOVC_PATH=$(grep -o "const GOVC_PATH = '[^']*'" "www/govc-helper.js" | cut -d"'" -f2)
        log_debug "Found GOVC_PATH in govc-helper.js: $GOVC_PATH"
        
        if [ ! -f "$GOVC_PATH" ]; then
            log_error "govc not found at $GOVC_PATH specified in govc-helper.js"
            log_error "Please install govc or update the path in www/govc-helper.js"
            exit 1
        fi
    else
        log_error "govc-helper.js not found. Please install govc or specify its path."
        exit 1
    fi
else
    GOVC_PATH=$(which govc)
    log_success "Found govc at: $GOVC_PATH"
fi

# Try to find the working govc credentials format
log_debug "Testing different credential formats with govc..."

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
format_index=0
for format in "${formats[@]}"; do
    format_index=$((format_index+1))
    url=$(echo $format | cut -d'|' -f1)
    user=$(echo $format | cut -d'|' -f2)
    
    echo "   Testing format $format_index: URL=$url, User=$user"
    
    # Set environment variables for govc
    export GOVC_URL="$url"
    export GOVC_USERNAME="$user"
    export GOVC_PASSWORD="$VSPHERE_PASSWORD"
    export GOVC_INSECURE=1
    
    # Try a simple govc command
    if $GOVC_PATH ls &>/dev/null; then
        log_success "Format $format_index works with govc: URL=$url, User=$user"
        WORKING_GOVC_URL="$url"
        WORKING_GOVC_USERNAME="$user"
        success=true
        
        # Save the working format for reference
        WORKING_FORMAT_INDEX=$format_index
        break
    else
        log_warn "Format $format_index failed with govc"
    fi
done

# Check if any format was successful
if [ "$success" = false ]; then
    log_error "All govc authentication formats failed!"
    log_error "Please check your credentials in $SETTINGS_FILE"
    exit 1
fi

# Extract server without https:// for Terraform
TERRAFORM_SERVER=$(echo "$WORKING_GOVC_URL" | sed 's|https://||' | sed 's|/sdk||')

echo -e "\n3. Testing Terraform provider configuration"

# Create a minimal test file
cat > test-vsphere-connection.tf << EOF
provider "vsphere" {
  user           = var.vsphere_user
  password       = var.vsphere_password
  vsphere_server = var.vsphere_server
  allow_unverified_ssl = true
}

variable "vsphere_user" {
  description = "vSphere username"
  type        = string
}

variable "vsphere_password" {
  description = "vSphere password"
  type        = string
  sensitive   = true
}

variable "vsphere_server" {
  description = "vSphere server address"
  type        = string
}

# Simple data source to test connection
data "vsphere_datacenter" "dc" {
  name = "any-datacenter-name"  # Name doesn't matter for connection test
}

output "vsphere_user_used" {
  value = var.vsphere_user
}

output "vsphere_server_used" {
  value = var.vsphere_server
}
EOF

# Set environment variables for Terraform with working govc values
export TF_VAR_vsphere_user="$WORKING_GOVC_USERNAME"
export TF_VAR_vsphere_password="$VSPHERE_PASSWORD"
export TF_VAR_vsphere_server="$TERRAFORM_SERVER"

echo "Testing Terraform with:"
echo "TF_VAR_vsphere_user=$TF_VAR_vsphere_user"
echo "TF_VAR_vsphere_server=$TF_VAR_vsphere_server"

# Initialize Terraform
terraform init

# Test the connection
echo "Running terraform plan to test connection..."
TF_LOG=DEBUG terraform plan -out=test.tfplan > terraform-test.log 2>&1
TF_RESULT=$?

# Check the result
if [ $TF_RESULT -eq 0 ]; then
    log_success "Terraform connection to vSphere successful!"
else
    log_error "Terraform connection to vSphere failed."
    echo "==== Error Log Excerpts ===="
    # Extract relevant error messages from the log
    grep -i "error\|cannot\|denied\|invalid\|failed" terraform-test.log
    echo "==== End of Error Log Excerpts ===="
    echo "See terraform-test.log for complete output."
fi

echo -e "\n4. Credential Format Summary"
echo "==================================="
echo "Original credentials from global_settings.json:"
echo "  User: $VSPHERE_USER"
echo "  Server: $VSPHERE_SERVER"
echo ""
echo "Working govc credentials (Format $WORKING_FORMAT_INDEX):"
echo "  GOVC_URL: $WORKING_GOVC_URL"
echo "  GOVC_USERNAME: $WORKING_GOVC_USERNAME"
echo ""
echo "Working Terraform credentials:"
echo "  vsphere_user: $TF_VAR_vsphere_user"
echo "  vsphere_server: $TF_VAR_vsphere_server"
echo "==================================="

echo -e "\n5. Recommendations"
if [ "$success" = true ]; then
    echo "✅ Found working credential format for govc: Format $WORKING_FORMAT_INDEX"
    
    if [ $TF_RESULT -eq 0 ]; then
        echo "✅ Terraform connection successful with the same credential format"
        echo ""
        echo "To fix your credential issues permanently, run: ./sync-vsphere-credentials.sh"
        echo "This will update global_settings.json with the working credential format."
    else
        echo "❌ Terraform connection failed despite working govc credentials"
        echo ""
        echo "Recommended actions:"
        echo "1. Check terraform-test.log for detailed error messages"
        echo "2. Run: ./sync-vsphere-credentials.sh to update global_settings.json"
        echo "3. Verify your Terraform provider configuration in providers.tf"
    fi
else
    echo "❌ No working credential format found for govc"
    echo ""
    echo "Recommended actions:"
    echo "1. Verify your vSphere credentials in global_settings.json"
    echo "2. Check if vSphere URL is accessible from this machine"
    echo "3. Try running: ./set-govc-env.sh to test different credential formats"
fi

# Clean up
echo -e "\nCleaning up test files..."
rm -f test-vsphere-connection.tf test.tfplan

echo "Debugging complete. Use ./sync-vsphere-credentials.sh to fix credential format issues."
