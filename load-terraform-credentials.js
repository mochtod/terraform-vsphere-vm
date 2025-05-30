#!/usr/bin/env node
// Terraform Global Settings Loader (Node.js version)
// This script loads the same global_settings.json that the UI/API uses and sets environment variables for Terraform

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Path to settings file
const SETTINGS_FILE = path.join(__dirname, 'www', 'global_settings.json');

function loadCredentials() {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) {
            console.error(`Error: global_settings.json not found at ${SETTINGS_FILE}`);
            process.exit(1);
        }

        console.log('Loading credentials from global_settings.json...');
        
        const settingsData = fs.readFileSync(SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(settingsData);

        // Set environment variables for vSphere
        process.env.VSPHERE_USER = settings.vsphere.user;
        process.env.VSPHERE_PASSWORD = settings.vsphere.password;
        process.env.VSPHERE_SERVER = settings.vsphere.server;
        process.env.VSPHERE_ALLOW_UNVERIFIED_SSL = 'true';

        // Set Terraform variables
        process.env.TF_VAR_vsphere_user = settings.vsphere.user;
        process.env.TF_VAR_vsphere_password = settings.vsphere.password;
        process.env.TF_VAR_vsphere_server = settings.vsphere.server;

        // Set Netbox variables
        process.env.NETBOX_TOKEN = settings.netbox.token;
        process.env.NETBOX_URL = settings.netbox.url;

        console.log('Credentials loaded successfully:');
        console.log(`  vSphere User: ${settings.vsphere.user}`);
        console.log(`  vSphere Server: ${settings.vsphere.server}`);
        console.log(`  Netbox URL: ${settings.netbox.url}`);
        console.log('  Environment variables set for Terraform');

        return settings;
    } catch (error) {
        console.error('Error loading credentials:', error.message);
        process.exit(1);
    }
}

function runTerraformCommand(command, args = []) {
    return new Promise((resolve, reject) => {
        console.log(`\nExecuting: ${command} ${args.join(' ')}`);
        
        const terraformProcess = spawn(command, args, {
            stdio: 'inherit',
            env: process.env,
            shell: true
        });

        terraformProcess.on('close', (code) => {
            if (code === 0) {
                resolve(code);
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });

        terraformProcess.on('error', (error) => {
            reject(error);
        });
    });
}

// Main execution
async function main() {
    // Load credentials
    const settings = loadCredentials();

    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('\nCredentials are now loaded. You can run Terraform commands with these environment variables.');
        console.log('Usage examples:');
        console.log('  node load-terraform-credentials.js terraform init');
        console.log('  node load-terraform-credentials.js terraform plan -var-file=machine_input.tfvars');
        console.log('  node load-terraform-credentials.js terraform apply');
        return;
    }

    // Execute the provided command
    try {
        const command = args[0];
        const commandArgs = args.slice(1);
        await runTerraformCommand(command, commandArgs);
    } catch (error) {
        console.error('Error executing command:', error.message);
        process.exit(1);
    }
}

// Export for use as module
module.exports = { loadCredentials, runTerraformCommand };

// Run if called directly
if (require.main === module) {
    main();
}
