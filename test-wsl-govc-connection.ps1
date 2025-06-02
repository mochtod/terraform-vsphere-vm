# Test vSphere connection using WSL govc with credentials from global_settings.json
$ErrorActionPreference = "Stop"

Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "TESTING VSPHERE CONNECTION WITH WSL GOVC" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green

# Load credentials from global_settings.json
$settingsPath = "c:\Users\mochtod\terraform-vsphere-vm-3\www\global_settings.json"
Write-Host "`n1. LOADING CREDENTIALS FROM GLOBAL SETTINGS..." -ForegroundColor Yellow
Write-Host "Reading from: $settingsPath"

if (-not (Test-Path $settingsPath)) {
    Write-Host "ERROR: Global settings file not found at $settingsPath" -ForegroundColor Red
    exit 1
}

$settingsContent = Get-Content $settingsPath -Raw
$settings = $settingsContent | ConvertFrom-Json

# Extract vSphere credentials
$vsphereServer = $settings.vsphere.server
$vsphereUser = $settings.vsphere.user
$vspherePassword = $settings.vsphere.password

Write-Host "vSphere Server: $vsphereServer" -ForegroundColor Cyan
Write-Host "vSphere User: $vsphereUser" -ForegroundColor Cyan
Write-Host "vSphere Password: [${($vspherePassword.Length)} chars]" -ForegroundColor Cyan

# Format credentials for govc
Write-Host "`n2. FORMATTING CREDENTIALS FOR GOVC..." -ForegroundColor Yellow

# Handle domain username - convert double backslash to single for govc
$formattedUser = $vsphereUser -replace '\\\\', '\'
Write-Host "Formatted User: $formattedUser" -ForegroundColor Cyan

# Format server URL
$formattedUrl = if ($vsphereServer -match '^https?://') { $vsphereServer } else { "https://$vsphereServer" }
Write-Host "Formatted URL: $formattedUrl" -ForegroundColor Cyan

# Test WSL govc availability
Write-Host "`n3. TESTING WSL GOVC AVAILABILITY..." -ForegroundColor Yellow

try {
    $govcVersion = wsl /usr/local/bin/govc version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ govc is available in WSL" -ForegroundColor Green
        Write-Host "Version: $govcVersion" -ForegroundColor Cyan
    } else {
        Write-Host "❌ govc not found in WSL at /usr/local/bin/govc" -ForegroundColor Red
        Write-Host "Error: $govcVersion" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error running WSL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test vSphere connection
Write-Host "`n4. TESTING VSPHERE CONNECTION..." -ForegroundColor Yellow

# Set environment variables for govc in WSL
$env:GOVC_URL = $formattedUrl
$env:GOVC_USERNAME = $formattedUser
$env:GOVC_PASSWORD = $vspherePassword
$env:GOVC_INSECURE = "1"

Write-Host "Setting GOVC environment variables..." -ForegroundColor Cyan
Write-Host "GOVC_URL: $env:GOVC_URL" -ForegroundColor Gray
Write-Host "GOVC_USERNAME: $env:GOVC_USERNAME" -ForegroundColor Gray
Write-Host "GOVC_INSECURE: $env:GOVC_INSECURE" -ForegroundColor Gray

# Test 1: Basic connection test
Write-Host "`nTest 1: Basic connection test (govc about)" -ForegroundColor Yellow
try {
    $aboutResult = wsl bash -c "export GOVC_URL='$env:GOVC_URL' GOVC_USERNAME='$env:GOVC_USERNAME' GOVC_PASSWORD='$env:GOVC_PASSWORD' GOVC_INSECURE='$env:GOVC_INSECURE'; /usr/local/bin/govc about" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Basic connection successful!" -ForegroundColor Green
        Write-Host "$aboutResult" -ForegroundColor Gray
    } else {
        Write-Host "❌ Basic connection failed" -ForegroundColor Red
        Write-Host "Error: $aboutResult" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Exception during basic connection test: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: List datacenters
Write-Host "`nTest 2: List datacenters (govc find / -type d)" -ForegroundColor Yellow
try {
    $datacenterResult = wsl bash -c "export GOVC_URL='$env:GOVC_URL' GOVC_USERNAME='$env:GOVC_USERNAME' GOVC_PASSWORD='$env:GOVC_PASSWORD' GOVC_INSECURE='$env:GOVC_INSECURE'; /usr/local/bin/govc find / -type d" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Datacenter listing successful!" -ForegroundColor Green
        $datacenters = $datacenterResult -split "`n" | Where-Object { $_ -and $_ -notmatch "^/" -and $_ -match "/" }
        Write-Host "Found datacenters:" -ForegroundColor Cyan
        $datacenters | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
    } else {
        Write-Host "❌ Datacenter listing failed" -ForegroundColor Red
        Write-Host "Error: $datacenterResult" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Exception during datacenter test: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: List VM templates
Write-Host "`nTest 3: List VM templates (govc find / -type m)" -ForegroundColor Yellow
try {
    $templateResult = wsl bash -c "export GOVC_URL='$env:GOVC_URL' GOVC_USERNAME='$env:GOVC_USERNAME' GOVC_PASSWORD='$env:GOVC_PASSWORD' GOVC_INSECURE='$env:GOVC_INSECURE'; /usr/local/bin/govc find / -type m" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Template listing successful!" -ForegroundColor Green
        $templates = $templateResult -split "`n" | Where-Object { $_ -and $_ -match "template" }
        if ($templates) {
            Write-Host "Found VM templates:" -ForegroundColor Cyan
            $templates | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
        } else {
            Write-Host "No VM templates found (this may be normal)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Template listing failed" -ForegroundColor Red
        Write-Host "Error: $templateResult" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Exception during template test: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Test API endpoints with working govc
Write-Host "`n5. TESTING API ENDPOINTS WITH WORKING GOVC..." -ForegroundColor Yellow

# Update govc-helper.js to use WSL path
Write-Host "Updating govc-helper.js to use WSL govc path..." -ForegroundColor Cyan

$govcHelperPath = "c:\Users\mochtod\terraform-vsphere-vm-3\www\govc-helper.js"
$govcHelperContent = Get-Content $govcHelperPath -Raw

# Replace the GOVC_PATH to use WSL
$updatedContent = $govcHelperContent -replace "const GOVC_PATH = '/usr/local/bin/govc';", "const GOVC_PATH = 'wsl /usr/local/bin/govc';"

Set-Content $govcHelperPath $updatedContent
Write-Host "✅ Updated govc-helper.js to use WSL path" -ForegroundColor Green

# Restart the server to pick up the changes
Write-Host "`nRestarting server to pick up govc changes..." -ForegroundColor Yellow
# Note: We'll need to manually restart the server

Write-Host "`n6. NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Restart the Node.js server (Ctrl+C and restart)" -ForegroundColor Cyan
Write-Host "2. Test the web interface connection status" -ForegroundColor Cyan
Write-Host "3. Verify dropdowns populate with real data" -ForegroundColor Cyan

Write-Host "`n==============================================================================" -ForegroundColor Green
Write-Host "VSPHERE CONNECTION TEST COMPLETE" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
