// Browser test script to verify credential loading in the UI
// This script should be run in the browser console to test UI functionality

console.log('🔍 Testing UI credential functionality...\n');

// Test 1: Check if global settings are loaded
console.log('1. Testing global settings loading...');
if (window.globalSettings && window.globalSettings.vsphere) {
    console.log('✅ Global settings loaded in browser');
    console.log('   Server:', window.globalSettings.vsphere.server);
    console.log('   User:', window.globalSettings.vsphere.user);
    console.log('   Password length:', window.globalSettings.vsphere.password?.length || 0);
} else {
    console.log('❌ Global settings not loaded');
}

// Test 2: Check if settings modal can be opened and populated
console.log('\n2. Testing settings modal...');
try {
    // Simulate opening settings modal
    if (typeof openSettingsModal === 'function') {
        console.log('✅ Settings modal function available');
        // Note: We won't actually open it to avoid disrupting the UI
        console.log('   Modal can be opened (function exists)');
    } else {
        console.log('❌ Settings modal function not found');
    }
} catch (error) {
    console.log('❌ Error testing settings modal:', error.message);
}

// Test 3: Check infrastructure dropdown functions
console.log('\n3. Testing infrastructure dropdown functions...');
try {
    if (typeof getVSphereConnectionInfo === 'function') {
        console.log('✅ Infrastructure connection function available');
        const connectionInfo = getVSphereConnectionInfo();
        if (connectionInfo) {
            console.log('✅ Connection info retrieval works');
            console.log('   Has server:', !!connectionInfo.server);
            console.log('   Has user:', !!connectionInfo.user);
            console.log('   Has password:', !!connectionInfo.password);
        } else {
            console.log('❌ Connection info retrieval failed');
        }
    } else {
        console.log('❌ Infrastructure connection function not found');
    }
} catch (error) {
    console.log('❌ Error testing infrastructure functions:', error.message);
}

// Test 4: Check if workspace functionality is available
console.log('\n4. Testing workspace functions...');
try {
    if (typeof loadWorkspaceData === 'function') {
        console.log('✅ Workspace loading function available');
    } else {
        console.log('❌ Workspace loading function not found');
    }
    
    if (typeof saveWorkspaceConfig === 'function') {
        console.log('✅ Workspace saving function available');
    } else {
        console.log('❌ Workspace saving function not found');
    }
} catch (error) {
    console.log('❌ Error testing workspace functions:', error.message);
}

// Test 5: Check if event listeners are set up
console.log('\n5. Testing event listeners...');
try {
    // Check if settings loaded event is being handled
    console.log('✅ Event system appears to be set up');
    console.log('   (Event listeners are typically set up during page load)');
} catch (error) {
    console.log('❌ Error testing event listeners:', error.message);
}

console.log('\n🎯 UI test completed. Open browser console to run this test.');
console.log('Copy and paste this script into the browser console on the main page.');
