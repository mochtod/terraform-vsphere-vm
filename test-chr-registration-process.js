#!/usr/bin/env node

/**
 * CHR Registration Process Test Script
 * 
 * This script tests the complete CHR registration process that would occur
 * during the remote-exec part of the Terraform plan/apply against localhost:3000
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

class CHRRegistrationTester {
    constructor() {
        this.serverUrl = 'http://localhost:3000';
        this.testResults = [];
        this.testHostGroup = 'Server_Storage_Tech/Development';
        this.testHostname = 'test-vm-' + Date.now();
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}`;
        console.log(logMessage);
        this.testResults.push({ timestamp, level, message });
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;
            
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...options.headers
                },
                rejectUnauthorized: false // For self-signed certificates
            };

            const req = client.request(requestOptions, (res) => {
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

    async testServerConnectivity() {
        this.log('=== Testing Server Connectivity ===');
        
        try {
            const response = await this.makeRequest(`${this.serverUrl}/`);
            
            if (response.statusCode === 200) {
                this.log('✅ Server is running and accessible');
                return true;
            } else {
                this.log(`❌ Server responded with status code: ${response.statusCode}`, 'ERROR');
                return false;
            }
        } catch (error) {
            this.log(`❌ Failed to connect to server: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async testCHRRegisterEndpoint() {
        this.log('=== Testing CHR Register Endpoint ===');
        
        // Test the endpoint that the remote-exec provisioner calls
        const chrRegisterUrl = `${this.serverUrl}/chr/register`;
        const payload = {
            hostgroup_name: this.testHostGroup,
            auto_run: false
        };

        try {
            const response = await this.makeRequest(chrRegisterUrl, {
                method: 'POST',
                body: payload
            });

            this.log(`CHR Register endpoint status: ${response.statusCode}`);
            this.log(`Response: ${JSON.stringify(response.data, null, 2)}`);

            if (response.statusCode === 200 && response.data && response.data.registration_command) {
                this.log('✅ CHR Register endpoint is working');
                this.log(`Registration command: ${response.data.registration_command}`);
                return { success: true, command: response.data.registration_command };
            } else if (response.statusCode === 404) {
                this.log('❌ CHR Register endpoint not found - need to implement it', 'ERROR');
                return { success: false, error: 'Endpoint not found' };
            } else {
                this.log(`❌ CHR Register endpoint returned unexpected response`, 'ERROR');
                return { success: false, error: 'Unexpected response' };
            }
        } catch (error) {
            this.log(`❌ Failed to call CHR Register endpoint: ${error.message}`, 'ERROR');
            return { success: false, error: error.message };
        }
    }

    async testSatelliteRegistrationCommandEndpoint() {
        this.log('=== Testing Satellite Registration Command Endpoint ===');
        
        // Test the existing satellite API endpoint
        const satelliteUrl = `${this.serverUrl}/api/satellite/registration-command`;
        const payload = {
            hostGroup: this.testHostGroup,
            hostname: this.testHostname
        };

        try {
            const response = await this.makeRequest(satelliteUrl, {
                method: 'POST',
                body: payload
            });

            this.log(`Satellite registration command endpoint status: ${response.statusCode}`);
            this.log(`Response: ${JSON.stringify(response.data, null, 2)}`);

            if (response.statusCode === 200 && response.data && response.data.success) {
                this.log('✅ Satellite registration command endpoint is working');
                this.log(`Generated command: ${response.data.command}`);
                return { success: true, command: response.data.command };
            } else {
                this.log(`❌ Satellite registration command endpoint failed`, 'ERROR');
                return { success: false, error: response.data?.error || 'Unknown error' };
            }
        } catch (error) {
            this.log(`❌ Failed to call satellite registration command endpoint: ${error.message}`, 'ERROR');
            return { success: false, error: error.message };
        }
    }

    async testHostGroupsEndpoint() {
        this.log('=== Testing Host Groups Endpoint ===');
        
        const hostGroupsUrl = `${this.serverUrl}/api/satellite/host-groups`;

        try {
            const response = await this.makeRequest(hostGroupsUrl);

            this.log(`Host groups endpoint status: ${response.statusCode}`);
            this.log(`Response: ${JSON.stringify(response.data, null, 2)}`);

            if (response.statusCode === 200 && response.data && response.data.success) {
                this.log('✅ Host groups endpoint is working');
                this.log(`Found ${response.data.hostGroups?.length || 0} host groups`);
                return { success: true, hostGroups: response.data.hostGroups };
            } else {
                this.log(`❌ Host groups endpoint failed`, 'ERROR');
                return { success: false, error: response.data?.error || 'Unknown error' };
            }
        } catch (error) {
            this.log(`❌ Failed to call host groups endpoint: ${error.message}`, 'ERROR');
            return { success: false, error: error.message };
        }
    }

    async simulateRemoteExecRegistration() {
        this.log('=== Simulating Remote-Exec Registration Process ===');
        
        // Simulate the exact process that happens in the remote-exec provisioner
        this.log('Simulating VM post-deployment registration...');
        
        // Step 1: Parse CHR URL (simulated)
        const chrUrl = 'http://localhost:3000';
        const chrHostname = 'localhost';
        const chrIp = '127.0.0.1';
        
        this.log(`CHR hostname: ${chrHostname}`);
        this.log(`CHR IP fallback: ${chrIp}`);
        
        // Step 2: Test network connectivity (simulated)
        this.log('Testing connectivity to CHR satellite...');
        const connectivityTest = await this.testServerConnectivity();
        
        if (!connectivityTest) {
            this.log('❌ Network connectivity test failed', 'ERROR');
            return false;
        }
        
        // Step 3: Test HTTP connectivity
        this.log('Testing HTTP connectivity to CHR satellite...');
        try {
            const response = await this.makeRequest(chrUrl);
            if (response.statusCode >= 200 && response.statusCode < 600) {
                this.log(`✅ HTTP connectivity to CHR satellite: OK (Status code: ${response.statusCode})`);
            } else {
                this.log(`❌ HTTP connectivity test failed (Status code: ${response.statusCode})`, 'ERROR');
            }
        } catch (error) {
            this.log(`❌ HTTP connectivity test failed: ${error.message}`, 'ERROR');
        }
        
        // Step 4: Attempt registration with retry logic
        this.log('======================================================');
        this.log('===== STARTING CHR REGISTRATION PROCESS ==============');
        this.log('======================================================');
        this.log(`Host group: ${this.testHostGroup}`);
        this.log(`CHR API Server: ${chrUrl}`);
        
        const maxRetries = 3;
        let registrationSuccess = false;
        
        for (let retryCount = 0; retryCount < maxRetries && !registrationSuccess; retryCount++) {
            this.log(`CHR registration attempt ${retryCount + 1} of ${maxRetries}...`);
            
            this.log('Requesting registration command from CHR API...');
            const registrationResult = await this.testCHRRegisterEndpoint();
            
            if (registrationResult.success) {
                this.log('✅ Registration command received from CHR API');
                this.log('Executing CHR registration command...');
                
                // In a real scenario, this command would be executed on the VM
                // For testing, we'll just validate the command format
                if (this.validateRegistrationCommand(registrationResult.command)) {
                    this.log('✅ CHR registration completed successfully!');
                    registrationSuccess = true;
                    
                    this.log('Verifying registration status...');
                    // In real scenario: subscription-manager status would be called
                    this.log('✅ Registration verification completed');
                } else {
                    this.log('❌ Registration command execution failed or timed out', 'ERROR');
                }
            } else {
                this.log('❌ Failed to retrieve valid registration command from CHR API', 'ERROR');
                this.log(`API Response: ${registrationResult.error || 'Unknown error'}`);
                
                // Test fallback connectivity
                this.log('Testing direct connectivity to CHR API...');
                const statusResult = await this.testCHRStatusEndpoint();
                if (!statusResult.success) {
                    this.log('❌ API connectivity test failed', 'ERROR');
                }
            }
            
            if (!registrationSuccess && retryCount < maxRetries - 1) {
                this.log('Waiting 5 seconds before retry attempt...');
                // Reduced wait time for testing
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        if (registrationSuccess) {
            this.log('======================================================');
            this.log('===== CHR REGISTRATION PROCESS SUCCEEDED =============');
            this.log('======================================================');
            this.log('VM is now registered with CHR Satellite and ready for management');
            return true;
        } else {
            this.log('======================================================');
            this.log('===== CHR REGISTRATION PROCESS FAILED ================');
            this.log('======================================================');
            this.log(`Registration failed after ${maxRetries} attempts`);
            this.log('VM deployment completed, but CHR registration was unsuccessful');
            return false;
        }
    }

    async testCHRStatusEndpoint() {
        this.log('Testing CHR API status endpoint...');
        
        const statusUrl = `${this.serverUrl}/status`;
        
        try {
            const response = await this.makeRequest(statusUrl);
            
            if (response.statusCode === 200) {
                this.log('✅ API status endpoint responded successfully');
                return { success: true };
            } else if (response.statusCode === 404) {
                this.log('❌ API status endpoint not found - 404 Not Found', 'ERROR');
                return { success: false, error: '404 Not Found' };
            } else {
                this.log(`❌ API status endpoint returned: ${response.statusCode}`, 'ERROR');
                return { success: false, error: `Status code: ${response.statusCode}` };
            }
        } catch (error) {
            this.log(`❌ Failed to call status endpoint: ${error.message}`, 'ERROR');
            return { success: false, error: error.message };
        }
    }

    validateRegistrationCommand(command) {
        if (!command || typeof command !== 'string') {
            this.log('❌ Invalid registration command format', 'ERROR');
            return false;
        }
        
        // Check if the command looks like a valid registration command
        const hasExpectedPatterns = [
            'curl',
            'POST',
            'hosts',
            'Content-Type',
            'application/json'
        ].some(pattern => command.includes(pattern));
        
        if (hasExpectedPatterns) {
            this.log('✅ Registration command format appears valid');
            return true;
        } else {
            this.log('❌ Registration command format does not match expected patterns', 'ERROR');
            return false;
        }
    }

    async generateTestReport() {
        this.log('=== Test Report Summary ===');
        
        const errors = this.testResults.filter(r => r.level === 'ERROR');
        const warnings = this.testResults.filter(r => r.level === 'WARN');
        
        this.log(`Total test steps: ${this.testResults.length}`);
        this.log(`Errors: ${errors.length}`);
        this.log(`Warnings: ${warnings.length}`);
        
        if (errors.length > 0) {
            this.log('\n=== ERRORS FOUND ===', 'ERROR');
            errors.forEach(error => {
                this.log(`- ${error.message}`, 'ERROR');
            });
        }
        
        if (warnings.length > 0) {
            this.log('\n=== WARNINGS FOUND ===', 'WARN');
            warnings.forEach(warning => {
                this.log(`- ${warning.message}`, 'WARN');
            });
        }
        
        const success = errors.length === 0;
        this.log(`\n=== OVERALL RESULT: ${success ? 'PASS ✅' : 'FAIL ❌'} ===`);
        
        return {
            success,
            totalSteps: this.testResults.length,
            errors: errors.length,
            warnings: warnings.length,
            results: this.testResults
        };
    }

    async runAllTests() {
        this.log('Starting CHR Registration Process Test');
        this.log(`Target server: ${this.serverUrl}`);
        this.log(`Test host group: ${this.testHostGroup}`);
        this.log(`Test hostname: ${this.testHostname}`);
        
        try {
            // Test 1: Server connectivity
            const connectivityOk = await this.testServerConnectivity();
            if (!connectivityOk) {
                this.log('Aborting tests - server not accessible', 'ERROR');
                return await this.generateTestReport();
            }
            
            // Test 2: CHR register endpoint (main endpoint used by remote-exec)
            await this.testCHRRegisterEndpoint();
            
            // Test 3: Alternative satellite registration command endpoint
            await this.testSatelliteRegistrationCommandEndpoint();
            
            // Test 4: Host groups endpoint
            await this.testHostGroupsEndpoint();
            
            // Test 5: Simulate complete registration process
            await this.simulateRemoteExecRegistration();
            
            // Generate final report
            return await this.generateTestReport();
            
        } catch (error) {
            this.log(`Unexpected error during testing: ${error.message}`, 'ERROR');
            return await this.generateTestReport();
        }
    }
}

// Run the tests if this script is executed directly
if (require.main === module) {
    const tester = new CHRRegistrationTester();
    
    tester.runAllTests()
        .then(report => {
            console.log('\n📊 Test completed');
            console.log(`🎯 Result: ${report.success ? 'PASS' : 'FAIL'}`);
            process.exit(report.success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = CHRRegistrationTester;
