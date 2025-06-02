// Comprehensive credential and connection test
const fs = require('fs');
const path = require('path');
const http = require('http');

// Load settings
const settingsPath = path.join(__dirname, 'www', 'global_settings.json');
let globalSettings = null;

try {
    const settingsData = fs.readFileSync(settingsPath, 'utf8');
    globalSettings = JSON.parse(settingsData);
    console.log('Global settings loaded successfully');
} catch (error) {
    console.error('Failed to load global settings:', error.message);
    process.exit(1);
}

console.log('='.repeat(80));
console.log('CREDENTIAL AND CONNECTION VERIFICATION TEST');
console.log('='.repeat(80));

// Display loaded credentials (masked passwords)
console.log('\n1. LOADED CREDENTIALS:');
console.log('-'.repeat(40));
console.log('vSphere Server:', globalSettings.vsphere.server);
console.log('vSphere User:', globalSettings.vsphere.user);
console.log('vSphere Password:', globalSettings.vsphere.password ? `[${globalSettings.vsphere.password.length} chars]` : 'NOT SET');
console.log('Netbox URL:', globalSettings.netbox.url);
console.log('Netbox Token:', globalSettings.netbox.token ? `[${globalSettings.netbox.token.length} chars]` : 'NOT SET');
console.log('AAP API URL:', globalSettings.aap.api_url);
console.log('AAP Token:', globalSettings.aap.api_token ? `[${globalSettings.aap.api_token.length} chars]` : 'NOT SET');
console.log('Satellite URL:', globalSettings.satellite.url);
console.log('Satellite Username:', globalSettings.satellite.username);
console.log('Satellite Password:', globalSettings.satellite.password ? `[${globalSettings.satellite.password.length} chars]` : 'NOT SET');

// Test credential formatting
console.log('\n2. CREDENTIAL FORMATTING ANALYSIS:');
console.log('-'.repeat(40));

// Check vSphere username format
const vsphereUser = globalSettings.vsphere.user;
console.log('vSphere Username Raw:', JSON.stringify(vsphereUser));
console.log('Contains double backslash:', vsphereUser.includes('\\\\'));
console.log('Contains single backslash:', vsphereUser.includes('\\') && !vsphereUser.includes('\\\\'));

// Demonstrate proper formatting for govc
let formattedUser = vsphereUser;
if (vsphereUser.includes('\\\\')) {
    formattedUser = vsphereUser.replace('\\\\', '\\');
}
console.log('Formatted for GOVC:', JSON.stringify(formattedUser));

// Test URL formatting
const vsphereServer = globalSettings.vsphere.server;
console.log('vSphere Server Raw:', vsphereServer);
let formattedUrl = vsphereServer;
if (!vsphereServer.startsWith('https://') && !vsphereServer.startsWith('http://')) {
    formattedUrl = `https://${vsphereServer}`;
}
console.log('Formatted URL for GOVC:', formattedUrl);

// Test API endpoints with credentials
console.log('\n3. API ENDPOINT TESTING:');
console.log('-'.repeat(40));

const testAPIEndpoint = (path, payload, description) => {
    return new Promise((resolve) => {
        const postData = JSON.stringify(payload);
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        console.log(`Testing ${description}...`);
        console.log(`  Endpoint: POST ${path}`);
        console.log(`  Payload server: ${payload.vsphereServer || 'N/A'}`);
        console.log(`  Payload user: ${payload.vsphereUser || 'N/A'}`);
        console.log(`  Payload has password: ${payload.vspherePassword ? 'YES' : 'NO'}`);
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`  Response Status: ${res.statusCode}`);
                try {
                    const jsonData = JSON.parse(data);
                    console.log(`  Response Success: ${jsonData.success}`);
                    if (jsonData.error) {
                        console.log(`  Error Message: ${jsonData.error}`);
                        
                        // Analyze the error to understand the issue
                        if (jsonData.error.includes('govc binary not found')) {
                            console.log(`  ✅ Expected Error: govc binary not installed`);
                        } else if (jsonData.error.includes('connection')) {
                            console.log(`  🔍 Connection Issue: ${jsonData.error}`);
                        } else if (jsonData.error.includes('authentication') || jsonData.error.includes('login')) {
                            console.log(`  🔐 Authentication Issue: ${jsonData.error}`);
                        } else {
                            console.log(`  ❓ Other Issue: ${jsonData.error}`);
                        }
                    }
                    if (jsonData.templates) {
                        console.log(`  Templates Found: ${jsonData.templates.length}`);
                    }
                    if (jsonData.components) {
                        console.log(`  Components Found: ${jsonData.components.length}`);
                    }
                } catch (e) {
                    console.log(`  Raw Response: ${data.substring(0, 200)}...`);
                }
                console.log('');
                resolve();
            });
        });
        
        req.on('error', (err) => {
            console.log(`  Network Error: ${err.message}`);
            console.log('');
            resolve();
        });
        
        req.write(postData);
        req.end();
    });
};

// Test GOVC environment creation manually
console.log('\n4. MANUAL GOVC ENVIRONMENT CREATION:');
console.log('-'.repeat(40));

const createTestGovcEnv = (connectionDetails) => {
    let username = connectionDetails.user;
    if (username.includes('\\\\')) {
        username = username.replace('\\\\', '\\');
    }
    
    let server = connectionDetails.server;
    if (!server.startsWith('https://') && !server.startsWith('http://')) {
        server = `https://${server}`;
    }
    
    return {
        GOVC_URL: server,
        GOVC_USERNAME: username,
        GOVC_PASSWORD: connectionDetails.password,
        GOVC_INSECURE: '1'
    };
};

const testEnv = createTestGovcEnv(globalSettings.vsphere);
console.log('Generated GOVC Environment:');
console.log(`  GOVC_URL: ${testEnv.GOVC_URL}`);
console.log(`  GOVC_USERNAME: ${testEnv.GOVC_USERNAME}`);
console.log(`  GOVC_PASSWORD: [${testEnv.GOVC_PASSWORD.length} chars]`);
console.log(`  GOVC_INSECURE: ${testEnv.GOVC_INSECURE}`);

// Test govc binary availability
console.log('\n5. GOVC BINARY AVAILABILITY:');
console.log('-'.repeat(40));

const { exec } = require('child_process');
const govcPaths = [
    '/usr/local/bin/govc',
    '/usr/bin/govc',
    'govc', // Check if it's in PATH
    'C:\\Program Files\\govc\\govc.exe',
    'C:\\govc\\govc.exe'
];

const checkGovcBinary = (govcPath) => {
    return new Promise((resolve) => {
        exec(`"${govcPath}" version`, (error, stdout, stderr) => {
            if (error) {
                console.log(`  ❌ ${govcPath}: Not found or not executable`);
            } else {
                console.log(`  ✅ ${govcPath}: Available - ${stdout.trim()}`);
            }
            resolve();
        });
    });
};

(async () => {
    for (const govcPath of govcPaths) {
        await checkGovcBinary(govcPath);
    }
    
    console.log('\n6. API ENDPOINT TESTS WITH REAL CREDENTIALS:');
    console.log('-'.repeat(40));
    
    const vspherePayload = {
        vsphereServer: globalSettings.vsphere.server,
        vsphereUser: globalSettings.vsphere.user,
        vspherePassword: globalSettings.vsphere.password
    };
    
    const infraPayload = {
        ...vspherePayload,
        component: 'datacenters'
    };
    
    await testAPIEndpoint('/api/vsphere/templates', vspherePayload, 'vSphere Templates API');
    await testAPIEndpoint('/api/vsphere-infra/components', infraPayload, 'vSphere Infrastructure API');
    
    console.log('\n7. RECOMMENDATIONS:');
    console.log('-'.repeat(40));
    
    // Check if credentials look correct
    const hasValidCredentials = 
        globalSettings.vsphere.server && 
        globalSettings.vsphere.user && 
        globalSettings.vsphere.password;
    
    if (!hasValidCredentials) {
        console.log('❌ Missing or incomplete vSphere credentials');
    } else {
        console.log('✅ vSphere credentials appear complete');
    }
    
    // Check credential format
    if (globalSettings.vsphere.user.includes('\\\\')) {
        console.log('✅ Username contains domain separator (will be formatted for govc)');
    } else if (globalSettings.vsphere.user.includes('\\')) {
        console.log('✅ Username domain format looks correct');
    } else {
        console.log('⚠️  Username may be missing domain (check if required)');
    }
    
    console.log('');
    console.log('Next steps to enable full functionality:');
    console.log('1. Install govc binary for vSphere connectivity');
    console.log('2. Test network connectivity to vSphere server');
    console.log('3. Verify credentials have proper permissions');
    console.log('4. Check if SSL certificates are properly configured');
    
    console.log('\n' + '='.repeat(80));
    console.log('CREDENTIAL VERIFICATION COMPLETE');
    console.log('='.repeat(80));
})();
