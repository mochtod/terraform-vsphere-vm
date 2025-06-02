// Test different govc commands to see which ones work with our credentials
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

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

// Simulate the createGovcEnv function
function createGovcEnv(connectionDetails) {
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
}

// Test a govc command
function testGovcCommand(command, env, description) {
    return new Promise((resolve) => {
        console.log(`\n🔍 Testing: ${description}`);
        console.log(`📝 Command: govc ${command}`);
        
        const fullCommand = `/usr/local/bin/govc ${command}`;
        
        exec(fullCommand, { env: { ...process.env, ...env } }, (error, stdout, stderr) => {
            if (error) {
                console.log(`❌ Error: ${error.message}`);
                if (stderr) console.log(`📄 stderr: ${stderr}`);
            } else {
                console.log(`✅ Success!`);
                if (stdout) {
                    const lines = stdout.trim().split('\n');
                    console.log(`📊 Output (${lines.length} lines):`);
                    lines.slice(0, 5).forEach(line => console.log(`  ${line}`));
                    if (lines.length > 5) console.log(`  ... and ${lines.length - 5} more lines`);
                }
            }
            resolve();
        });
    });
}

async function testGovcCommands() {
    console.log('🔍 Testing different govc commands...');
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    
    const credentials = loadCredentials();
    if (!credentials) {
        console.log('❌ Cannot proceed without credentials');
        return;
    }
    
    const env = createGovcEnv(credentials);
    console.log(`🔑 Using: ${env.GOVC_URL} with user ${env.GOVC_USERNAME}`);
    
    // Test commands in order of complexity
    await testGovcCommand('about', env, 'Basic connection test');
    await testGovcCommand('ls', env, 'List root (datacenter discovery)');
    await testGovcCommand('find / -type d', env, 'Find datacenters');
    await testGovcCommand('find / -type m -config.template true', env, 'Find templates (known working)');
    
    console.log('\n✅ All tests completed!');
}

// Run the tests
testGovcCommands().catch(console.error);
