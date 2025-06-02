#!/usr/bin/env node

/**
 * Comprehensive test to compare direct govc-helper calls vs web API calls
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const govcHelper = require('./www/govc-helper');

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

async function testDirectCall() {
    console.log('🔄 Testing Direct govc-helper Call...\n');
    
    const credentials = loadCredentials();
    if (!credentials) {
        throw new Error('Could not load vSphere credentials');
    }
    
    const connectionDetails = {
        server: credentials.server,
        user: credentials.user,
        password: credentials.password
    };
    
    try {
        console.log('📡 Direct call parameters:');
        console.log(`  Server: ${connectionDetails.server}`);
        console.log(`  User: ${connectionDetails.user}`);
        console.log(`  Password: ${'*'.repeat(connectionDetails.password.length)}`);
        
        const startTime = Date.now();
        const templates = await govcHelper.getVmTemplates(connectionDetails);
        const endTime = Date.now();
        
        console.log(`\n✅ Direct call completed in ${endTime - startTime}ms`);
        console.log(`📊 Templates found: ${templates.length}`);
        
        if (templates.length > 0) {
            console.log('\n🎯 First template from direct call:');
            console.log(JSON.stringify(templates[0], null, 2));
        }
        
        return templates;
    } catch (error) {
        console.error('❌ Direct call failed:', error.message);
        throw error;
    }
}

async function testWebApiCall() {
    console.log('\n\n🌐 Testing Web API Call...\n');
    
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
        
        console.log('📡 Web API call parameters:');
        console.log(`  Server: ${payload.vsphereServer}`);
        console.log(`  User: ${payload.vsphereUser}`);
        console.log(`  Password: ${'*'.repeat(payload.vspherePassword.length)}`);
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

        const startTime = Date.now();
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const endTime = Date.now();
                
                try {
                    const response = JSON.parse(data);
                    
                    console.log(`\n✅ Web API call completed in ${endTime - startTime}ms`);
                    console.log(`📊 Status: ${res.statusCode}`);
                    console.log(`📊 Templates found: ${response.templates ? response.templates.length : 0}`);
                    
                    if (response.templates && response.templates.length > 0) {
                        console.log('\n🎯 First template from web API:');
                        console.log(JSON.stringify(response.templates[0], null, 2));
                    }
                    
                    resolve(response);
                } catch (error) {
                    console.log('❌ Failed to parse JSON response');
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.log(`❌ Web API request failed: ${error.message}`);
            reject(error);
        });

        req.setTimeout(60000, () => {
            console.log('❌ Web API request timeout (60s)');
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.write(postData);
        req.end();
    });
}

async function compareResults(directTemplates, webApiResponse) {
    console.log('\n\n📋 Comparison Results...\n');
    
    const webTemplates = webApiResponse.templates || [];
    
    console.log(`📊 Direct call templates: ${directTemplates.length}`);
    console.log(`📊 Web API templates: ${webTemplates.length}`);
    
    if (directTemplates.length > 0 && webTemplates.length === 0) {
        console.log('\n❌ ISSUE IDENTIFIED: Direct call works but Web API returns 0 templates');
        console.log('🔍 Possible causes:');
        console.log('  • Environment variables not passed correctly to WSL');
        console.log('  • govc path or permissions issue in web server context');
        console.log('  • Different working directory or user context');
        console.log('  • Error in govc execution that is being silently caught');
    } else if (directTemplates.length === webTemplates.length && directTemplates.length > 0) {
        console.log('\n✅ SUCCESS: Both methods return the same number of templates');
        
        // Compare first template structure
        if (JSON.stringify(directTemplates[0]) === JSON.stringify(webTemplates[0])) {
            console.log('✅ Template structures match perfectly');
        } else {
            console.log('⚠️  Template structures differ');
            console.log('Direct:', directTemplates[0]);
            console.log('WebAPI:', webTemplates[0]);
        }
    } else {
        console.log('\n⚠️  Different results between methods');
    }
}

async function main() {
    try {
        console.log('🚀 Starting Comprehensive govc-helper Comparison Test\n');
        
        // Test direct function call
        const directTemplates = await testDirectCall();
        
        // Test web API call
        const webApiResponse = await testWebApiCall();
        
        // Compare results
        await compareResults(directTemplates, webApiResponse);
        
        console.log('\n✅ Comparison test completed');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
