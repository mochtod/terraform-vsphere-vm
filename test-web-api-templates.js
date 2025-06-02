#!/usr/bin/env node

/**
 * Test script to verify the web API templates endpoint works exactly like the direct test
 */

const govcHelper = require('./www/govc-helper');
const fs = require('fs');
const path = require('path');

// Load credentials from global_settings.json
function loadCredentials() {
    try {
        const settingsPath = path.join(__dirname, 'www', 'global_settings.json');
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        return settings.vsphere;
    } catch (error) {
        console.error('❌ Failed to load credentials:', error.message);
        return null;
    }
}

async function testWebApiCall() {
    console.log('🚀 Testing govc-helper through web API flow...\n');
    
    const credentials = loadCredentials();
    if (!credentials) {
        throw new Error('Could not load vSphere credentials');
    }
    
    // Create connection details exactly like the web API does
    const connectionDetails = {
        server: credentials.server,
        user: credentials.user,
        password: credentials.password
    };
    
    console.log('📡 Connection details:');
    console.log(`  Server: ${connectionDetails.server}`);
    console.log(`  User: ${connectionDetails.user}`);
    console.log(`  Password: [${connectionDetails.password.length} chars]`);
    
    try {
        console.log('\n🔍 Calling govcHelper.getVmTemplates...');
        const templates = await govcHelper.getVmTemplates(connectionDetails);
        
        console.log(`\n✅ Success! Found ${templates.length} templates`);
        
        if (templates.length > 0) {
            console.log('\n📋 First template structure:');
            console.log(JSON.stringify(templates[0], null, 2));
            
            console.log('\n🎯 Guest ID Summary:');
            const templatesWithGuestId = templates.filter(t => t.guestId && t.guestId !== 'otherGuest');
            console.log(`  Templates with guest ID: ${templatesWithGuestId.length}/${templates.length}`);
            
            if (templatesWithGuestId.length > 0) {
                console.log('\n✨ Templates with guest ID:');
                templatesWithGuestId.forEach((template, index) => {
                    console.log(`  ${index + 1}. ${template.name}`);
                    console.log(`     Guest ID: ${template.guestId}`);
                    console.log(`     Guest OS: ${template.guestFullName || 'N/A'}`);
                });
            }
        }
        
        return templates;
        
    } catch (error) {
        console.error(`\n❌ Error calling govcHelper.getVmTemplates: ${error.message}`);
        console.error('Error details:', error);
        throw error;
    }
}

async function main() {
    try {
        await testWebApiCall();
        console.log('\n✅ Web API flow test completed successfully');
    } catch (error) {
        console.error('\n❌ Web API flow test failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
