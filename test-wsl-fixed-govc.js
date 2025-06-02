// Test the fixed govc-helper with WSL detection
const govcHelper = require('./www/govc-helper.js');

// Load connection details from the global settings
const fs = require('fs');
const path = require('path');

const globalSettingsPath = path.join(__dirname, 'www', 'global_settings.json');
let connectionDetails;

try {
    const globalSettings = JSON.parse(fs.readFileSync(globalSettingsPath, 'utf8'));
    connectionDetails = globalSettings.vsphere;
    console.log('✅ Loaded connection details from global_settings.json');
    console.log(`   Server: ${connectionDetails.server}`);
    console.log(`   User: ${connectionDetails.user}`);
} catch (error) {
    console.error('❌ Error loading connection details:', error.message);
    process.exit(1);
}

async function testGovcConnection() {
    console.log('\n🔍 Testing govc connection with WSL detection...');
    
    try {
        console.log('\n1. Testing datacenter retrieval...');
        const datacenters = await govcHelper.getDatacenters(connectionDetails);
        console.log(`✅ Found ${datacenters.length} datacenters:`);
        datacenters.forEach(dc => console.log(`   - ${dc.name} (${dc.id})`));
        
        if (datacenters.length > 0) {
            console.log('\n2. Testing template retrieval...');
            const templates = await govcHelper.getVmTemplates(connectionDetails);
            console.log(`✅ Found ${templates.length} templates:`);
            templates.forEach(template => {
                console.log(`   - ${template.name} (Guest ID: ${template.guestId || 'N/A'})`);
            });
        }
        
        console.log('\n🎉 All tests passed! WSL detection fix is working.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

testGovcConnection();
