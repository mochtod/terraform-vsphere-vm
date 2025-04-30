# Set-TerraformVSphereEnv.ps1
# This script sets environment variables for Terraform vSphere provider

# Set your vSphere credentials
$env:TF_VAR_vsphere_user = "chr\mochtodpa"
# Prompt for password securely (won't be displayed on screen)
$securePassword = Read-Host -Prompt "Enter your vSphere password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$env:TF_VAR_vsphere_password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

# Set vSphere server
$env:TF_VAR_vsphere_server = "virtualcenter.chrobinson.com"

Write-Host "Environment variables for Terraform vSphere provider have been set in this session."
Write-Host "Run your terraform commands in this same session to use these credentials."
