# WSL Credential Guide for TerraSphere

This guide explains how to resolve vSphere authentication issues using Windows Subsystem for Linux (WSL).

## Overview

The TerraSphere system requires proper credential handling for vSphere, Netbox, and Ansible Automation Platform. The main issue that might cause Terraform authentication errors is inconsistency between the credentials format used by govc and Terraform.

## Available Scripts

We've created several WSL-compatible scripts to help diagnose and fix credential issues:

1. **test-govc-connection.sh** - Tests direct govc connectivity to vSphere using various credential formats
2. **sync-vsphere-credentials.sh** - Synchronizes credentials between govc and Terraform
3. **debug-vsphere-credentials.sh** - Provides detailed debug info about credential processing
4. **safe-credential-handler.sh** - Creates temporary tfvars with properly escaped credentials

## Recommended Workflow

1. First, test direct govc connectivity:
   ```bash
   wsl bash ./test-govc-connection.sh
   ```

2. If govc connectivity works, synchronize the credentials:
   ```bash
   wsl bash ./sync-vsphere-credentials.sh
   ```

3. Use the synchronized credentials for Terraform:
   ```bash
   wsl source ./sync-vsphere-credentials.sh
   wsl terraform init
   wsl terraform plan
   ```

## Troubleshooting Common Issues

### 1. Username Format Issues

vSphere requires specific username formats depending on authentication type:
- Domain accounts: `domain\\username` (double backslash in JSON, single in environment)
- Local accounts: Just `username`
- Alternative format: `username@domain`

### 2. URL Format Issues

vSphere URLs can be picky about format:
- With or without protocol: `https://vcenter.example.com` vs `vcenter.example.com`
- With or without `/sdk` suffix: `https://vcenter.example.com/sdk`

### 3. Special Characters in Passwords

If your password contains special characters like `$`, `&`, `(`, `)`, etc., they might need proper escaping in environment variables or JSON.

## Solution for Netbox IP Allocation Issues

If Netbox IP allocation works but vSphere authentication fails, the issue is likely in the credential format. The `sync-vsphere-credentials.sh` script will try multiple formats to find the one that works with both govc and Terraform.

## Example Usage for Creating VMs

```bash
# Synchronize credentials first
wsl source ./sync-vsphere-credentials.sh

# Run Terraform with the synchronized credentials
wsl terraform init
wsl terraform plan -out=my-plan.tfplan
wsl terraform apply my-plan.tfplan
```

## Important Notes

1. Always use `source ./sync-vsphere-credentials.sh` to load the variables into your current shell session
2. If credentials change in `global_settings.json`, run the sync script again
3. For persistent configuration, you can add the working credential format to your `.bashrc` file
