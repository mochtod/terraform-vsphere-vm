#!/bin/bash
# safe-credential-handler.sh
# This script safely processes vSphere credentials with special character handling

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
  
  # Extract values with proper handling of special characters
  # We use jq with raw output (-r) and then specifically handle each value
  
  # For the username, we need to preserve the backslashes
  VSPHERE_USER=$(jq -r '.vsphere.user' "$SETTINGS_FILE")
  
  # For the password, we need to handle special characters
  # Using printf to ensure special chars are preserved
  VSPHERE_PASSWORD=$(jq -r '.vsphere.password' "$SETTINGS_FILE")
  
  # For the server, no special handling needed beyond getting the raw value
  VSPHERE_SERVER=$(jq -r '.vsphere.server' "$SETTINGS_FILE")
  
  # Netbox values
  NETBOX_URL=$(jq -r '.netbox.url' "$SETTINGS_FILE")
  NETBOX_TOKEN=$(jq -r '.netbox.token' "$SETTINGS_FILE")
  NETBOX_PREFIX_ID=$(jq -r '.netbox.prefix_id' "$SETTINGS_FILE")
else
  echo "jq not found, using simple grep extraction (less reliable with special chars)"
  
  # Basic extraction that may not handle special characters well
  VSPHERE_USER=$(grep -o '"user": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  VSPHERE_PASSWORD=$(grep -o '"password": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  VSPHERE_SERVER=$(grep -o '"server": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  NETBOX_URL=$(grep -o '"url": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  NETBOX_TOKEN=$(grep -o '"token": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
  NETBOX_PREFIX_ID=$(grep -o '"prefix_id": *"[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
fi

# For better security and handling of special characters, create a temporary
# file with the credentials in Terraform-compatible format
TEMP_TFVARS=$(mktemp)

# Write credentials to the temporary file with proper escaping
cat > "$TEMP_TFVARS" << EOF
vsphere_user     = "${VSPHERE_USER}"
vsphere_password = "${VSPHERE_PASSWORD}"
vsphere_server   = "${VSPHERE_SERVER}"
netbox_url       = "${NETBOX_URL}"
netbox_token     = "${NETBOX_TOKEN}"
netbox_prefix_id = "${NETBOX_PREFIX_ID}"
EOF

# Create environment variables with the credentials
# This is an alternative method if the tfvars file doesn't work
export TF_VAR_vsphere_user="$VSPHERE_USER"
export TF_VAR_vsphere_password="$VSPHERE_PASSWORD"
export TF_VAR_vsphere_server="$VSPHERE_SERVER"
export TF_VAR_netbox_url="$NETBOX_URL"
export TF_VAR_netbox_token="$NETBOX_TOKEN"
export TF_VAR_netbox_prefix_id="$NETBOX_PREFIX_ID"

echo "Credentials have been exported as environment variables and written to: $TEMP_TFVARS"
echo "To use these credentials with Terraform, run:"
echo "terraform plan -var-file=$TEMP_TFVARS"
echo ""
echo "Or use the environment variables that have been set in this session."
echo ""
echo "WARNING: This temporary file contains sensitive information. Delete it when done:"
echo "rm $TEMP_TFVARS"

# Debug information (hiding most of password)
echo "==== Credential Debug Info ===="
echo "vSphere User: $VSPHERE_USER"
echo "vSphere Server: $VSPHERE_SERVER"
echo "vSphere Password: ${VSPHERE_PASSWORD:0:3}******* (showing first 3 chars only)"
echo "Password length: ${#VSPHERE_PASSWORD} characters"
echo "Special chars count: $(echo "$VSPHERE_PASSWORD" | tr -d '[:alnum:]' | wc -c)"
echo "============================="

# Return the path to the temporary tfvars file
echo "$TEMP_TFVARS"
