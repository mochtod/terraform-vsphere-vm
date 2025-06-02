#!/usr/bin/env node

/**
 * Test script to verify guest ID functionality
 * Tests the /api/vsphere/templates endpoint to ensure guest ID is returned
 */

const http = require('http');
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

async function testTemplatesEndpoint() {
    console.log('Testing VM Templates endpoint for guest ID functionality...\n');
    
    const credentials = loadCredentials();
    if (!credentials) {
        throw new Error('Could not load vSphere credentials');
    }
    
    const payload = {
        vsphereServer: credentials.server,
        vsphereUser: credentials.user,
        vspherePassword: credentials.password
    };
    
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload);
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/vsphere/templates',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    console.log(`Response Status: ${res.statusCode}`);
                    
                    if (res.statusCode === 200) {
                        console.log('\n✅ Templates endpoint successful');
                        
                        if (response.success && response.templates) {
                            console.log(`Number of templates returned: ${response.templates.length}`);
                            
                            if (response.templates.length > 0) {
                                console.log('\n📋 Template structure analysis:');
                                const firstTemplate = response.templates[0];
                                console.log('First template keys:', Object.keys(firstTemplate));
                                console.log('First template sample:', JSON.stringify(firstTemplate, null, 2));
                                
                                // Check if guest ID is present
                                const templatesWithGuestId = response.templates.filter(t => t.guestId && t.guestId !== 'otherGuest');
                                console.log(`\n🎯 Templates with guest ID: ${templatesWithGuestId.length}/${response.templates.length}`);
                                
                                if (templatesWithGuestId.length > 0) {
                                    console.log('\n✅ Guest ID functionality working!');
                                    console.log('Sample templates with guest ID:');
                                    templatesWithGuestId.slice(0, 3).forEach((template, index) => {
                                        console.log(`  ${index + 1}. ${template.name}`);
                                        console.log(`     Guest ID: ${template.guestId}`);
                                        console.log(`     Guest OS: ${template.guestFullName || 'N/A'}`);
                                    });
                                } else {
                                    console.log('\n❌ No templates have valid guest ID information');
                                    console.log('Templates found:');
                                    response.templates.slice(0, 3).forEach((template, index) => {
                                        console.log(`  ${index + 1}. ${template.name}`);
                                        console.log(`     Keys: ${Object.keys(template).join(', ')}`);
                                    });
                                }
                            } else {
                                console.log('\n⚠️  No templates returned');
                            }
                        } else {
                            console.log('\n❌ Response indicates failure');
                            console.log('Response:', response);
                        }
                        
                        resolve(response);
                    } else {
                        console.log(`\n❌ Templates endpoint failed with status: ${res.statusCode}`);
                        console.log('Response:', data);
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                } catch (error) {
                    console.log('\n❌ Failed to parse JSON response');
                    console.log('Raw response:', data);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.log(`\n❌ Request failed: ${error.message}`);
            reject(error);
        });

        req.setTimeout(30000, () => {
            console.log('\n❌ Request timeout (30s)');
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.write(postData);
        req.end();
    });
}

async function main() {
    try {
        console.log('🚀 Starting Guest ID Functionality Test\n');
        await testTemplatesEndpoint();
        console.log('\n✅ Test completed successfully');
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
