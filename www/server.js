// Backend server for Terraform vSphere VM Provisioning Web App
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Register vSphere API routes - Explicitly require the module here
const vsphereRouter = require('./vsphere-api');
app.use('/api/vsphere', vsphereRouter);

// Register vSphere Infrastructure API routes
const vsphereInfraRouter = require('./vsphere-infra-api');
app.use('/api/vsphere-infra', vsphereInfraRouter);

// Register settings module
const settings = require('./settings');
settings.initializeSettings(); // Initialize settings on server start

// Register satellite API routes
const satelliteRouter = require('./satellite-api-server');
app.use('/api/satellite', satelliteRouter);

// Directory for storing tfvars files
const TFVARS_DIR = path.join(__dirname, 'terraform_runs');
if (!fs.existsSync(TFVARS_DIR)) {
    fs.mkdirSync(TFVARS_DIR, { recursive: true });
}

// Directory for storing VM workspaces
const WORKSPACES_DIR = path.join(__dirname, 'vm_workspaces');
if (!fs.existsSync(WORKSPACES_DIR)) {
    fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
}

// Directory for storing Terraform configuration files
const TF_CONFIGS_DIR = path.join(__dirname, 'terraform_configs');
if (!fs.existsSync(TF_CONFIGS_DIR)) {
    fs.mkdirSync(TF_CONFIGS_DIR, { recursive: true });
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

// Helper function to copy Terraform files to a workspace directory
async function setupTerraformWorkspace(workspaceId, vmName) {
    const workspaceTfDir = path.join(TF_CONFIGS_DIR, workspaceId);
    
    // Create workspace directory if it doesn't exist
    if (!fs.existsSync(workspaceTfDir)) {
        fs.mkdirSync(workspaceTfDir, { recursive: true });
    }
    
    // Copy the main Terraform files from the root to the workspace directory
    const rootTfDir = path.join(__dirname, '..');
    const filesToCopy = [
        'main.tf',
        'variables.tf',
        'outputs.tf',
        'providers.tf'
    ];
    
    for (const file of filesToCopy) {
        const sourcePath = path.join(rootTfDir, file);
        const destPath = path.join(workspaceTfDir, file);
        
        if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, destPath);
            console.log(`Copied ${file} to workspace ${workspaceId}`);
        }
    }
    
    // Copy modules directory if it exists
    const sourceModulesDir = path.join(rootTfDir, 'modules');
    const destModulesDir = path.join(workspaceTfDir, 'modules');
    
    if (fs.existsSync(sourceModulesDir)) {
        if (!fs.existsSync(destModulesDir)) {
            fs.mkdirSync(destModulesDir, { recursive: true });
        }
        
        copyDirRecursive(sourceModulesDir, destModulesDir);
        console.log(`Copied modules directory to workspace ${workspaceId}`);
    }
    
    // Initialize the new workspace
    return workspaceTfDir;
}

// Helper function to recursively copy directories
function copyDirRecursive(source, destination) {
    const entries = fs.readdirSync(source, { withFileTypes: true });
    
    for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);
        
        if (entry.isDirectory()) {
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
            }
            copyDirRecursive(sourcePath, destPath);
        } else {
            fs.copyFileSync(sourcePath, destPath);
        }
    }
}

// Endpoint to save tfvars and generate terraform plan
app.post('/api/terraform/plan', async (req, res) => {
    try {
        const { vmVars, vspherePassword, workspaceId } = req.body;
        
        // Get global settings to use if needed
        const globalSettings = settings.getSettings();
        
        // Add detailed logging to troubleshoot the request
        console.log('Plan request received with:', {
            hasVmVars: !!vmVars,
            hasPassword: !!vspherePassword,
            workspaceId: workspaceId || 'not provided',
            hasGlobalSettings: !!globalSettings
        });
        
        if (!vmVars) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required parameters: vmVars'
            });
        }
        
        // Use password from request or fall back to global settings
        const effectivePassword = vspherePassword || 
                                 (globalSettings.vsphere && globalSettings.vsphere.password) || 
                                 null;
        
        if (!effectivePassword) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing vSphere password. Please provide a password.'
            });
        }

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                error: 'Workspace ID is required. Please select or create a workspace first.'
            });
        }

        // Check if workspace exists
        const workspacePath = path.join(WORKSPACES_DIR, `${workspaceId}.json`);
        if (!fs.existsSync(workspacePath)) {
            return res.status(404).json({ 
                success: false, 
                error: `Workspace not found with ID: ${workspaceId}` 
            });
        }

        // Get workspace data
        const workspace = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
        const vmName = vmVars.vm_name || 'default-vm';
        
        // Create a unique directory for this run
        const timestamp = getTimestamp();
        const runDir = path.join(TFVARS_DIR, `${vmName}-${timestamp}`);
        fs.mkdirSync(runDir, { recursive: true });

        // Save tfvars to file
        const tfvarsPath = path.join(runDir, `${vmName}.tfvars`);
        let tfvarsContent = '';
        
        // Add vSphere connection details from global settings
        if (globalSettings && globalSettings.vsphere) {
            // Include the server and user from global settings
            if (globalSettings.vsphere.server) {
                tfvarsContent += `vsphere_server = "${globalSettings.vsphere.server}"\n`;
            }
            if (globalSettings.vsphere.user) {
                // Properly escape backslashes in the vSphere user
                const escapedUser = globalSettings.vsphere.user.replace(/\\/g, '\\\\');
                tfvarsContent += `vsphere_user = "${escapedUser}"\n`;
            }
        }
        
        // Convert vmVars object to tfvars format
        for (const [key, value] of Object.entries(vmVars)) {
            // Skip vsphere_server and vsphere_user if already set from global settings
            if (key === 'vsphere_server' || key === 'vsphere_user') {
                continue;
            }
            
            if (typeof value === 'string') {
                // Properly escape backslashes in string values
                const escapedValue = value.replace(/\\/g, '\\\\');
                tfvarsContent += `${key} = "${escapedValue}"\n`;
            } else {
                tfvarsContent += `${key} = ${value}\n`;
            }
        }
        
        fs.writeFileSync(tfvarsPath, tfvarsContent);
        console.log(`Saved tfvars to ${tfvarsPath}`);

        // Set up the isolated Terraform workspace
        const terraformWorkspaceDir = await setupTerraformWorkspace(workspaceId, vmName);
        
        // Set up environment for terraform
        const env = {
            'TF_VAR_vsphere_password': effectivePassword
        };

        // Run terraform init in the workspace directory
        await runTerraformCommand('init', [], terraformWorkspaceDir, env);

        // Run terraform validate
        await runTerraformCommand('validate', [], terraformWorkspaceDir, env);

        // Run terraform plan
        const planPath = path.join(runDir, `${vmName}.tfplan`);
        const planResult = await runTerraformCommand('plan', [
            '-var-file', tfvarsPath,
            '-out', planPath
        ], terraformWorkspaceDir, env);

        // Update the workspace data
        workspace.planPath = planPath;
        workspace.runDir = runDir;
        workspace.terraformDir = terraformWorkspaceDir;
        workspace.tfvarsPath = tfvarsPath;
        workspace.planOutput = planResult.stdout;
        workspace.lastPlanned = new Date().toISOString();
        workspace.status = 'planned';
        
        fs.writeFileSync(workspacePath, JSON.stringify(workspace, null, 2));

        res.json({
            success: true,
            message: 'Plan generated successfully',
            planOutput: planResult.stdout,
            planPath: planPath,
            runDir: runDir,
            terraformDir: terraformWorkspaceDir
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
        const { planPath, vspherePassword, runDir, workspaceId } = req.body;
        
        // Get global settings
        const globalSettings = settings.getSettings();
        
        if (!planPath || !workspaceId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        // Use password from request or fall back to global settings
        const effectivePassword = vspherePassword || 
                                (globalSettings.vsphere && globalSettings.vsphere.password) || 
                                null;
        
        if (!effectivePassword) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing vSphere password. Please provide a password.'
            });
        }

        // Check if workspace exists
        const workspacePath = path.join(WORKSPACES_DIR, `${workspaceId}.json`);
        if (!fs.existsSync(workspacePath)) {
            return res.status(404).json({ 
                success: false, 
                error: 'Workspace not found' 
            });
        }

        // Get workspace data to find the terraform directory
        const workspace = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
        
        if (!workspace.terraformDir) {
            return res.status(400).json({ 
                success: false, 
                error: 'No Terraform directory found for this workspace. Please run plan first.' 
            });
        }

        // Check if the terraform directory exists
        if (!fs.existsSync(workspace.terraformDir)) {
            return res.status(404).json({ 
                success: false, 
                error: 'Terraform directory not found' 
            });
        }

        // Check if the plan file exists
        if (!fs.existsSync(planPath)) {
            return res.status(404).json({ error: 'Plan file not found' });
        }

        // Set up environment for terraform
        const env = {
            'TF_VAR_vsphere_password': effectivePassword
        };

        // Check plan age and refresh state if needed
        const planStats = fs.statSync(planPath);
        const planAgeMinutes = (Date.now() - planStats.mtime.getTime()) / (1000 * 60);
        const maxPlanAgeMinutes = 30; // Consider plan stale after 30 minutes

        console.log(`Plan file age: ${planAgeMinutes.toFixed(1)} minutes`);

        if (planAgeMinutes > maxPlanAgeMinutes) {
            console.log('Plan is older than 30 minutes, refreshing state and regenerating plan...');
            
            // First, refresh the state to get latest infrastructure changes
            try {
                console.log('Refreshing Terraform state...');
                await runTerraformCommand('refresh', [
                    '-var-file', workspace.tfvarsPath
                ], workspace.terraformDir, env);
                
                // Regenerate the plan to ensure it's current
                console.log('Regenerating plan after state refresh...');
                const newPlanResult = await runTerraformCommand('plan', [
                    '-var-file', workspace.tfvarsPath,
                    '-out', planPath
                ], workspace.terraformDir, env);
                
                // Update workspace with new plan output
                workspace.planOutput = newPlanResult.stdout;
                workspace.lastPlanned = new Date().toISOString();
                fs.writeFileSync(workspacePath, JSON.stringify(workspace, null, 2));
                
                console.log('Plan refreshed successfully');
                
            } catch (refreshError) {
                console.warn('State refresh failed, attempting to apply existing plan:', refreshError.message);
                // Continue with existing plan if refresh fails
            }
        }        // Create a status file to track this deployment
        const statusFilePath = path.join(runDir, 'status.json');
        const statusData = {
            status: 'running',
            startTime: new Date().toISOString(),
            planPath: planPath,
            logs: []
        };
        fs.writeFileSync(statusFilePath, JSON.stringify(statusData, null, 2));

        // Run terraform apply from the workspace directory with retry logic for stale plans
        console.log('Applying terraform plan:', planPath);
        
        let applyResult;
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount <= maxRetries) {
            try {
                applyResult = await runTerraformCommand('apply', [
                    planPath
                ], workspace.terraformDir, env);
                
                // If apply succeeds, break out of retry loop
                break;
                
            } catch (applyError) {
                console.log(`Apply attempt ${retryCount + 1} failed:`, applyError.message);
                
                // Check if it's a stale plan error
                if (applyError.stderr && applyError.stderr.includes('Saved plan is stale')) {
                    console.log('Detected stale plan error, attempting to refresh and regenerate plan...');
                    
                    if (retryCount < maxRetries) {
                        try {
                            // Refresh state
                            console.log('Refreshing Terraform state...');
                            await runTerraformCommand('refresh', [
                                '-var-file', workspace.tfvarsPath
                            ], workspace.terraformDir, env);
                            
                            // Generate new plan
                            console.log('Generating new plan...');
                            const newPlanResult = await runTerraformCommand('plan', [
                                '-var-file', workspace.tfvarsPath,
                                '-out', planPath
                            ], workspace.terraformDir, env);
                            
                            // Update workspace with new plan
                            workspace.planOutput = newPlanResult.stdout;
                            workspace.lastPlanned = new Date().toISOString();
                            fs.writeFileSync(workspacePath, JSON.stringify(workspace, null, 2));
                            
                            console.log(`Plan regenerated, retrying apply (attempt ${retryCount + 2})...`);
                            retryCount++;
                            continue;
                            
                        } catch (retryError) {
                            console.error('Failed to refresh state and regenerate plan:', retryError.message);
                            throw applyError; // Throw original error if refresh fails
                        }
                    } else {
                        console.error('Max retries reached for stale plan error');
                        throw applyError;
                    }
                } else {
                    // Not a stale plan error, don't retry
                    throw applyError;
                }
            }
        }

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

        // Extract VM ID from output
        const vmId = extractVmIdFromOutput(applyResult.stdout);

        // Update the workspace data
        workspace.applyOutput = applyResult.stdout;
        workspace.vmId = vmId;
        workspace.status = 'deployed';
        workspace.lastDeployed = new Date().toISOString();
        
        // Note: AAP job launch is now handled through the VM Customization UI
        // instead of being triggered automatically here

        fs.writeFileSync(workspacePath, JSON.stringify(workspace, null, 2));

        res.json({
            success: true,
            message: 'Terraform apply completed successfully',
            applyOutput: applyResult.stdout,
            vmId: vmId,
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
                            error: error.stderr || error.message
                        }),
                        error: error.stderr || error.message
                    };
                    fs.writeFileSync(statusFilePath, JSON.stringify(updatedStatus, null, 2));
                } catch (statusError) {
                    console.error('Error updating status file:', statusError);
                }
            }
        }

        // Update workspace data with error if we have a workspace ID
        if (req.body.workspaceId) {
            try {
                const workspacePath = path.join(WORKSPACES_DIR, `${req.body.workspaceId}.json`);
                if (fs.existsSync(workspacePath)) {
                    const workspace = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
                    
                    workspace.status = 'failed';
                    workspace.error = error.stderr || error.message;
                    workspace.lastUpdated = new Date().toISOString();
                    
                    fs.writeFileSync(workspacePath, JSON.stringify(workspace, null, 2));
                }
            } catch (wsError) {
                console.error('Error updating workspace data:', wsError);
            }
        }
          res.status(500).json({
            success: false,
            message: 'Error applying terraform',
            error: error.stdout || error.stderr || error.message
        });
    }
});

// Endpoint to refresh a stale plan
app.post('/api/terraform/refresh-plan', async (req, res) => {
    try {
        const { workspaceId, vspherePassword } = req.body;
        
        // Get global settings
        const globalSettings = settings.getSettings();
        
        if (!workspaceId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Workspace ID is required' 
            });
        }
        
        // Use password from request or fall back to global settings
        const effectivePassword = vspherePassword || 
                                 (globalSettings.vsphere && globalSettings.vsphere.password) || 
                                 null;
        
        if (!effectivePassword) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing vSphere password. Please provide a password.'
            });
        }

        // Check if workspace exists
        const workspacePath = path.join(WORKSPACES_DIR, `${workspaceId}.json`);
        if (!fs.existsSync(workspacePath)) {
            return res.status(404).json({ 
                success: false, 
                error: 'Workspace not found' 
            });
        }

        // Get workspace data
        const workspace = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
        
        if (!workspace.terraformDir || !workspace.tfvarsPath) {
            return res.status(400).json({ 
                success: false, 
                error: 'Workspace not properly configured. Please run plan first.' 
            });
        }

        // Set up environment for terraform
        const env = {
            'TF_VAR_vsphere_password': effectivePassword
        };

        console.log('Refreshing workspace plan for:', workspaceId);

        // Refresh the state
        console.log('Refreshing Terraform state...');
        await runTerraformCommand('refresh', [
            '-var-file', workspace.tfvarsPath
        ], workspace.terraformDir, env);

        // Generate new plan
        console.log('Generating new plan...');
        const planResult = await runTerraformCommand('plan', [
            '-var-file', workspace.tfvarsPath,
            '-out', workspace.planPath
        ], workspace.terraformDir, env);

        // Update the workspace data
        workspace.planOutput = planResult.stdout;
        workspace.lastPlanned = new Date().toISOString();
        workspace.status = 'planned';
        workspace.error = null; // Clear any previous errors
        
        fs.writeFileSync(workspacePath, JSON.stringify(workspace, null, 2));

        res.json({
            success: true,
            message: 'Plan refreshed successfully',
            planOutput: planResult.stdout,
            lastPlanned: workspace.lastPlanned
        });
        
    } catch (error) {
        console.error('Error refreshing plan:', error);
        
        // Update workspace with error if we have workspace ID
        if (req.body.workspaceId) {
            try {
                const workspacePath = path.join(WORKSPACES_DIR, `${req.body.workspaceId}.json`);
                if (fs.existsSync(workspacePath)) {
                    const workspace = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
                    workspace.error = error.stderr || error.message;
                    workspace.lastUpdated = new Date().toISOString();
                    fs.writeFileSync(workspacePath, JSON.stringify(workspace, null, 2));
                }
            } catch (wsError) {
                console.error('Error updating workspace with refresh error:', wsError);
            }
        }
        
        res.status(500).json({
            success: false,
            message: 'Error refreshing plan',
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

// Workspace management endpoint - manage workspace state changes
// Combined endpoint to handle workspace operations (replaces the separate destroy endpoints)
app.post('/api/terraform/manage-workspace', async (req, res) => {
    try {
        const { operation, workspaceId, vspherePassword } = req.body;
        
        if (!workspaceId || !operation) {
            return res.status(400).json({ 
                success: false, 
                error: 'Workspace ID and operation are required' 
            });
        }

        // Check if workspace exists
        const workspacePath = path.join(WORKSPACES_DIR, `${workspaceId}.json`);
        if (!fs.existsSync(workspacePath)) {
            return res.status(404).json({ 
                success: false, 
                error: 'Workspace not found' 
            });
        }

        // Get workspace data
        const workspace = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
        
        // Handle operation based on the requested action
        switch (operation) {
            case 'reset':
                // Update workspace status to reset
                workspace.status = 'reset';
                workspace.lastUpdated = new Date().toISOString();
                fs.writeFileSync(workspacePath, JSON.stringify(workspace, null, 2));
                
                res.json({
                    success: true,
                    message: 'Workspace has been reset and is ready for new configurations',
                    workspace
                });
                break;
                
            case 'archive':
                // Mark the workspace as archived
                workspace.status = 'archived';
                workspace.lastUpdated = new Date().toISOString();
                fs.writeFileSync(workspacePath, JSON.stringify(workspace, null, 2));
                
                res.json({
                    success: true,
                    message: 'Workspace has been archived',
                    workspace
                });
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    error: `Unknown operation: ${operation}. Supported operations are: reset, archive`
                });
        }
    } catch (error) {
        console.error('Error managing workspace:', error);
        res.status(500).json({
            success: false,
            message: 'Error managing workspace',
            error: error.message
        });
    }
});

// Get all workspaces
app.get('/api/workspaces', (req, res) => {
    try {
        // Read the workspaces directory and get all workspace files
        const workspaceFiles = fs.readdirSync(WORKSPACES_DIR)
            .filter(file => file.endsWith('.json'));
        
        const workspaces = workspaceFiles.map(file => {
            try {
                const workspacePath = path.join(WORKSPACES_DIR, file);
                const workspaceData = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
                return {
                    id: workspaceData.id,
                    name: workspaceData.name,
                    createdAt: workspaceData.createdAt,
                    status: workspaceData.status || 'created'
                };
            } catch (error) {
                console.error(`Error reading workspace file ${file}:`, error);
                return null;
            }
        }).filter(Boolean); // Remove any null entries
        
        res.json({ success: true, workspaces });
    } catch (error) {
        console.error('Error getting workspaces:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get a specific workspace
app.get('/api/workspaces/:id', (req, res) => {
    try {
        const workspaceId = req.params.id;
        const workspacePath = path.join(WORKSPACES_DIR, `${workspaceId}.json`);
        
        if (!fs.existsSync(workspacePath)) {
            return res.status(404).json({ success: false, error: 'Workspace not found' });
        }
        
        const workspace = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
        res.json({ success: true, workspace });
    } catch (error) {
        console.error('Error getting workspace:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create a new workspace
app.post('/api/workspaces/create', async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, error: 'Workspace name is required' });
        }
        
        const workspaceId = uuidv4();
        const workspace = {
            id: workspaceId,
            name,
            createdAt: new Date().toISOString(),
            config: {},
            status: 'created'
        };
        
        // Create the workspace directory for Terraform files
        const workspaceTfDir = path.join(TF_CONFIGS_DIR, workspaceId);
        if (!fs.existsSync(workspaceTfDir)) {
            fs.mkdirSync(workspaceTfDir, { recursive: true });
        }
        
        // Save workspace data
        const workspacePath = path.join(WORKSPACES_DIR, `${workspaceId}.json`);
        fs.writeFileSync(workspacePath, JSON.stringify(workspace, null, 2));
        
        res.json({ success: true, workspace });
    } catch (error) {
        console.error('Error creating workspace:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update workspace config
app.post('/api/workspaces/:id/config', (req, res) => {
    try {
        const workspaceId = req.params.id;
        const { config, savedTfvars } = req.body;
        
        const workspacePath = path.join(WORKSPACES_DIR, `${workspaceId}.json`);
        
        if (!fs.existsSync(workspacePath)) {
            return res.status(404).json({ success: false, error: 'Workspace not found' });
        }
        
        const workspace = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
        workspace.config = config;
        workspace.lastUpdated = new Date().toISOString();
        
        // Save tfvars if provided
        if (savedTfvars) {
            workspace.savedTfvars = savedTfvars;
        }
        
        fs.writeFileSync(workspacePath, JSON.stringify(workspace, null, 2));
        
        res.json({ success: true, workspace });
    } catch (error) {
        console.error('Error updating workspace config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update workspace plan data
app.post('/api/workspaces/:id/plan', (req, res) => {
    try {
        const workspaceId = req.params.id;
        const { planPath, runDir, planOutput } = req.body;
        
        const workspacePath = path.join(WORKSPACES_DIR, `${workspaceId}.json`);
        
        if (!fs.existsSync(workspacePath)) {
            return res.status(404).json({ success: false, error: 'Workspace not found' });
        }
        
        const workspace = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
        workspace.planPath = planPath;
        workspace.runDir = runDir;
        workspace.planOutput = planOutput;
        workspace.lastPlanned = new Date().toISOString();
        workspace.status = 'planned';
        
        fs.writeFileSync(workspacePath, JSON.stringify(workspace, null, 2));
        
        res.json({ success: true, workspace });
    } catch (error) {
        console.error('Error updating workspace plan data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update workspace apply data
app.post('/api/workspaces/:id/apply', (req, res) => {
    try {
        const workspaceId = req.params.id;
        const { applyOutput, vmId, status } = req.body;
        
        const workspacePath = path.join(WORKSPACES_DIR, `${workspaceId}.json`);
        
        if (!fs.existsSync(workspacePath)) {
            return res.status(404).json({ success: false, error: 'Workspace not found' });
        }
        
        const workspace = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
        workspace.applyOutput = applyOutput;
        workspace.vmId = vmId;
        workspace.status = status || 'deployed';
        workspace.lastDeployed = new Date().toISOString();
        
        fs.writeFileSync(workspacePath, JSON.stringify(workspace, null, 2));
        
        res.json({ success: true, workspace });
    } catch (error) {
        console.error('Error updating workspace apply data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete a workspace
app.delete('/api/workspaces/:id', (req, res) => {
    try {
        const workspaceId = req.params.id;
        const workspacePath = path.join(WORKSPACES_DIR, `${workspaceId}.json`);
        
        if (!fs.existsSync(workspacePath)) {
            return res.status(404).json({ success: false, error: 'Workspace not found' });
        }
        
        fs.unlinkSync(workspacePath);
        
        res.json({ success: true, message: 'Workspace deleted successfully' });
    } catch (error) {
        console.error('Error deleting workspace:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Settings API endpoints
app.get('/api/settings', (req, res) => {
    try {
        const currentSettings = settings.getSettings();
        res.json({ 
            success: true, 
            settings: currentSettings 
        });
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.post('/api/settings', (req, res) => {
    try {
        const { vsphere, netbox, aap, satellite } = req.body;
        
        if (!vsphere && !netbox && !aap && !satellite) {
            return res.status(400).json({ 
                success: false, 
                error: 'No settings provided to update' 
            });
        }
        
        // Update settings
        const updatedSettings = settings.updateSettings({ vsphere, netbox, aap, satellite });
        
        res.json({ 
            success: true, 
            message: 'Settings updated successfully',
            settings: updatedSettings
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get all deployed VMs
app.get('/api/deployed-vms', (req, res) => {
    try {
        // Read all workspace files and find deployed VMs
        const workspaceFiles = fs.readdirSync(WORKSPACES_DIR)
            .filter(file => file.endsWith('.json'));
        
        const deployedVMs = [];
        
        workspaceFiles.forEach(file => {
            try {
                const workspacePath = path.join(WORKSPACES_DIR, file);
                const workspace = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
                
                // Include only deployed VMs
                if (workspace.status === 'deployed' && workspace.vmId) {
                    deployedVMs.push({
                        id: workspace.id,
                        name: workspace.name,
                        vmName: workspace.config && workspace.config.vm_name || 'unknown',
                        vmId: workspace.vmId,
                        deployedAt: workspace.lastDeployed,
                        config: {
                            cpu: workspace.config && workspace.config.vm_cpu || 'unknown',
                            memory: workspace.config && workspace.config.vm_memory || 'unknown',
                            diskSize: workspace.config && workspace.config.vm_disk_size || 'unknown'
                        }
                    });
                }
            } catch (error) {
                console.error(`Error reading workspace file ${file}:`, error);
            }
        });
        
        res.json({ 
            success: true, 
            deployedVMs,
            count: deployedVMs.length
        });
    } catch (error) {
        console.error('Error getting deployed VMs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- CHR Registration API endpoint ---
// This endpoint is called by the remote-exec provisioner in Terraform
app.post('/chr/register', async (req, res) => {
    try {
        const { hostgroup_name, auto_run } = req.body;
        
        if (!hostgroup_name) {
            return res.status(400).json({
                success: false,
                error: 'hostgroup_name is required'
            });
        }

        console.log(`CHR Registration request for host group: ${hostgroup_name}`);
        
        // Get settings for CHR/Satellite configuration
        const globalSettings = settings.getSettings();
        
        if (!globalSettings.satellite || !globalSettings.satellite.url) {
            return res.status(400).json({
                success: false,
                error: 'CHR Satellite URL not configured. Please configure satellite settings.'
            });
        }

        const satelliteUrl = globalSettings.satellite.url;
        const username = globalSettings.satellite.username;
        const password = globalSettings.satellite.password;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'CHR Satellite credentials not configured. Please provide username and password in settings.'
            });
        }

        // Generate a mock hostname for registration (in real scenario this would be the actual VM hostname)
        const hostname = `vm-${Date.now()}`;
          // Generate the registration command that matches the Satellite 6 API format
        const registrationCommand = `curl -X POST "${satelliteUrl}/api/v2/hosts" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -u "${username}:${password}" \\
  -k \\
  -d '{
    "host": {
      "name": "${hostname}",
      "hostgroup_name": "${hostgroup_name}",
      "organization_id": 1,
      "location_id": 2,
      "build": false,
      "enabled": true,
      "managed": true,
      "provision_method": "build",
      "interfaces_attributes": {
        "0": {
          "mac": "00:50:56:${Math.floor(Math.random()*256).toString(16).padStart(2,'0')}:${Math.floor(Math.random()*256).toString(16).padStart(2,'0')}:${Math.floor(Math.random()*256).toString(16).padStart(2,'0')}",
          "primary": true,
          "provision": true
        }
      }
    }
  }'`;

        console.log(`Generated CHR registration command for ${hostname} in ${hostgroup_name}`);

        // Return the response in the format expected by the remote-exec provisioner
        res.json({
            success: true,
            registration_command: registrationCommand,
            hostgroup_name: hostgroup_name,
            hostname: hostname,
            auto_run: auto_run || false
        });

    } catch (error) {
        console.error('Error generating CHR registration command:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// --- CHR Status endpoint for connectivity testing ---
app.get('/status', (req, res) => {
    res.json({
        success: true,
        status: 'CHR API Server is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// --- Ansible AAP API endpoint ---
app.post('/api/aap/launch', async (req, res) => {
    try {
        const { target, templateId, workspaceId } = req.body;
        if (!target) {
            return res.status(400).json({ success: false, error: 'Missing target (VM IP or hostname)' });
        }
        
        const globalSettings = settings.getSettings();
        if (!globalSettings.aap || !globalSettings.aap.api_url || !globalSettings.aap.api_token) {
            return res.status(400).json({ success: false, error: 'AAP API credentials not configured' });
        }
        
        // Use provided template ID or fall back to default
        const jobTemplateId = templateId || globalSettings.aap.default_template_id || 72;
        
        // Get API URL and token
        const apiUrl = globalSettings.aap.api_url.replace(/\/$/, '');
        const apiToken = globalSettings.aap.api_token;
        
        // Launch the job template
        const launchUrl = `${apiUrl}/api/v2/job_templates/${jobTemplateId}/launch/`;
        const payload = {
            extra_vars: { target }
        };
                // Use built-in https module instead of node-fetch
                const https = require('https');
                const url = new URL(launchUrl);
                
                // Create a promise to handle the HTTP request
                const data = await new Promise((resolve, reject) => {
                    const requestOptions = {
                        hostname: url.hostname,
                        path: url.pathname + url.search,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiToken}`
                        },
                        rejectUnauthorized: false // For self-signed certificates
                    };
                    
                    const req = https.request(requestOptions, (res) => {
                        let responseData = '';
                        
                        res.on('data', (chunk) => {
                            responseData += chunk;
                        });
                        
                        res.on('end', () => {
                            try {
                                const parsedData = JSON.parse(responseData);
                                resolve({
                                    ok: res.statusCode >= 200 && res.statusCode < 300,
                                    status: res.statusCode,
                                    data: parsedData
                                });
                            } catch (error) {
                                reject(new Error(`Failed to parse response: ${error.message}`));
                            }
                        });
                    });
                    
                    req.on('error', (error) => {
                        reject(error);
                    });
                    
                    // Write request body
                    req.write(JSON.stringify(payload));
                    req.end();
                });
                
                const response = {
                    ok: data.ok,
                    status: data.status
                };
                
                // Extract the actual response data
                const responseData = data.data;
        
        if (!response.ok) {
            return res.status(response.status).json({ 
                success: false, 
                error: data.detail || data.error || 'Failed to launch AAP job', 
                data 
            });
        }
        
        // Store job launch info in workspace if workspace ID is provided
        if (workspaceId) {
            try {
                const workspacePath = path.join(WORKSPACES_DIR, `${workspaceId}.json`);
                if (fs.existsSync(workspacePath)) {
                    const workspace = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
                    
                    workspace.aapJob = {
                        launched: true,
                        time: new Date().toISOString(),
                        job: data,
                        templateId: jobTemplateId,
                        status: 'launched'
                    };
                    
                    fs.writeFileSync(workspacePath, JSON.stringify(workspace, null, 2));
                }
            } catch (wsError) {
                console.error('Error updating workspace with AAP job info:', wsError);
                // Continue anyway since the job was launched successfully
            }
        }
        
        // Return job info for frontend
        res.json({ 
            success: true, 
            job: data,
            templateId: jobTemplateId
        });
    } catch (error) {
        console.error('Error launching AAP job:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the web interface at http://localhost:${PORT}`);
});
