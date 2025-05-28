# vSphere Credential Synchronization Guide

## Overview

This document explains how the enhanced credential synchronization system works to ensure that both govc and Terraform use the same working credential format when connecting to vSphere.

## Problem Solved

Previously, there was a credential format mismatch between how govc and Terraform accessed vSphere:

- **govc** has a mechanism to try multiple credential formats until it finds one that works
- **Terraform** was using raw credentials from global_settings.json without format detection

This resulted in the error: `ServerFaultCode: Cannot complete login due to an incorrect user name or password` even when the credentials were correct.

## Solution

The system now:

1. Detects the working credential format using govc's credential testing
2. Uses that same format for Terraform automatically
3. Updates global_settings.json with the working credential format (optional)

## Key Components

### 1. Enhanced Scripts

- **load-global-settings.sh**: Now includes credential format detection to find what works with vSphere
- **sync-vsphere-credentials.sh**: Updates global_settings.json with the working credential format
- **debug-vsphere-credentials.sh**: Diagnostic tool to identify and fix credential format issues

### 2. Format Detection Logic

The system tries multiple username/server formats including:

- Original values as-is
- Adding /sdk to the URL
- Removing domain prefix from username
- Converting domain\user to user@domain format
- Removing https:// from server URL
- Various combinations of the above

### 3. Usage Instructions

#### For troubleshooting credential issues:

```bash
# Run the diagnostic tool to identify issues
./debug-vsphere-credentials.sh

# Sync credentials between govc and Terraform
./sync-vsphere-credentials.sh
```

#### For normal operations:

```bash
# Load credentials with format detection
source ./load-global-settings.sh

# Run Terraform with the working credentials
terraform init
terraform plan
```

## Behind the Scenes

1. When `load-global-settings.sh` is sourced, it:
   - Extracts credentials from global_settings.json
   - Tests multiple format combinations with govc
   - Sets TF_VAR environment variables with the working format

2. When `sync-vsphere-credentials.sh` is run, it:
   - Finds the working credential format
   - Updates global_settings.json with this format
   - Creates verification files showing the working credentials

3. When Terraform runs, it:
   - Uses the formatted credentials from environment variables
   - Successfully connects to vSphere

## Best Practices

1. Always use `source ./load-global-settings.sh` before running Terraform commands
2. After changing credentials in the webapp, run `./sync-vsphere-credentials.sh` to sync them
3. If you encounter credential errors, use `./debug-vsphere-credentials.sh` to diagnose

## Technical Notes

- The system preserves the original password but may transform the username and server URL
- It handles special characters in passwords correctly
- Domain\username formats are properly handled for both Windows and vSphere authentication
