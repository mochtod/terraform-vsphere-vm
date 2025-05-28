#!/bin/bash
# test-terraform-connection.sh
# This script tests the Terraform configuration with the credentials from global_settings.json

# Set bash to echo commands for debugging
set -x

echo "=== vSphere Terraform Connection Test ==="
echo "Loading credentials from global_settings.json..."
source ./load-global-settings.sh

# Display credential information for debugging (hide actual password)
echo "==== Credential Verification ===="
echo "vSphere User: $TF_VAR_vsphere_user"
echo "vSphere Password: ${TF_VAR_vsphere_password:0:3}********"
echo "vSphere Server: $TF_VAR_vsphere_server"
echo "Netbox URL: $TF_VAR_netbox_url"
echo "Netbox Token: ${TF_VAR_netbox_token:0:5}********"
echo "Netbox Prefix ID: $TF_VAR_netbox_prefix_id"
echo "=========="

echo "Running terraform validate to check configuration..."
terraform init
terraform validate

echo "Creating test connection file..."
# Create a minimal test file that just checks the connection
cat > test-connection.tf << EOF
data "vsphere_datacenter" "dc" {
  name = "any-datacenter-name"  # Name doesn't matter for connection test
}

output "test_connection" {
  value = "If this succeeds, connection to vSphere was established successfully"
}

# Add a simple output to show the actual user value being used
output "debug_vsphere_user" {
  value = var.vsphere_user
  sensitive = true
}

output "debug_vsphere_server" {
  value = var.vsphere_server
}
EOF

echo "==== Running connection test ===="
echo "This will attempt to validate vSphere credentials without making any changes."

# Try with TF_LOG for more verbose output
export TF_LOG=DEBUG
terraform plan -out=test.tfplan > connection-test.log 2>&1
TEST_RESULT=$?

# Check the result
if [ $TEST_RESULT -eq 0 ]; then
  echo "SUCCESS: Connection to vSphere successful!"
else
  echo "FAILURE: Connection to vSphere failed."
  echo "==== Error Log Excerpts ===="
  # Extract relevant error messages from the log
  grep -i "error\|cannot\|denied\|invalid\|failed" connection-test.log
  echo "==== End of Error Log Excerpts ===="
  echo "See connection-test.log for complete output."
fi

# Clean up
echo "Cleaning up test files..."
rm -f test-connection.tf test.tfplan

echo "Test complete. See above for results."

# Reset debug mode
set +x
