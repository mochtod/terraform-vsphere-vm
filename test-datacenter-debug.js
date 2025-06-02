// Simple test to debug datacenter API timeout issue
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:3000';

// Load credentials from global_settings.json
function loadCredentials() {
    try {
        const settingsPath = path.join(__dirname, 'www', 'global_settings.json');
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        return {
            vsphereServer: settings.vsphere.server,
            vsphereUser: settings.vsphere.user,
            vspherePassword: settings.vsphere.password
        };
    } catch (error) {
        console.error('❌ Failed to load credentials:', error.message);
        return null;
    }
}

async function testDatacenters() {
    console.log('🔍 Testing Datacenters API with extended timeout...');
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    
    const credentials = loadCredentials();
    if (!credentials) {
        console.log('❌ Cannot proceed without credentials');
        return;
    }
    
    const data = {
        ...credentials,
        component: 'datacenters'
    };
    
    console.log(`🔑 Using vSphere server: ${credentials.vsphereServer}`);
    console.log(`🔑 Using vSphere user: ${credentials.vsphereUser}`);
    console.log('\n📡 Making request to /api/vsphere-infra/components...');
    
    try {
        const response = await axios.post(`${SERVER_URL}/api/vsphere-infra/components`, data, {
            timeout: 120000, // 2 minute timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`✅ Status: ${response.status}`);
        console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));
        
        if (response.data && response.data.data && Array.isArray(response.data.data)) {
            console.log(`📈 Datacenters found: ${response.data.data.length}`);
            response.data.data.forEach((dc, index) => {
                console.log(`  ${index + 1}. ${dc.name} (${dc.id})`);
            });
        }
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        if (error.response) {
            console.log(`📄 Status: ${error.response.status}`);
            console.log(`📄 Response:`, JSON.stringify(error.response.data, null, 2));
        }
        if (error.code === 'ECONNABORTED') {
            console.log('⏰ Request timed out - this suggests the govc command is hanging or taking too long');
        }
    }
}

// Run the test
testDatacenters().catch(console.error);
