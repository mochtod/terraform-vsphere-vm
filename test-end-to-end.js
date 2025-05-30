const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testEndToEndDeployment() {
    const BASE_URL = 'http://localhost:3000';
    const workspaceId = '82ae7cbd-6903-4ebb-87a8-7a8ecc5441d5';
    
    console.log('Testing end-to-end deployment workflow...\n');
    
    try {
        // 1. Get current workspace with tfvars
        console.log('1. Getting workspace with saved tfvars...');
        const workspaceResponse = await axios.get(`${BASE_URL}/api/workspaces/${workspaceId}`);
        const workspace = workspaceResponse.data.workspace;
        
        console.log(`Workspace: ${workspace.name}`);
        console.log('Saved tfvars:', workspace.savedTfvars ? 'Found' : 'Not found');
        
        if (workspace.savedTfvars) {
            console.log('Sample tfvar values:');
            console.log(`  vm_name: ${workspace.savedTfvars.vm_name}`);
            console.log(`  vm_cpu: ${workspace.savedTfvars.vm_cpu}`);
            console.log(`  vm_memory: ${workspace.savedTfvars.vm_memory}`);
        }
        
        // 2. Test VM variables preparation for terraform
        console.log('\n2. Testing terraform variable preparation...');
        
        // Prepare a realistic set of VM variables for testing
        const vmVars = {
            vm_name: workspace.savedTfvars?.vm_name || 'test-terraform-vm',
            vm_count: workspace.savedTfvars?.vm_count || 1,
            vm_cpu: workspace.savedTfvars?.vm_cpu || 2,
            vm_memory: workspace.savedTfvars?.vm_memory || 4096,
            vm_disk_size: workspace.savedTfvars?.vm_disk_size || 50,
            vm_template: workspace.savedTfvars?.vm_template || 'rhel9-template0314',
            vm_guest_id: 'rhel9_64Guest',
            vm_network_adapter_type: 'vmxnet3',
            datacenter: workspace.savedTfvars?.datacenter || 'CHR-VSPHERE',
            cluster: workspace.savedTfvars?.cluster || 'DEV-Cluster',
            datastore_cluster: workspace.savedTfvars?.datastore_cluster || 'DEV-DatastoreCluster',
            vm_network: workspace.savedTfvars?.vm_network || 'VM Network'
        };
        
        console.log('Prepared VM variables:', vmVars);
        
        // 3. Test terraform plan generation (without password - let it use global settings)
        console.log('\n3. Testing terraform plan generation...');
        
        const planResponse = await axios.post(`${BASE_URL}/api/terraform/plan`, {
            vmVars: vmVars,
            workspaceId: workspaceId
            // Note: Not sending vspherePassword - it should use global settings
        });
        
        console.log('Plan response status:', planResponse.status);
        console.log('Plan response success:', planResponse.data.success);
        
        if (planResponse.data.success) {
            console.log('✅ Terraform plan generated successfully!');
            console.log('Plan path:', planResponse.data.planPath);
            console.log('Run directory:', planResponse.data.runDir);
            
            // Show part of the plan output if available
            if (planResponse.data.planOutput) {
                const planLines = planResponse.data.planOutput.split('\n');
                console.log('\nPlan output preview (first 10 lines):');
                planLines.slice(0, 10).forEach((line, index) => {
                    console.log(`  ${index + 1}: ${line}`);
                });
                
                if (planLines.length > 10) {
                    console.log(`  ... and ${planLines.length - 10} more lines`);
                }
            }
        } else {
            console.log('❌ Terraform plan failed');
            console.log('Error:', planResponse.data.error);
            
            // Try to show the error output if available
            if (planResponse.data.output) {
                console.log('\nTerraform error output:');
                console.log(planResponse.data.output);
            }
        }
        
        // 4. Verify workspace was updated with plan information
        console.log('\n4. Verifying workspace update...');
        const updatedWorkspaceResponse = await axios.get(`${BASE_URL}/api/workspaces/${workspaceId}`);
        const updatedWorkspace = updatedWorkspaceResponse.data.workspace;
        
        console.log('Workspace status:', updatedWorkspace.status);
        console.log('Last planned:', updatedWorkspace.lastPlanned || 'Never');
        console.log('Plan path:', updatedWorkspace.planPath || 'Not set');
        
        if (updatedWorkspace.status === 'planned') {
            console.log('✅ Workspace successfully updated with plan information');
        } else {
            console.log('❌ Workspace not updated with plan information');
        }
        
    } catch (error) {
        console.error('❌ Error during end-to-end test:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

testEndToEndDeployment();
