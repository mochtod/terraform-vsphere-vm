#!/usr/bin/env node

/**
 * Debug script to test the web API templates endpoint in detail
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

async function debugWebApiCall() {
    console.log('🔍 Debugging Web API Templates Endpoint...\n');
    
    const credentials = loadCredentials();
    if (!credentials) {
        throw new Error('Could not load vSphere credentials');
    }
    
    console.log('📡 Credentials loaded:');
    console.log(`  Server: ${credentials.server}`);
    console.log(`  User: ${credentials.user}`);
    console.log(`  Password: ${'*'.repeat(credentials.password.length)}`);
    
    const payload = {
        vsphereServer: credentials.server,
        vsphereUser: credentials.user,
        vspherePassword: credentials.password
    };
    
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload);
        
        console.log('\n📤 Sending request to web API...');
        console.log(`  URL: http://localhost:3000/api/vsphere/templates`);
        console.log(`  Method: POST`);
        console.log(`  Payload size: ${postData.length} bytes`);
        
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
            
            console.log(`\n📥 Response received:`);
            console.log(`  Status: ${res.statusCode}`);
            console.log(`  Headers:`, res.headers);
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`\n📄 Raw response data:`);
                console.log(data);
                
                try {
                    const response = JSON.parse(data);
                    
                    console.log(`\n🧩 Parsed response:`);
                    console.log(JSON.stringify(response, null, 2));
                    
                    if (response.success && response.templates) {
                        console.log(`\n✅ Response indicates success`);
                        console.log(`📊 Templates returned: ${response.templates.length}`);
                        
                        if (response.templates.length > 0) {
                            console.log('\n🎯 First template:');
                            console.log(JSON.stringify(response.templates[0], null, 2));
                        }
                    } else if (response.success === false) {
                        console.log(`\n❌ API returned error: ${response.error || 'Unknown error'}`);
                    } else {
                        console.log(`\n⚠️  Unexpected response format`);
                    }
                    
                    resolve(response);
                } catch (error) {
                    console.log('\n❌ Failed to parse JSON response');
                    console.log('Parse error:', error.message);
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

async function main() {
    try {
        console.log('🚀 Starting Web API Debug Test\n');
        await debugWebApiCall();
        console.log('\n✅ Debug test completed successfully');
    } catch (error) {
        console.error('\n❌ Debug test failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
