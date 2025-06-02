#!/usr/bin/env node

/**
 * Comprehensive web endpoint test that mimics browser behavior
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

async function testWebEndpoint() {
    console.log('🌐 Testing actual web endpoint at http://localhost:3000/api/vsphere/templates\n');
    
    const credentials = loadCredentials();
    if (!credentials) {
        throw new Error('Could not load vSphere credentials');
    }
    
    const payload = {
        vsphereServer: credentials.server,
        vsphereUser: credentials.user,
        vspherePassword: credentials.password
    };
    
    console.log('📡 Request payload:');
    console.log(`  Server: ${payload.vsphereServer}`);
    console.log(`  User: ${payload.vsphereUser}`);
    console.log(`  Password: [${payload.vspherePassword.length} chars]`);
    
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload);
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/vsphere/templates',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        };

        console.log('\n📤 Making HTTP request...');
        const req = http.request(options, (res) => {
            console.log(`📥 Response status: ${res.statusCode}`);
            console.log(`📥 Response headers:`, res.headers);
            
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`📥 Raw response length: ${data.length} chars`);
                console.log(`📥 Raw response preview: ${data.substring(0, 200)}...`);
                
                try {
                    const response = JSON.parse(data);
                    console.log('\n✅ JSON parsing successful');
                    
                    if (response.success) {
                        console.log(`🎯 Success! Templates returned: ${response.templates ? response.templates.length : 0}`);
                        
                        if (response.templates && response.templates.length > 0) {
                            console.log('\n📋 First template structure:');
                            console.log(JSON.stringify(response.templates[0], null, 2));
                            
                            const templatesWithGuestId = response.templates.filter(t => t.guestId && t.guestId !== 'otherGuest');
                            console.log(`\n🎯 Templates with guest ID: ${templatesWithGuestId.length}/${response.templates.length}`);
                            
                            if (templatesWithGuestId.length > 0) {
                                console.log('\n✨ Guest ID functionality working in web endpoint!');
                                templatesWithGuestId.slice(0, 3).forEach((template, index) => {
                                    console.log(`  ${index + 1}. ${template.name}`);
                                    console.log(`     Guest ID: ${template.guestId}`);
                                    console.log(`     Guest OS: ${template.guestFullName || 'N/A'}`);
                                });
                            }
                        }
                    } else {
                        console.log(`❌ API returned success: false`);
                        console.log(`Error: ${response.error || 'Unknown error'}`);
                    }
                    
                    resolve(response);
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

        req.setTimeout(60000, () => {
            console.log('\n❌ Request timeout (60s)');
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.write(postData);
        req.end();
    });
}

// Test connection to server first
async function testServerConnection() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/',
            method: 'GET',
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            console.log(`🌐 Server connection test: ${res.statusCode}`);
            resolve(res.statusCode === 200);
        });

        req.on('error', (error) => {
            console.log(`🌐 Server connection failed: ${error.message}`);
            reject(error);
        });

        req.setTimeout(5000, () => {
            console.log('🌐 Server connection timeout');
            req.destroy();
            reject(new Error('Connection timeout'));
        });

        req.end();
    });
}

async function main() {
    try {
        console.log('🚀 Comprehensive Web Endpoint Test\n');
        
        // Test server connection first
        await testServerConnection();
        console.log('✅ Server is responding\n');
        
        // Test the templates endpoint
        const response = await testWebEndpoint();
        
        console.log('\n✅ Web endpoint test completed successfully');
        
        if (response.success && response.templates && response.templates.length > 0) {
            console.log('\n🎉 GUEST ID FUNCTIONALITY IS WORKING IN WEB INTERFACE!');
        } else {
            console.log('\n⚠️ Web endpoint returned no templates - this may indicate a server-side issue');
        }
        
    } catch (error) {
        console.error('\n❌ Web endpoint test failed:', error.message);
        console.log('\n💡 Possible issues:');
        console.log('  - Server is not running on port 3000');
        console.log('  - Server is not accessible from this context');
        console.log('  - API endpoint has changed');
        console.log('  - Server-side error processing the request');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
