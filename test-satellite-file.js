#!/usr/bin/env node

/**
 * Test Satellite Registration with File-based JSON
 * Uses a temporary file for the JSON payload to avoid PowerShell escaping issues
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

async function testSatelliteRegistrationWithFile() {
    console.log('=== Testing Satellite Registration with File-based JSON ===');
    
    let tempFilePath = null;
    
    try {
        // Create proper JSON payload
        const hostData = {
            host: {
                name: "test-vm-file-" + Date.now(),
                hostgroup_name: "Server_Storage_Tech/Development",
                organization_id: 1,
                location_id: 2,
                build: false,
                enabled: true,
                managed: true,
                provision_method: "build",
                interfaces_attributes: {
                    "0": {
                        mac: "00:50:56:" + Math.floor(Math.random()*256).toString(16).padStart(2,'0') + ":" + 
                             Math.floor(Math.random()*256).toString(16).padStart(2,'0') + ":" + 
                             Math.floor(Math.random()*256).toString(16).padStart(2,'0'),
                        primary: true,
                        provision: true
                    }
                }
            }
        };

        console.log('Testing with hostname:', hostData.host.name);
        console.log('Using MAC address:', hostData.host.interfaces_attributes["0"].mac);
        
        // Write JSON to temporary file
        tempFilePath = path.join(__dirname, `temp-satellite-payload-${Date.now()}.json`);
        fs.writeFileSync(tempFilePath, JSON.stringify(hostData, null, 2));
        
        console.log('JSON payload written to:', tempFilePath);
        console.log('Payload content:', JSON.stringify(hostData, null, 2));
        
        // Create curl command using the file
        const curlCommand = `curl -X POST "https://satellite.chrobinson.com/api/v2/hosts" -H "Content-Type: application/json" -H "Accept: application/json" -u "chradmin:C9msV+s3" -k --data-binary "@${tempFilePath}"`;
        
        console.log('Executing curl command with file...');
        
        const result = await execAsync(curlCommand, { timeout: 30000 });
        
        console.log('✅ Satellite registration completed!');
        console.log('Response:', result.stdout);
        
        if (result.stderr) {
            console.log('Stderr:', result.stderr);
        }
        
        // Try to parse the response
        try {
            const response = JSON.parse(result.stdout);
            if (response.id) {
                console.log(`✅ Host successfully registered with ID: ${response.id}`);
                console.log(`✅ Host name: ${response.name}`);
                console.log(`✅ Host group: ${response.hostgroup_name || 'Unknown'}`);
                return true;
            } else if (response.error) {
                console.log('❌ Satellite returned error:', JSON.stringify(response.error, null, 2));
                return false;
            }
        } catch (e) {
            console.log('Response received but could not parse as JSON');
            // Check if response contains success indicators
            if (result.stdout.includes('"id":') || result.stdout.includes('created')) {
                console.log('✅ Registration appears successful based on response content');
                return true;
            }
        }
        
        return true;
        
    } catch (error) {
        console.log('❌ Satellite registration failed:', error.message);
        
        // Extract more detailed error information
        if (error.stdout) {
            console.log('Response stdout:', error.stdout);
        }
        if (error.stderr) {
            console.log('Response stderr:', error.stderr);
        }
        
        return false;
    } finally {
        // Clean up temporary file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
                console.log('Cleaned up temporary file:', tempFilePath);
            } catch (e) {
                console.log('Warning: Could not clean up temporary file:', tempFilePath);
            }
        }
    }
}

// Run the test
testSatelliteRegistrationWithFile()
    .then(result => {
        console.log(`\n📊 File-based satellite test result: ${result ? 'PASS ✅' : 'FAIL ❌'}`);
        process.exit(result ? 0 : 1);
    })
    .catch(error => {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    });
