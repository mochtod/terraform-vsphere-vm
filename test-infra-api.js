const axios = require('axios');

async function testInfrastructureAPI() {
    const BASE_URL = 'http://localhost:3000';
      // Get credentials from settings
    const settingsResponse = await axios.get(`${BASE_URL}/api/settings`);
    const settings = settingsResponse.data.settings;  // Note: data.settings, not just data
    
    if (!settings.vsphere) {
        console.log('❌ No vSphere settings found');
        return;
    }
    
    const { server, user, password } = settings.vsphere;
    console.log(`Testing with server: ${server}, user: ${user}`);
    
    // Test getting datacenters
    console.log('\n1. Testing datacenters...');
    try {
        const response = await axios.post(`${BASE_URL}/api/vsphere-infra/components`, {
            vsphereServer: server,
            vsphereUser: user,
            vspherePassword: password,
            component: 'datacenters'
        });
        
        console.log('✅ Datacenters response:', response.data.success ? 'Success' : 'Failed');
        if (response.data.components) {
            console.log(`Found ${response.data.components.length} datacenters:`, response.data.components.map(dc => dc.name || dc));
        }
    } catch (error) {
        console.log('❌ Datacenters error:', error.response?.data?.error || error.message);
    }
      // Test getting clusters (with a sample datacenter)
    console.log('\n2. Testing clusters...');
    try {
        const response = await axios.post(`${BASE_URL}/api/vsphere-infra/components`, {
            vsphereServer: server,
            vsphereUser: user,
            vspherePassword: password,
            component: 'clusters',
            parent: 'CHR-VSPHERE',  // Use parent instead of datacenterContext
            datacenterContext: 'CHR-VSPHERE'
        });
        
        console.log('✅ Clusters response:', response.data.success ? 'Success' : 'Failed');
        if (response.data.components) {
            console.log(`Found ${response.data.components.length} clusters:`, response.data.components.map(c => c.name || c));
        }
    } catch (error) {
        console.log('❌ Clusters error:', error.response?.data?.error || error.message);
    }
    
    // Test getting datastore clusters
    console.log('\n3. Testing datastore clusters...');
    try {
        const response = await axios.post(`${BASE_URL}/api/vsphere-infra/components`, {
            vsphereServer: server,
            vsphereUser: user,
            vspherePassword: password,
            component: 'datastoreClusters',
            parent: 'CHR-VSPHERE',
            datacenterContext: 'CHR-VSPHERE'
        });
        
        console.log('✅ Datastore clusters response:', response.data.success ? 'Success' : 'Failed');
        if (response.data.components) {
            console.log(`Found ${response.data.components.length} datastore clusters:`, response.data.components.map(c => c.name || c));
        }
    } catch (error) {
        console.log('❌ Datastore clusters error:', error.response?.data?.error || error.message);
    }
    
    // Test getting networks
    console.log('\n4. Testing networks...');
    try {
        const response = await axios.post(`${BASE_URL}/api/vsphere-infra/components`, {
            vsphereServer: server,
            vsphereUser: user,
            vspherePassword: password,
            component: 'networks',
            parent: 'sample-cluster',  // Networks need cluster parent
            datacenterContext: 'CHR-VSPHERE'
        });
        
        console.log('✅ Networks response:', response.data.success ? 'Success' : 'Failed');
        if (response.data.components) {
            console.log(`Found ${response.data.components.length} networks:`, response.data.components.map(n => n.name || n));
        }
    } catch (error) {
        console.log('❌ Networks error:', error.response?.data?.error || error.message);
    }
}

testInfrastructureAPI().catch(console.error);
