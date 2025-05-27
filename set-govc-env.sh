#!/bin/bash
# Script to set up govc binary for vSphere connectivity

# Check if govc is already in the expected location
if [ -f "/usr/local/bin/govc" ]; then
    echo "GOVC binary found at /usr/local/bin/govc"
    
    # Ensure it has execute permissions
    sudo chmod +x /usr/local/bin/govc
    
    # Test the binary
    GOVC_VERSION=$(/usr/local/bin/govc version)
    if [ $? -eq 0 ]; then
        echo "GOVC version: $GOVC_VERSION"
        echo "GOVC is properly installed and executable"
    else
        echo "GOVC binary exists but fails to execute. Please check permissions and binary integrity."
        exit 1
    fi
else
    echo "GOVC binary not found at /usr/local/bin/govc"
    echo "Please ensure GOVC is installed and available at /usr/local/bin/govc"
    exit 1
fi

# Setup environment variables for testing
echo ""
echo "Setting up environment variables for GOVC..."
echo "You can source this script to set these variables in your current shell:"
echo "source set-govc-env.sh"
echo ""

# Read vSphere connection details from global_settings.json if available
SETTINGS_FILE="www/global_settings.json"
if [ -f "$SETTINGS_FILE" ]; then
    echo "Reading vSphere connection details from global_settings.json..."
    
    # Using grep and sed to extract values (basic parsing)
    VSPHERE_SERVER=$(grep -o '"server": "[^"]*"' "$SETTINGS_FILE" | sed 's/"server": "\(.*\)"/\1/')
    VSPHERE_USER=$(grep -o '"user": "[^"]*"' "$SETTINGS_FILE" | sed 's/"user": "\(.*\)"/\1/')
    
    # Set environment variables
    export GOVC_URL=$VSPHERE_SERVER
    export GOVC_USERNAME=$VSPHERE_USER
    export GOVC_INSECURE=1 # Skip certificate verification
    
    echo "Environment variables set:"
    echo "GOVC_URL=$GOVC_URL"
    echo "GOVC_USERNAME=$GOVC_USERNAME"
    echo "GOVC_INSECURE=1"
    echo ""
    echo "IMPORTANT: You still need to set GOVC_PASSWORD in your environment."
    echo "For example: export GOVC_PASSWORD='your-password'"
else
    echo "global_settings.json not found at $SETTINGS_FILE"
    echo "Please set GOVC environment variables manually:"
    echo "export GOVC_URL='vcenter-server-address'"
    echo "export GOVC_USERNAME='username'"
    echo "export GOVC_PASSWORD='password'"
    echo "export GOVC_INSECURE=1"
fi

echo ""
echo "You can test GOVC connectivity with:"
echo "govc about"
