@echo off
REM set-vsphere-env.bat
REM This batch file sets environment variables for Terraform vSphere provider

REM Set your vSphere credentials
set TF_VAR_vsphere_user=chr\mochtodpa

REM Prompt for password
set /p VSPHERE_PASSWORD=Enter your vSphere password: 
set TF_VAR_vsphere_password=%VSPHERE_PASSWORD%

REM Set vSphere server
set TF_VAR_vsphere_server=virtualcenter.chrobinson.com

echo Environment variables for Terraform vSphere provider have been set in this session.
echo Run your terraform commands in this same session to use these credentials.
