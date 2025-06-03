#!/usr/bin/env node

/**
 * Test Real Satellite Registration
 * Tests the actual CHR registration against satellite.chrobinson.com
 */

const http = require('http');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

async function testRealSatelliteRegistration() {
    console.log('=== Testing Real Satellite Registration ===');
    
    try {
        // First, get a registration command from our local server
        console.log('Getting registration command from localhost:3000...');
        
        const response = await makeRequest('http://localhost:3000/chr/register', {
            method: 'POST',
            body: {
                hostgroup_name: 'Server_Storage_Tech/Development',
                auto_run: false
            }
        });
        
        if (!response.data || !response.data.registration_command) {
            console.log('❌ Failed to get registration command from local server');
            return false;
        }
        
        console.log('✅ Got registration command from local server');
          // Create a unique hostname for this test
        const testHostname = `test-vm-terraform-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
        const command = response.data.registration_command;
        
        // Modify the command to use our test hostname
        const modifiedCommand = command.replace(/\"name\": \"[^\"]*\"/, `"name": "${testHostname}"`);
        
        console.log(`Executing registration against satellite.chrobinson.com with hostname: ${testHostname}`);
        
        // Execute the actual curl command
        const result = await execAsync(modifiedCommand, { timeout: 30000 });
        
        console.log('✅ Real satellite registration successful!');
        console.log('stdout:', result.stdout);
        
        if (result.stderr) {
            console.log('stderr:', result.stderr);
        }
        
        // Try to parse the response to get host details
        try {
            const satelliteResponse = JSON.parse(result.stdout);
            if (satelliteResponse.id) {
                console.log(`✅ Host registered with ID: ${satelliteResponse.id}`);
                console.log(`✅ Host name: ${satelliteResponse.name || testHostname}`);
                console.log(`✅ Host group: ${satelliteResponse.hostgroup_name || 'Server_Storage_Tech/Development'}`);
            }
        } catch (e) {
            console.log('Registration succeeded but could not parse response JSON');
        }
        
        return true;
        
    } catch (error) {
        console.log('❌ Real satellite registration failed:', error.message);
        console.log('Error details:', error.toString());
        return false;
    }
}

async function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers
            }
        };

        const req = http.request(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = data ? JSON.parse(data) : {};
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: jsonData,
                        raw: data
                    });
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data,
                        raw: data
                    });
                }
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }

        req.end();
    });
}

// Run the test
testRealSatelliteRegistration()
    .then(result => {
        console.log(`\n📊 Real satellite test result: ${result ? 'PASS ✅' : 'FAIL ❌'}`);
        process.exit(result ? 0 : 1);
    })
    .catch(error => {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    });
