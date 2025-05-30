const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function testTfvarsPersistence() {
    console.log('Testing workspace tfvars persistence...\n');
    
    try {        // 1. List existing workspaces
        console.log('1. Fetching existing workspaces...');
        const workspacesResponse = await axios.get(`${BASE_URL}/api/workspaces`);
        const workspaces = workspacesResponse.data.workspaces || workspacesResponse.data;
        console.log(`Found ${workspaces.length} workspaces`);
        
        if (workspaces.length === 0) {
            console.log('No workspaces found. Creating a test workspace first...');
            return;
        }
        
        const testWorkspace = workspaces[0];
        console.log(`Using workspace: ${testWorkspace.id} (${testWorkspace.name})`);
          // 2. Get current workspace config
        console.log('\n2. Getting current workspace configuration...');
        const configResponse = await axios.get(`${BASE_URL}/api/workspaces/${testWorkspace.id}`);
        const currentWorkspace = configResponse.data.workspace;
        console.log('Current config:', JSON.stringify(currentWorkspace, null, 2));
        
        // 3. Prepare test tfvars data
        const testTfvars = {
            vm_name: 'test-vm-tfvars-persist',
            vm_count: 2,
            vm_memory: 8192,
            vm_cpu: 4,
            vm_disk_size: 100,
            vm_network: 'test-network',
            vm_template: 'rhel8-template',
            datacenter: 'test-datacenter',
            cluster: 'test-cluster',
            datastore_cluster: 'test-datastore-cluster'
        };
          // 4. Update workspace config with tfvars
        console.log('\n3. Updating workspace with test tfvars...');
        const updateData = {
            config: currentWorkspace.config || {},
            savedTfvars: testTfvars
        };
        
        const updateResponse = await axios.post(`${BASE_URL}/api/workspaces/${testWorkspace.id}/config`, updateData);
        console.log('Update response:', updateResponse.status);
        
        // 5. Verify the tfvars were saved by fetching the config again
        console.log('\n4. Verifying tfvars persistence...');
        const verifyResponse = await axios.get(`${BASE_URL}/api/workspaces/${testWorkspace.id}`);
        const updatedWorkspace = verifyResponse.data.workspace;
        console.log('Updated config:', JSON.stringify(updatedWorkspace, null, 2));
        
        // 6. Check if savedTfvars matches what we sent
        const savedTfvars = updatedWorkspace.savedTfvars;
        if (savedTfvars) {
            console.log('\n5. Comparing saved tfvars with original...');
            let allMatch = true;
            for (const [key, value] of Object.entries(testTfvars)) {
                if (savedTfvars[key] !== value) {
                    console.log(`❌ Mismatch for ${key}: expected ${value}, got ${savedTfvars[key]}`);
                    allMatch = false;
                } else {
                    console.log(`✅ ${key}: ${value}`);
                }
            }
            
            if (allMatch) {
                console.log('\n✅ SUCCESS: All tfvars persisted correctly!');
            } else {
                console.log('\n❌ FAILURE: Some tfvars did not persist correctly');
            }
        } else {
            console.log('\n❌ FAILURE: No savedTfvars found in updated config');
        }
        
        // 7. Check the physical workspace file
        console.log('\n6. Checking physical workspace file...');
        const workspaceFilePath = path.join(__dirname, 'www', 'vm_workspaces', `${testWorkspace.id}.json`);
        if (fs.existsSync(workspaceFilePath)) {
            const fileContent = JSON.parse(fs.readFileSync(workspaceFilePath, 'utf8'));
            console.log('Physical file content:', JSON.stringify(fileContent, null, 2));
            
            if (fileContent.savedTfvars) {
                console.log('✅ savedTfvars found in physical file');
            } else {
                console.log('❌ savedTfvars not found in physical file');
            }
        } else {
            console.log(`❌ Workspace file not found at ${workspaceFilePath}`);
        }
        
    } catch (error) {
        console.error('❌ Error during testing:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testTfvarsPersistence();
