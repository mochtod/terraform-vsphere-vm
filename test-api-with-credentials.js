const http = require('http');

// Read the credentials from global_settings.json
const fs = require('fs');
const path = require('path');
const settingsPath = path.join(__dirname, 'www', 'global_settings.json');

let credentials = null;
try {
    const settingsData = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(settingsData);
    credentials = settings.vsphere;
    console.log(`Loaded credentials for server: ${credentials.server}, user: ${credentials.user}`);
} catch (error) {
    console.error('Failed to load credentials:', error.message);
    process.exit(1);
}

// Test the vSphere API endpoints with POST requests
const testEndpoint = (path, payload, description) => {
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
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`${description}:`);
                console.log(`  Status: ${res.statusCode}`);
                try {
                    const jsonData = JSON.parse(data);
                    console.log(`  Success: ${jsonData.success}`);
                    if (jsonData.error) {
                        console.log(`  Error: ${jsonData.error}`);
                    }
                    if (jsonData.templates) {
                        console.log(`  Templates found: ${jsonData.templates.length}`);
                    }
                    if (jsonData.components) {
                        console.log(`  Components found: ${jsonData.components.length}`);
                    }
                } catch (e) {
                    console.log(`  Response: ${data.substring(0, 200)}...`);
                }
                console.log('');
                resolve();
            });
        });
        
        req.on('error', (err) => {
            console.log(`${description}: ERROR - ${err.message}`);
            console.log('');
            resolve();
        });
        
        req.write(postData);
        req.end();
    });
};

(async () => {
    console.log('Testing vSphere API endpoints with actual credentials...\n');
    
    const vspherePayload = {
        vsphereServer: credentials.server,
        vsphereUser: credentials.user,
        vspherePassword: credentials.password
    };
    
    const infraPayload = {
        ...vspherePayload,
        component: 'datacenters'
    };
    
    await testEndpoint('/api/vsphere/templates', vspherePayload, 'vSphere Templates API');
    await testEndpoint('/api/vsphere-infra/components', infraPayload, 'vSphere Infrastructure API (Datacenters)');
    
    console.log('API endpoint testing complete.');
})();
