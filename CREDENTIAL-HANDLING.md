# vSphere Credential Handling Guide

This document explains how to properly handle vSphere, Netbox, and AAP credentials in the TerraSphere system.

## Overview

The TerraSphere system uses credentials stored in `www/global_settings.json` to authenticate with vSphere, Netbox, and Ansible Automation Platform (AAP). These credentials are loaded into environment variables or passed to Terraform through various scripts.

## Special Character Handling

Credentials (especially passwords) often contain special characters that can cause issues when processed through multiple systems (JSON → Bash → Terraform). We've implemented several enhancements to properly handle these special characters:

1. The `load-global-settings.sh` script properly extracts credentials from `global_settings.json` without double-stripping the `https://` prefix.
2. The `safe-credential-handler.sh` script provides a more robust method for extracting and exporting credentials.
3. Windows batch files use WSL to ensure consistent credential handling across platforms.

## Troubleshooting Authentication Issues

If you encounter authentication issues with vSphere, use the following scripts to diagnose and resolve them:

- `test-vsphere-connection.bat` (Windows) or `test-terraform-connection.sh` (Linux/WSL) - Tests connectivity to vSphere
- `debug-vsphere-credentials.sh` - Provides detailed debugging information about credential processing
- `safe-credential-handler.sh` - Creates a temporary tfvars file with properly escaped credentials

### Common vSphere Authentication Issues

1. **Username Format**: Ensure the domain is properly escaped (e.g., `domain\\username`)
2. **Password Special Characters**: Special characters in passwords may need proper escaping
3. **Server URL**: The URL should be formatted correctly (with or without `https://`)
4. **Double-stripping**: Avoid removing the `https://` prefix multiple times

## Using the Enhanced Tools

### For Windows Users

Run Terraform commands with properly handled credentials:

```
terraform-with-credentials.bat plan
terraform-with-credentials.bat apply
terraform-with-credentials.bat destroy
```

Test vSphere connectivity:

```
test-vsphere-connection.bat
```

### For Linux/WSL Users

Use the safe credential handler:

```bash
source ./safe-credential-handler.sh
terraform plan
```

Or test the connection:

```bash
bash ./test-terraform-connection.sh
```

## Credential File Format

The `www/global_settings.json` file should be formatted as follows:

```json
{
  "vsphere": {
    "user": "domain\\username",
    "server": "https://vsphere-server.example.com",
    "password": "your-password-with-special-chars"
  },
  "netbox": {
    "url": "https://netbox.example.com",
    "token": "netbox-api-token",
    "prefix_id": "1234"
  },
  "aap": {
    "api_url": "https://aap.example.com",
    "api_token": "aap-api-token"
  },
  "lastUpdated": "2025-05-28T18:18:49.254Z"
}
```

## Security Best Practices

1. Never commit `global_settings.json` with real credentials to version control
2. Temporary credential files created by `safe-credential-handler.sh` are automatically cleaned up
3. Use environment variables when possible instead of files
4. Consider using a credential management system for production environments
