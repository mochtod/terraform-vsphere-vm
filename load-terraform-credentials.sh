#!/bin/bash
# Terraform Global Settings Loader
# This script loads the same global_settings.json that the UI/API uses and sets environment variables for Terraform

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETTINGS_FILE="$SCRIPT_DIR/www/global_settings.json"

# Check if settings file exists
if [ ! -f "$SETTINGS_FILE" ]; then
    echo "Error: global_settings.json not found at $SETTINGS_FILE"
    exit 1
fi

echo "Loading credentials from global_settings.json..."

# Parse JSON using jq or python (fallback)
if command -v jq &> /dev/null; then
    # Use jq if available
    VSPHERE_USER=$(jq -r '.vsphere.user' "$SETTINGS_FILE")
    VSPHERE_PASSWORD=$(jq -r '.vsphere.password' "$SETTINGS_FILE")
    VSPHERE_SERVER=$(jq -r '.vsphere.server' "$SETTINGS_FILE")
    NETBOX_TOKEN=$(jq -r '.netbox.token' "$SETTINGS_FILE")
    NETBOX_URL=$(jq -r '.netbox.url' "$SETTINGS_FILE")
else
    # Fallback to python
    VSPHERE_USER=$(python3 -c "import json; data=json.load(open('$SETTINGS_FILE')); print(data['vsphere']['user'])")
    VSPHERE_PASSWORD=$(python3 -c "import json; data=json.load(open('$SETTINGS_FILE')); print(data['vsphere']['password'])")
    VSPHERE_SERVER=$(python3 -c "import json; data=json.load(open('$SETTINGS_FILE')); print(data['vsphere']['server'])")
    NETBOX_TOKEN=$(python3 -c "import json; data=json.load(open('$SETTINGS_FILE')); print(data['netbox']['token'])")
    NETBOX_URL=$(python3 -c "import json; data=json.load(open('$SETTINGS_FILE')); print(data['netbox']['url'])")
fi

# Export environment variables for Terraform
export VSPHERE_USER="$VSPHERE_USER"
export VSPHERE_PASSWORD="$VSPHERE_PASSWORD"
export VSPHERE_SERVER="$VSPHERE_SERVER"
export VSPHERE_ALLOW_UNVERIFIED_SSL=true

# Export Terraform variables
export TF_VAR_vsphere_user="$VSPHERE_USER"
export TF_VAR_vsphere_password="$VSPHERE_PASSWORD"
export TF_VAR_vsphere_server="$VSPHERE_SERVER"

# Export Netbox variables
export NETBOX_TOKEN="$NETBOX_TOKEN"
export NETBOX_URL="$NETBOX_URL"

echo "Credentials loaded successfully:"
echo "  vSphere User: $VSPHERE_USER"
echo "  vSphere Server: $VSPHERE_SERVER"
echo "  Netbox URL: $NETBOX_URL"
echo "  Environment variables set for Terraform"

# If a command was passed as arguments, execute it
if [ $# -gt 0 ]; then
    echo "Executing: $@"
    exec "$@"
fi
