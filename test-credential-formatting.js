// Test to verify credential formatting for vSphere authentication
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

// Simulate the createGovcEnv function
function createGovcEnv(connectionDetails) {
    // Handle domain usernames properly - ensure single backslash for domain\username format
    let username = connectionDetails.user;
    if (username.includes('\\\\')) {
        // Convert double backslash (from JSON) to single backslash for GOVC
        username = username.replace('\\\\', '\\');
    }
    
    // Build URL - try multiple formats based on what govc expects
    let server = connectionDetails.server;
    
    // Ensure https protocol
    if (!server.startsWith('https://') && !server.startsWith('http://')) {
        server = `https://${server}`;
    }
    
    // For govc, try the simple server URL first (without /sdk)
    let url = server;
    
    return {
        GOVC_URL: url,
        GOVC_USERNAME: username,
        GOVC_PASSWORD: connectionDetails.password,
        GOVC_INSECURE: '1' // Skip certificate verification
    };
}

function testCredentialFormatting() {
    console.log('🔍 Testing Credential Formatting...');
    console.log(`⏰ Time: ${new Date().toISOString()}\n`);
    
    const credentials = loadCredentials();
    if (!credentials) {
        console.log('❌ Cannot proceed without credentials');
        return;
    }
    
    console.log('📂 Raw credentials from global_settings.json:');
    console.log(`  Server: "${credentials.server}"`);
    console.log(`  User: "${credentials.user}"`);
    console.log(`  Password: "${credentials.password.substring(0, 10)}..."`);
    
    console.log('\n🔧 Processing credentials through createGovcEnv...');
    const govcEnv = createGovcEnv(credentials);
    
    console.log('📝 Processed GOVC environment variables:');
    console.log(`  GOVC_URL: "${govcEnv.GOVC_URL}"`);
    console.log(`  GOVC_USERNAME: "${govcEnv.GOVC_USERNAME}"`);
    console.log(`  GOVC_PASSWORD: "${govcEnv.GOVC_PASSWORD.substring(0, 10)}..."`);
    console.log(`  GOVC_INSECURE: "${govcEnv.GOVC_INSECURE}"`);
    
    console.log('\n✅ Credential formatting test complete!');
    
    // Check if the username transformation worked correctly
    if (credentials.user.includes('\\\\') && govcEnv.GOVC_USERNAME.includes('\\') && !govcEnv.GOVC_USERNAME.includes('\\\\')) {
        console.log('✅ Username transformation: PASSED (double backslash converted to single)');
    } else {
        console.log('⚠️  Username transformation: Check needed');
        console.log(`   Original: "${credentials.user}"`);
        console.log(`   Processed: "${govcEnv.GOVC_USERNAME}"`);
    }
}

// Run the test
testCredentialFormatting();
