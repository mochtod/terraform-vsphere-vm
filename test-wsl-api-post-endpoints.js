// Test script to test WSL API endpoints using POST requests with credentials
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

async function testPostEndpoint(endpoint, data, description) {
    console.log(`\n=== Testing ${description} ===`);
    console.log(`URL: ${SERVER_URL}${endpoint}`);
    console.log(`Data: ${JSON.stringify(data, null, 2)}`);
    
    try {
        const response = await axios.post(`${SERVER_URL}${endpoint}`, data, {
            timeout: 30000, // 30 second timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`✅ Status: ${response.status}`);
        console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));
        
        if (Array.isArray(response.data)) {
            console.log(`📈 Array length: ${response.data.length}`);
        } else if (response.data && Array.isArray(response.data.data)) {
            console.log(`📈 Data array length: ${response.data.data.length}`);
        }
        
        return response.data;
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        if (error.response) {
            console.log(`📄 Status: ${error.response.status}`);
            console.log(`📄 Response:`, JSON.stringify(error.response.data, null, 2));
        }
        return null;
    }
}

async function runDiagnostics() {
    console.log('🔍 Starting WSL API POST Diagnostics...');
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    
    // Load credentials
    const credentials = loadCredentials();
    if (!credentials) {
        console.log('❌ Cannot proceed without credentials');
        return;
    }
    
    console.log(`🔑 Using vSphere server: ${credentials.vsphereServer}`);
    console.log(`🔑 Using vSphere user: ${credentials.vsphereUser}`);
    
    // Test VM Templates
    await testPostEndpoint('/api/vsphere/templates', credentials, 'VM Templates');
    
    // Test Infrastructure Components - Datacenters
    await testPostEndpoint('/api/vsphere-infra/components', {
        ...credentials,
        component: 'datacenters'
    }, 'Datacenters');
    
    // Get datacenter info first for subsequent tests
    const dcResponse = await testPostEndpoint('/api/vsphere-infra/components', {
        ...credentials,
        component: 'datacenters'
    }, 'Datacenters (for subsequent tests)');
    
    if (dcResponse && dcResponse.data && dcResponse.data.length > 0) {
        const firstDC = dcResponse.data[0].name;
        console.log(`\n🎯 Using datacenter: "${firstDC}" for subsequent tests`);
        
        // Test Clusters
        await testPostEndpoint('/api/vsphere-infra/components', {
            ...credentials,
            component: 'clusters',
            datacenterContext: firstDC
        }, `Clusters for ${firstDC}`);
        
        // Test Networks  
        await testPostEndpoint('/api/vsphere-infra/components', {
            ...credentials,
            component: 'networks',
            datacenterContext: firstDC
        }, `Networks for ${firstDC}`);
        
        // Test Datastores
        await testPostEndpoint('/api/vsphere-infra/components', {
            ...credentials,
            component: 'datastores',
            datacenterContext: firstDC
        }, `Datastores for ${firstDC}`);
        
        // Test Datastore Clusters
        await testPostEndpoint('/api/vsphere-infra/components', {
            ...credentials,
            component: 'datastore-clusters',
            datacenterContext: firstDC
        }, `Datastore Clusters for ${firstDC}`);
    } else {
        console.log('⚠️  No datacenters found, skipping dependent tests');
    }
    
    console.log('\n✅ POST API Diagnostics complete!');
}

// Run the diagnostics
runDiagnostics().catch(console.error);
