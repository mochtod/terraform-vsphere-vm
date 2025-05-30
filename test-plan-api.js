const axios = require('axios');

async function testTerraformPlan() {
    const BASE_URL = 'http://localhost:3000';
    const workspaceId = '82ae7cbd-6903-4ebb-87a8-7a8ecc5441d5';
    
    console.log('Testing terraform plan API...\n');
    
    try {
        const response = await axios.post(`${BASE_URL}/api/terraform/plan`, {
            vmVars: {
                vm_name: 'test-plan-api',
                vm_cpu: 2,
                vm_memory: 4096,
                vm_disk_size: 50,
                vm_template: 'rhel9-template0314'
            },
            workspaceId: workspaceId
        }, {
            timeout: 30000  // 30 second timeout
        });
        
        console.log('✅ Plan API response received');
        console.log('Status:', response.status);
        console.log('Success:', response.data.success);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Plan API error:', error.message);
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Status text:', error.response.statusText);
            console.error('Response data:', error.response.data);
        } else if (error.request) {
            console.error('No response received');
            console.error('Request error:', error.request);
        } else {
            console.error('Request setup error:', error.message);
        }
    }
}

testTerraformPlan();
