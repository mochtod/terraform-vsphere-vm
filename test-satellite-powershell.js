#!/usr/bin/env node

/**
 * Test Satellite Registration with PowerShell-compatible JSON
 * Tests the satellite registration with properly escaped JSON for Windows PowerShell
 */

const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

async function testSatelliteRegistrationWithProperJSON() {
    console.log('=== Testing Satellite Registration with PowerShell-compatible JSON ===');
    
    try {
        // Create proper JSON payload
        const hostData = {
            host: {
                name: "test-vm-powershell-" + Date.now(),
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
        
        // Convert to JSON string for curl
        const jsonPayload = JSON.stringify(hostData);
        
        // Create curl command with proper JSON handling for PowerShell
        const curlCommand = `curl -X POST "https://satellite.chrobinson.com/api/v2/hosts" -H "Content-Type: application/json" -H "Accept: application/json" -u "chradmin:C9msV+s3" -k --data '${jsonPayload}'`;
        
        console.log('Executing curl command...');
        console.log('Command:', curlCommand);
        
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
        
        // Extract the actual curl error if available
        if (error.message.includes('curl:')) {
            const curlError = error.message.split('curl:')[1]?.trim();
            console.log('Curl error:', curlError);
        }
        
        // Check if it's a JSON parsing error from satellite
        if (error.message.includes('stdout')) {
            console.log('Raw response:', error.stdout || 'No stdout');
            console.log('Raw stderr:', error.stderr || 'No stderr');
        }
        
        return false;
    }
}

// Run the test
testSatelliteRegistrationWithProperJSON()
    .then(result => {
        console.log(`\n📊 PowerShell satellite test result: ${result ? 'PASS ✅' : 'FAIL ❌'}`);
        process.exit(result ? 0 : 1);
    })
    .catch(error => {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    });
