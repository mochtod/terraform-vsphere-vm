// Test script to debug WSL API endpoints and infrastructure dropdowns
const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';

async function testEndpoint(endpoint, description) {
    console.log(`\n=== Testing ${description} ===`);
    console.log(`URL: ${SERVER_URL}${endpoint}`);
    
    try {
        const response = await axios.get(`${SERVER_URL}${endpoint}`, {
            timeout: 30000 // 30 second timeout
        });
        
        console.log(`✅ Status: ${response.status}`);
        console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));
        
        if (Array.isArray(response.data)) {
            console.log(`📈 Array length: ${response.data.length}`);
        }
        
        return response.data;
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        if (error.response) {
            console.log(`📄 Status: ${error.response.status}`);
            console.log(`📄 Response:`, error.response.data);
        }
        return null;
    }
}

async function runDiagnostics() {
    console.log('🔍 Starting WSL API Diagnostics...');
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    
    // Test connection status
    await testEndpoint('/api/connection-status', 'Connection Status');
    
    // Test individual infrastructure endpoints
    await testEndpoint('/api/datacenters', 'Datacenters');
    await testEndpoint('/api/clusters', 'Clusters (should fail without datacenter)');
    await testEndpoint('/api/datastore-clusters', 'Datastore Clusters (should fail without params)');
    await testEndpoint('/api/networks', 'Networks (should fail without params)');
    
    // Test templates
    await testEndpoint('/api/templates', 'VM Templates');
    
    // Test with sample datacenter if we have one
    const datacenters = await testEndpoint('/api/datacenters', 'Datacenters (retry)');
    if (datacenters && datacenters.length > 0) {
        const firstDC = datacenters[0].name;
        console.log(`\n🎯 Testing with datacenter: "${firstDC}"`);
        
        await testEndpoint(`/api/clusters?datacenter=${encodeURIComponent(firstDC)}`, `Clusters for ${firstDC}`);
        
        const clusters = await testEndpoint(`/api/clusters?datacenter=${encodeURIComponent(firstDC)}`, `Clusters for ${firstDC} (retry)`);
        if (clusters && clusters.length > 0) {
            const firstCluster = clusters[0].name;
            console.log(`\n🎯 Testing with cluster: "${firstCluster}"`);
            
            await testEndpoint(`/api/datastore-clusters?cluster=${encodeURIComponent(firstCluster)}&datacenter=${encodeURIComponent(firstDC)}`, `Datastore Clusters for ${firstCluster}`);
            await testEndpoint(`/api/networks?cluster=${encodeURIComponent(firstCluster)}&datacenter=${encodeURIComponent(firstDC)}`, `Networks for ${firstCluster}`);
        }
    }
    
    console.log('\n✅ Diagnostics complete!');
}

// Run the diagnostics
runDiagnostics().catch(console.error);
