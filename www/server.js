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
app.use(express.static(__dirname));

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
        console.log(`Saved tfvars to ${tfvarsPath}`);        // Set up environment for terraform
        const terraformDir = path.join(__dirname, '..');  // Go up one directory to the root where .tf files are
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
        const { planPath, vspherePassword, runDir } = req.body;
        
        if (!planPath) {
            return res.status(400).json({ error: 'Missing plan path' });
        }        // Check if the plan file exists
        if (!fs.existsSync(planPath)) {
            return res.status(404).json({ error: 'Plan file not found' });
        }

        // Set up environment for terraform
        const terraformDir = path.join(__dirname, '..'); // Go up one directory to the root where .tf files are
        const env = {
            'TF_VAR_vsphere_password': vspherePassword
        };

        // Create a status file to track this deployment
        const statusFilePath = path.join(runDir, 'status.json');
        const statusData = {
            status: 'running',
            startTime: new Date().toISOString(),
            planPath: planPath,
            logs: []
        };
        fs.writeFileSync(statusFilePath, JSON.stringify(statusData, null, 2));

        // Run terraform apply
        console.log('Applying terraform plan:', planPath);
        
        // Run terraform apply
        const applyResult = await runTerraformCommand('apply', [
            planPath
        ], terraformDir, env);

        // Update status file with success
        const updatedStatus = {
            ...statusData,
            status: 'completed',
            endTime: new Date().toISOString(),
            logs: statusData.logs.concat({
                time: new Date().toISOString(),
                message: 'Terraform apply completed successfully'
            }),
            output: applyResult.stdout
        };
        fs.writeFileSync(statusFilePath, JSON.stringify(updatedStatus, null, 2));

        res.json({
            success: true,
            message: 'Terraform apply completed successfully',
            applyOutput: applyResult.stdout,
            vmId: extractVmIdFromOutput(applyResult.stdout),
            statusFile: statusFilePath
        });
    } catch (error) {
        console.error('Error applying terraform:', error);
        
        // Update status file with error
        if (req.body.runDir) {
            const statusFilePath = path.join(req.body.runDir, 'status.json');
            if (fs.existsSync(statusFilePath)) {
                try {
                    const statusData = JSON.parse(fs.readFileSync(statusFilePath));
                    const updatedStatus = {
                        ...statusData,
                        status: 'failed',
                        endTime: new Date().toISOString(),
                        logs: statusData.logs.concat({
                            time: new Date().toISOString(),
                            message: 'Terraform apply failed',
                            error: error.stdout || error.stderr || error.message
                        }),
                        error: error.stdout || error.stderr || error.message
                    };
                    fs.writeFileSync(statusFilePath, JSON.stringify(updatedStatus, null, 2));
                } catch (statusError) {
                    console.error('Error updating status file:', statusError);
                }
            }
        }
        
        res.status(500).json({
            success: false,
            message: 'Error applying terraform',
            error: error.stdout || error.stderr || error.message
        });
    }
});

// Helper function to extract VM ID from terraform output
function extractVmIdFromOutput(output) {
    // This pattern will need to be adjusted based on your actual terraform outputs
    const vmIdMatch = output.match(/VM ID: ([a-zA-Z0-9-]+)/);
    return vmIdMatch ? vmIdMatch[1] : null;
}

// Endpoint to check the status of a terraform deployment
app.get('/api/terraform/status/:runDir', (req, res) => {
    try {
        const runDirName = req.params.runDir;
        const statusFilePath = path.join(TFVARS_DIR, runDirName, 'status.json');
        
        if (!fs.existsSync(statusFilePath)) {
            return res.status(404).json({ error: 'Status file not found' });
        }
        
        const statusData = JSON.parse(fs.readFileSync(statusFilePath));
        res.json(statusData);
    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking deployment status',
            error: error.message
        });
    }
});

// Endpoint to list all terraform deployments
app.get('/api/terraform/deployments', (req, res) => {
    try {
        const deployments = [];
        const dirs = fs.readdirSync(TFVARS_DIR);
        
        for (const dir of dirs) {
            const dirPath = path.join(TFVARS_DIR, dir);
            const stats = fs.statSync(dirPath);
            
            if (stats.isDirectory()) {
                const statusFilePath = path.join(dirPath, 'status.json');
                let status = 'unknown';
                let startTime = stats.ctime;
                let vmName = dir;
                
                if (fs.existsSync(statusFilePath)) {
                    try {
                        const statusData = JSON.parse(fs.readFileSync(statusFilePath));
                        status = statusData.status;
                        startTime = statusData.startTime || startTime;
                        vmName = statusData.vmName || vmName;
                    } catch (e) {
                        console.error(`Error reading status file in ${dir}:`, e);
                    }
                }
                
                deployments.push({
                    id: dir,
                    name: vmName,
                    status: status,
                    startTime: startTime,
                    path: dirPath
                });
            }
        }
        
        // Sort by start time, newest first
        deployments.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        
        res.json(deployments);
    } catch (error) {
        console.error('Error listing deployments:', error);
        res.status(500).json({
            success: false,
            message: 'Error listing deployments',
            error: error.message
        });
    }
});

// Endpoint to destroy a VM
app.post('/api/terraform/destroy', async (req, res) => {
    try {
        const { runDir, vspherePassword } = req.body;
        
        if (!runDir) {
            return res.status(400).json({ error: 'Missing run directory' });
        }

        // Check if the directory exists
        const fullRunDir = path.join(TFVARS_DIR, runDir);
        if (!fs.existsSync(fullRunDir)) {
            return res.status(404).json({ error: 'Run directory not found' });
        }

        // Find the tfvars file in the directory
        const files = fs.readdirSync(fullRunDir);
        const tfvarsFile = files.find(file => file.endsWith('.tfvars'));
        
        if (!tfvarsFile) {
            return res.status(404).json({ error: 'Tfvars file not found in run directory' });
        }        const tfvarsPath = path.join(fullRunDir, tfvarsFile);

        // Set up environment for terraform
        const terraformDir = path.join(__dirname, '..'); // Go up one directory to the root where .tf files are
        const env = {
            'TF_VAR_vsphere_password': vspherePassword
        };

        // Create or update the status file
        const statusFilePath = path.join(fullRunDir, 'status.json');
        let statusData = {
            status: 'destroying',
            startTime: new Date().toISOString(),
            logs: []
        };
        
        if (fs.existsSync(statusFilePath)) {
            try {
                const existingStatus = JSON.parse(fs.readFileSync(statusFilePath));
                statusData = {
                    ...existingStatus,
                    status: 'destroying',
                    destroyStartTime: new Date().toISOString(),
                    logs: existingStatus.logs.concat({
                        time: new Date().toISOString(),
                        message: 'Starting destroy operation'
                    })
                };
            } catch (e) {
                console.error('Error reading existing status file:', e);
            }
        }
        
        fs.writeFileSync(statusFilePath, JSON.stringify(statusData, null, 2));

        // Run terraform destroy
        console.log('Destroying infrastructure for:', runDir);
        const destroyResult = await runTerraformCommand('destroy', [
            '-auto-approve',
            '-var-file', tfvarsPath
        ], terraformDir, env);

        // Update status file with success
        const updatedStatus = {
            ...statusData,
            status: 'destroyed',
            destroyEndTime: new Date().toISOString(),
            logs: statusData.logs.concat({
                time: new Date().toISOString(),
                message: 'Terraform destroy completed successfully'
            }),
            destroyOutput: destroyResult.stdout
        };
        fs.writeFileSync(statusFilePath, JSON.stringify(updatedStatus, null, 2));

        res.json({
            success: true,
            message: 'Terraform destroy completed successfully',
            destroyOutput: destroyResult.stdout
        });
    } catch (error) {
        console.error('Error destroying infrastructure:', error);
        
        // Update status file with error
        if (req.body.runDir) {
            const statusFilePath = path.join(TFVARS_DIR, req.body.runDir, 'status.json');
            if (fs.existsSync(statusFilePath)) {
                try {
                    const statusData = JSON.parse(fs.readFileSync(statusFilePath));
                    const updatedStatus = {
                        ...statusData,
                        status: 'destroy_failed',
                        destroyEndTime: new Date().toISOString(),
                        logs: statusData.logs.concat({
                            time: new Date().toISOString(),
                            message: 'Terraform destroy failed',
                            error: error.stdout || error.stderr || error.message
                        }),
                        destroyError: error.stdout || error.stderr || error.message
                    };
                    fs.writeFileSync(statusFilePath, JSON.stringify(updatedStatus, null, 2));
                } catch (statusError) {
                    console.error('Error updating status file:', statusError);
                }
            }
        }
        
        res.status(500).json({
            success: false,
            message: 'Error destroying infrastructure',
            error: error.stdout || error.stderr || error.message
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the web interface at http://localhost:${PORT}`);
});
