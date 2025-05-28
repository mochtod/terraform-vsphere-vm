# Terraform vSphere Credential Management

This document explains the credential management setup for the Terraform vSphere project.

## Overview

The project now uses a streamlined approach to manage credentials:

1. Credentials are stored in `www/global_settings.json`
2. The `load-global-settings.sh` script extracts these credentials and exports them as Terraform environment variables
3. Terraform uses these environment variables when executing plans

## Key Files

- `www/global_settings.json` - Central storage for all credentials (vSphere, Netbox, etc.)
- `load-global-settings.sh` - Script to load credentials from the JSON file
- `create-terraform-plan.sh` - Updated to source the global settings script
- `test-terraform-connection.sh` - Test script to verify connectivity to vSphere
- `providers.tf` - Terraform provider configuration with improved debug settings

## Usage

### Testing vSphere Connectivity

To test connectivity to vSphere using the credentials from `global_settings.json`:

```bash
# Make the scripts executable if needed
wsl chmod +x load-global-settings.sh test-terraform-connection.sh

# Run the test script
./test-terraform-connection.sh
```

### Creating a Terraform Plan

To create a Terraform plan using the credentials from `global_settings.json`:

```bash
# Make the script executable if needed
wsl chmod +x create-terraform-plan.sh

# Run the plan script
./create-terraform-plan.sh -v your_vars_file.tfvars
```

## Troubleshooting

If you encounter authentication issues:

1. Verify the credentials in `www/global_settings.json` are correct
2. Check if the username format is correct (domain\\username)
3. Ensure the password doesn't contain unescaped special characters
4. Run the test script to check connectivity
5. Check the terraform logs with debug enabled
6. Verify the vSphere server address is correct and accessible

## Common Issues

- **Authentication failures**: Check the username format (domain\\username) and password
- **Connection timeout**: Verify network connectivity to the vSphere server
- **Special characters in password**: Ensure they are properly handled by the script
