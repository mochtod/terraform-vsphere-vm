#!/bin/bash
# create-terraform-plan.sh
# This script creates a Terraform plan file with timestamp and stores it in the plans directory
# It also handles vSphere credentials securely using environment variables

# Source global settings from JSON if available
if [ -f "./load-global-settings.sh" ]; then
  echo "Loading credentials from global_settings.json"
  source ./load-global-settings.sh
  
  # Print credential debug info (but hide full password)
  echo "=== Credential Verification ==="
  echo "vSphere User: '$TF_VAR_vsphere_user'"
  echo "vSphere Server: '$TF_VAR_vsphere_server'"
  echo "vSphere Password: First 3 chars '${TF_VAR_vsphere_password:0:3}***'"
  echo "=========================="
else
  echo "Warning: load-global-settings.sh not found. Will use command line or environment variables for credentials."
fi

# Default values
VAR_FILE="machine_input.tfvars"
DESCRIPTION=""
USE_ENV_VARS=false

# Process command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -v|--var-file) VAR_FILE="$2"; shift ;;
        -d|--description) DESCRIPTION="$2"; shift ;;
        -s|--secure) USE_ENV_VARS=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Create timestamp for the plan file
TIMESTAMP=$(date +"%Y-%m-%d-%H%M")
VM_NAME=""

# Extract VM name from var file for the filename
if [ -f "$VAR_FILE" ]; then
    VM_NAME=$(grep -E 'vm_name\s*=\s*"([^"]+)"' "$VAR_FILE" | sed -E 's/.*"([^"]+)".*/\1/')
fi

# Create plans directory if it doesn't exist
mkdir -p plans

# Create plan filename with VM name if available
if [ -n "$VM_NAME" ]; then
    PLAN_FILE="plans/${VM_NAME}-${TIMESTAMP}.tfplan"
else
    PLAN_FILE="plans/terraform-plan-${TIMESTAMP}.tfplan"
fi

# Handle credentials securely if requested
if [ "$USE_ENV_VARS" = true ]; then
    # Check if environment variables exist, otherwise prompt for them
    if [ -z "$TF_VAR_vsphere_user" ]; then
        read -p "Enter vSphere username: " VSPHERE_USER
        export TF_VAR_vsphere_user="$VSPHERE_USER"
    fi
    
    if [ -z "$TF_VAR_vsphere_password" ]; then
        read -sp "Enter vSphere password: " VSPHERE_PASSWORD
        echo
        export TF_VAR_vsphere_password="$VSPHERE_PASSWORD"
    fi
    
    if [ -z "$TF_VAR_vsphere_server" ]; then
        read -p "Enter vSphere server: " VSPHERE_SERVER
        export TF_VAR_vsphere_server="$VSPHERE_SERVER"
    fi
    
    echo "Using environment variables for vSphere credentials"
fi

# Create a metadata file with description
if [ -n "$DESCRIPTION" ]; then
    METADATA_FILE="${PLAN_FILE}.txt"
    cat > "$METADATA_FILE" << EOF
Plan created: $(date)
Variables file: $VAR_FILE
Description: $DESCRIPTION
EOF
fi

echo "Creating Terraform plan using $VAR_FILE..."
echo "Plan will be saved to: $PLAN_FILE"

# Run terraform plan with the output file option
terraform init

# Add secure option to plan command if using environment variables
if [ "$USE_ENV_VARS" = true ]; then
    # Create a temporary tfvars file without sensitive information
    TMP_VAR_FILE="plans/temp-${TIMESTAMP}.tfvars"
    grep -v "vsphere_\(user\|password\|server\)" "$VAR_FILE" > "$TMP_VAR_FILE"
    
    terraform plan -var-file="$TMP_VAR_FILE" -out="$PLAN_FILE"
    
    # Clean up temporary file
    rm "$TMP_VAR_FILE"
else
    terraform plan -var-file="$VAR_FILE" -out="$PLAN_FILE"
fi

echo -e "\nPlan created successfully. To apply this plan, run:"
echo "terraform apply \"$PLAN_FILE\""

# Create a simple script to apply this specific plan
APPLY_SCRIPT="plans/apply-${VM_NAME:+$VM_NAME-}${TIMESTAMP}.sh"
cat > "$APPLY_SCRIPT" << EOF
#!/bin/bash
# apply-${VM_NAME:+$VM_NAME-}${TIMESTAMP}.sh
# This script applies the Terraform plan created on $(date)

terraform apply "$PLAN_FILE"
EOF

# Make the apply script executable
chmod +x "$APPLY_SCRIPT"

echo "Or run the apply script:"
echo "./$APPLY_SCRIPT"
