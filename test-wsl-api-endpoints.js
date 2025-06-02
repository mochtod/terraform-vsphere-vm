// Direct API test with proper error handling
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load credentials
const settingsPath = path.join(__dirname, 'www', 'global_settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

console.log('Testing vSphere API with WSL govc...\n');

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
            },
            timeout: 30000 // 30 second timeout
        };
        
        console.log(`Testing ${description}...`);
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`✅ ${description}:`);
                console.log(`  Status: ${res.statusCode}`);
                try {
                    const jsonData = JSON.parse(data);
                    console.log(`  Success: ${jsonData.success}`);
                    if (jsonData.error) {
                        console.log(`  Error: ${jsonData.error}`);
                    }
                    if (jsonData.templates) {
                        console.log(`  Templates found: ${jsonData.templates.length}`);
                        if (jsonData.templates.length > 0) {
                            console.log(`  Sample templates:`);
                            jsonData.templates.slice(0, 3).forEach(template => {
                                console.log(`    - ${template.name || template.id}`);
                            });
                        }
                    }
                    if (jsonData.components) {
                        console.log(`  Components found: ${jsonData.components.length}`);
                        if (jsonData.components.length > 0) {
                            console.log(`  Sample components:`);
                            jsonData.components.slice(0, 3).forEach(component => {
                                console.log(`    - ${component.name || component.id}`);
                            });
                        }
                    }
                } catch (e) {
                    console.log(`  Raw response: ${data.substring(0, 500)}...`);
                }
                console.log('');
                resolve();
            });
        });
        
        req.on('error', (err) => {
            console.log(`❌ ${description}: ${err.message}`);
            console.log('');
            resolve();
        });
        
        req.on('timeout', () => {
            console.log(`⏱️  ${description}: Request timed out`);
            req.destroy();
            resolve();
        });
        
        req.write(postData);
        req.end();
    });
};

(async () => {
    const vspherePayload = {
        vsphereServer: settings.vsphere.server,
        vsphereUser: settings.vsphere.user,
        vspherePassword: settings.vsphere.password
    };
    
    const infraPayload = {
        ...vspherePayload,
        component: 'datacenters'
    };
    
    await testEndpoint('/api/vsphere/templates', vspherePayload, 'vSphere Templates API');
    await testEndpoint('/api/vsphere-infra/components', infraPayload, 'vSphere Infrastructure API (Datacenters)');
    
    console.log('API testing complete!');
})();
