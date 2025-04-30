# Terraform vSphere Security Best Practices

This guide outlines security best practices for working with Terraform to deploy vSphere VMs.

## Credential Handling

### Do NOT:
- Hard-code credentials in `.tf` or `.tfvars` files
- Store unencrypted credentials in version control
- Share credentials in plain text

### DO:
- Use environment variables for credentials
- Use a secure vault solution where possible
- Use the provided credential scripts

## Environment Variables

Set credentials using environment variables:

**Bash (WSL/Linux):**
```bash
export TF_VAR_vsphere_user="your-username"
export TF_VAR_vsphere_password="your-password"
export TF_VAR_vsphere_server="your-vsphere-server"
```

**PowerShell:**
```powershell
$env:TF_VAR_vsphere_user="your-username"
$env:TF_VAR_vsphere_password="your-password"
$env:TF_VAR_vsphere_server="your-vsphere-server"
```

## Using the Secure Deployment Scripts

### Bash Script (WSL/Linux)

Run the secure deployment script:
```bash
./create-terraform-plan.sh -v machine_input.tfvars -d "Description of deployment" -s
```

The `-s` flag enables secure mode, which:
1. Uses environment variables for authentication
2. Creates a temporary tfvars file without sensitive data
3. Automatically cleans up temporary files

### PowerShell Script (Windows)

```powershell
.\Create-TerraformPlan.ps1 -VarFile "machine_input.tfvars" -Description "Description of deployment"
```

## Terraform State Security

Terraform state files may contain sensitive information. Consider:

1. Using remote state storage with access controls
2. Encrypting the state at rest
3. Limiting access to state files

## Regular Security Audits

Regularly audit your Terraform configurations:

1. Check for hardcoded secrets
2. Ensure `.gitignore` is working properly
3. Review access to state files and plan files

## Additional Resources

- [Terraform Security Best Practices](https://developer.hashicorp.com/terraform/tutorials/configuration-language/sensitive-variables)
- [HashiCorp Vault Integration](https://developer.hashicorp.com/terraform/tutorials/secrets/secrets-vault)
