#!/usr/bin/env node

/**
 * Direct test of govc-helper.js getVmTemplates function
 * Tests guest ID implementation directly
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

async function testGovcTemplates() {
    console.log('🚀 Testing govc-helper.js getVmTemplates function directly...\n');
    
    const credentials = loadCredentials();
    if (!credentials) {
        throw new Error('Could not load vSphere credentials');
    }
    
    console.log(`📡 Testing connection to: ${credentials.server}`);
    console.log(`👤 Using user: ${credentials.user}\n`);
    
    const connectionDetails = {
        server: credentials.server,
        user: credentials.user,
        password: credentials.password
    };
    
    try {
        // Test connection first
        console.log('🔍 Testing vSphere connection...');
        const connectionOk = await govcHelper.testConnection(connectionDetails);
        console.log(`Connection status: ${connectionOk ? '✅ Success' : '❌ Failed'}\n`);
        
        if (!connectionOk) {
            console.log('⚠️  Connection failed, but continuing with template test...\n');
        }
        
        // Test templates function
        console.log('📋 Calling getVmTemplates function...');
        const startTime = Date.now();
        
        const templates = await govcHelper.getVmTemplates(connectionDetails);
        
        const duration = Date.now() - startTime;
        console.log(`⏱️  Function completed in ${duration}ms\n`);
        
        console.log(`📊 Results:`);
        console.log(`  Templates found: ${templates.length}`);
        
        if (templates.length > 0) {
            console.log('\n🎯 Template Analysis:');
            
            // Check structure of first template
            const firstTemplate = templates[0];
            console.log(`  First template keys: ${Object.keys(firstTemplate).join(', ')}`);
            console.log(`  Sample template:`, JSON.stringify(firstTemplate, null, 2));
            
            // Check for guest ID presence
            const templatesWithGuestId = templates.filter(t => t.guestId && t.guestId !== 'otherGuest');
            console.log(`\n✨ Guest ID Status:`);
            console.log(`  Templates with guest ID: ${templatesWithGuestId.length}/${templates.length}`);
            
            if (templatesWithGuestId.length > 0) {
                console.log('\n🎉 SUCCESS: Guest ID functionality is working!');
                console.log('\n📝 Sample templates with guest ID:');
                templatesWithGuestId.slice(0, 5).forEach((template, index) => {
                    console.log(`  ${index + 1}. ${template.name}`);
                    console.log(`     ID: ${template.id}`);
                    console.log(`     Guest ID: ${template.guestId}`);
                    console.log(`     Guest OS: ${template.guestFullName || 'N/A'}`);
                    console.log(`     Path: ${template.path}`);
                    console.log('');
                });
            } else {
                console.log('\n⚠️  No templates have valid guest ID information');
                console.log('\n📋 All templates found:');
                templates.slice(0, 5).forEach((template, index) => {
                    console.log(`  ${index + 1}. ${template.name || 'Unnamed'}`);
                    console.log(`     Available keys: ${Object.keys(template).join(', ')}`);
                    if (template.guestId) {
                        console.log(`     Guest ID: ${template.guestId}`);
                    }
                    console.log('');
                });
            }
            
            // Summary
            console.log('📈 Summary:');
            console.log(`  • Total templates: ${templates.length}`);
            console.log(`  • Templates with guest ID: ${templatesWithGuestId.length}`);
            console.log(`  • Templates with guest name: ${templates.filter(t => t.guestFullName).length}`);
            
        } else {
            console.log('\n❌ No templates found');
            console.log('   This could indicate:');
            console.log('   • No VM templates exist in vSphere');
            console.log('   • Permission issues accessing templates');
            console.log('   • govc command failed');
            console.log('   • Network/connectivity issues');
        }
        
    } catch (error) {
        console.error('\n❌ Error during template test:');
        console.error(`   Message: ${error.message}`);
        if (error.stack) {
            console.error(`   Stack: ${error.stack}`);
        }
        throw error;
    }
}

async function main() {
    try {
        await testGovcTemplates();
        console.log('\n✅ Test completed successfully');
    } catch (error) {
        console.error('\n💥 Test failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
