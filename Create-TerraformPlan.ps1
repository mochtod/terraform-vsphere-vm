# Create-TerraformPlan.ps1
# This script creates a Terraform plan file with timestamp and stores it in the plans directory

param(
    [Parameter(Mandatory=$false)]
    [string]$VarFile = "machine_input.tfvars",
    
    [Parameter(Mandatory=$false)]
    [string]$Description = ""
)

# Create timestamp for the plan file
$timestamp = Get-Date -Format "yyyy-MM-dd-HHmm"
$vmName = ""

# Extract VM name from var file for the filename
if (Test-Path $VarFile) {
    $content = Get-Content $VarFile
    foreach ($line in $content) {
        if ($line -match 'vm_name\s*=\s*"([^"]+)"') {
            $vmName = $matches[1]
            break
        }
    }
}

# Create plan filename with VM name if available
if ($vmName) {
    $planFile = "plans\$vmName-$timestamp.tfplan"
} else {
    $planFile = "plans\terraform-plan-$timestamp.tfplan"
}

# Create a metadata file with description
if ($Description) {
    $metadataFile = $planFile + ".txt"
    @"
Plan created: $(Get-Date)
Variables file: $VarFile
Description: $Description
"@ | Out-File -FilePath $metadataFile
}

Write-Host "Creating Terraform plan using $VarFile..."
Write-Host "Plan will be saved to: $planFile"

# Run terraform plan with the output file option
terraform init
terraform plan -var-file="$VarFile" -out="$planFile"

Write-Host "`nPlan created successfully. To apply this plan, run:"
Write-Host "terraform apply `"$planFile`""

# Create a simple script to apply this specific plan
$applyScriptContent = @"
# Apply-$($vmName)-$timestamp.ps1
# This script applies the Terraform plan created on $timestamp

terraform apply "$planFile"
"@

$applyScriptPath = "plans\Apply-$($vmName)-$timestamp.ps1"
$applyScriptContent | Out-File -FilePath $applyScriptPath

Write-Host "Or run the apply script:"
Write-Host ".\$applyScriptPath"
