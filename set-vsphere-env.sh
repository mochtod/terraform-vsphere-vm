#!/bin/bash
# set-vsphere-env.sh
# This script sets environment variables for Terraform vSphere provider

# Set your vSphere credentials
export TF_VAR_vsphere_user="chr\mochtodpa"

# Prompt for password securely
read -sp "Enter your vSphere password: " VSPHERE_PASSWORD
echo
export TF_VAR_vsphere_password="$VSPHERE_PASSWORD"

# Set vSphere server
export TF_VAR_vsphere_server="virtualcenter.chrobinson.com"

echo "Environment variables for Terraform vSphere provider have been set in this session."
echo "Run your terraform commands in this same session to use these credentials."
