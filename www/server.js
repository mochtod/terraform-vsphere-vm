// Backend server for Terraform vSphere VM Provisioning Web App
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'www')));

// Directory for storing tfvars files
const TFVARS_DIR = path.join(__dirname, 'terraform_runs');
if (!fs.existsSync(TFVARS_DIR)) {
    fs.mkdirSync(TFVARS_DIR, { recursive: true });
}

// Helper function to generate a timestamp for filenames
function getTimestamp() {
    return new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
}

// Helper function to run terraform commands
function runTerraformCommand(command, args, workingDir, env = {}) {
    return new Promise((resolve, reject) => {
        console.log(`Running: terraform ${command} ${args.join(' ')}`);
        
        // Combine process.env with the provided env variables
        const processEnv = { ...process.env, ...env };
        
        const terraform = spawn('terraform', [command, ...args], {
            cwd: workingDir,
            env: processEnv
        });

        let stdout = '';
        let stderr = '';

        terraform.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            console.log(chunk);
        });

        terraform.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            console.error(chunk);
        });

        terraform.on('close', (code) => {
            if (code !== 0) {
                reject({ code, stderr, stdout });
            } else {
                resolve({ code, stdout, stderr });
            }
        });
    });
}

// Endpoint to save tfvars and generate terraform plan
app.post('/api/terraform/plan', async (req, res) => {
    try {
        const { vmVars, vspherePassword } = req.body;
        
        if (!vmVars || !vspherePassword) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Create a unique directory for this run
        const timestamp = getTimestamp();
        const vmName = vmVars.vm_name || 'default-vm';
        const runDir = path.join(TFVARS_DIR, `${vmName}-${timestamp}`);
        fs.mkdirSync(runDir, { recursive: true });

        // Save tfvars to file
        const tfvarsPath = path.join(runDir, `${vmName}.tfvars`);
        let tfvarsContent = '';
        
        // Convert vmVars object to tfvars format
        for (const [key, value] of Object.entries(vmVars)) {
            if (typeof value === 'string') {
                tfvarsContent += `${key} = "${value}"\n`;
            } else {
                tfvarsContent += `${key} = ${value}\n`;
            }
        }
        
        fs.writeFileSync(tfvarsPath, tfvarsContent);
        console.log(`Saved tfvars to ${tfvarsPath}`);

        // Set up environment for terraform
        const terraformDir = path.join(__dirname);
        const env = {
            'TF_VAR_vsphere_password': vspherePassword
        };

        // Run terraform init if needed
        await runTerraformCommand('init', [], terraformDir, env);

        // Run terraform validate
        await runTerraformCommand('validate', [], terraformDir, env);

        // Run terraform plan
        const planPath = path.join(runDir, `${vmName}.tfplan`);
        const planResult = await runTerraformCommand('plan', [
            '-var-file', tfvarsPath,
            '-out', planPath
        ], terraformDir, env);

        res.json({
            success: true,
            message: 'Plan generated successfully',
            planOutput: planResult.stdout,
            planPath: planPath,
            runDir: runDir
        });
    } catch (error) {
        console.error('Error generating plan:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating plan',
            error: error.stdout || error.stderr || error.message
        });
    }
});

// Endpoint to apply terraform plan
app.post('/api/terraform/apply', async (req, res) => {
    try {
        const { planPath, vspherePassword } = req.body;
        
        if (!planPath) {
            return res.status(400).json({ error: 'Missing plan path' });
        }

        // Check if the plan file exists
        if (!fs.existsSync(planPath)) {
            return res.status(404).json({ error: 'Plan file not found' });
        }

        // Set up environment for terraform
        const terraformDir = path.join(__dirname);
        const env = {
            'TF_VAR_vsphere_password': vspherePassword
        };

        // Run terraform apply
        const applyResult = await runTerraformCommand('apply', [
            planPath
        ], terraformDir, env);

        res.json({
            success: true,
            message: 'Terraform apply completed successfully',
            applyOutput: applyResult.stdout
        });
    } catch (error) {
        console.error('Error applying terraform:', error);
        res.status(500).json({
            success: false,
            message: 'Error applying terraform',
            error: error.stdout || error.stderr || error.message
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the web interface at http://localhost:${PORT}`);
});
