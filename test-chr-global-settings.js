/**
 * Test CHR Integration with Global Settings
 * Verifies that the satellite URL from global_settings.json is properly used
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing CHR Integration with Global Settings');

function testGlobalSettingsIntegration() {
    console.log('\n📋 Test 1: Verify global_settings.json contains satellite configuration');
    
    try {
        const globalSettingsPath = path.join(__dirname, 'www', 'global_settings.json');
        const globalSettings = JSON.parse(fs.readFileSync(globalSettingsPath, 'utf8'));
        
        // Check if satellite configuration exists
        if (!globalSettings.satellite) {
            console.log('❌ FAIL: No satellite configuration found in global_settings.json');
            return false;
        }
        
        if (!globalSettings.satellite.url) {
            console.log('❌ FAIL: No satellite URL found in global_settings.json');
            return false;
        }
        
        console.log('✅ PASS: Satellite configuration found');
        console.log(`  URL: ${globalSettings.satellite.url}`);
        console.log(`  Expected: https://satellite.chrobinson.com/api/v2`);
        
        if (globalSettings.satellite.url === 'https://satellite.chrobinson.com/api/v2') {
            console.log('✅ PASS: Satellite URL matches expected value');
        } else {
            console.log('⚠️ WARNING: Satellite URL differs from expected value');
        }
        
        return true;
        
    } catch (error) {
        console.log('❌ FAIL: Error reading global_settings.json:', error.message);
        return false;
    }
}

function testTerraformVariables() {
    console.log('\n📋 Test 2: Verify Terraform variables use correct default values');
    
    try {
        // Check root variables.tf
        const rootVariablesPath = path.join(__dirname, 'variables.tf');
        const rootVariablesContent = fs.readFileSync(rootVariablesPath, 'utf8');
        
        if (rootVariablesContent.includes('https://satellite.chrobinson.com/api/v2')) {
            console.log('✅ PASS: Root variables.tf contains correct satellite URL');
        } else {
            console.log('❌ FAIL: Root variables.tf does not contain correct satellite URL');
            return false;
        }
        
        // Check module variables.tf
        const moduleVariablesPath = path.join(__dirname, 'modules', 'vm', 'variables.tf');
        const moduleVariablesContent = fs.readFileSync(moduleVariablesPath, 'utf8');
        
        if (moduleVariablesContent.includes('https://satellite.chrobinson.com/api/v2')) {
            console.log('✅ PASS: Module variables.tf contains correct satellite URL');
        } else {
            console.log('❌ FAIL: Module variables.tf does not contain correct satellite URL');
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.log('❌ FAIL: Error reading Terraform variables:', error.message);
        return false;
    }
}

function testWebInterfaceIntegration() {
    console.log('\n📋 Test 3: Verify web interface generateTfvars function includes satellite URL');
    
    try {
        const scriptPath = path.join(__dirname, 'www', 'script.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        // Check if generateTfvars function includes satellite URL logic
        if (scriptContent.includes('window.globalSettings.satellite.url')) {
            console.log('✅ PASS: generateTfvars function includes satellite URL from global settings');
        } else {
            console.log('❌ FAIL: generateTfvars function does not include satellite URL logic');
            return false;
        }
        
        if (scriptContent.includes('chr_api_server =')) {
            console.log('✅ PASS: generateTfvars function includes chr_api_server variable');
        } else {
            console.log('❌ FAIL: generateTfvars function does not include chr_api_server variable');
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.log('❌ FAIL: Error reading script.js:', error.message);
        return false;
    }
}

function testDocumentation() {
    console.log('\n📋 Test 4: Verify documentation contains correct satellite URL');
    
    try {
        const docPath = path.join(__dirname, 'CHR-REGISTRATION.md');
        const docContent = fs.readFileSync(docPath, 'utf8');
        
        if (docContent.includes('https://satellite.chrobinson.com/api/v2')) {
            console.log('✅ PASS: Documentation contains correct satellite URL');
        } else {
            console.log('❌ FAIL: Documentation does not contain correct satellite URL');
            return false;
        }
        
        if (docContent.includes('password authentication')) {
            console.log('✅ PASS: Documentation mentions password authentication');
        } else {
            console.log('⚠️ INFO: Documentation may need update for password authentication');
        }
        
        return true;
        
    } catch (error) {
        console.log('❌ FAIL: Error reading CHR-REGISTRATION.md:', error.message);
        return false;
    }
}

function testProvisionerScript() {
    console.log('\n📋 Test 5: Verify VM provisioner uses correct API endpoint');
    
    try {
        const vmMainPath = path.join(__dirname, 'modules', 'vm', 'main.tf');
        const vmMainContent = fs.readFileSync(vmMainPath, 'utf8');
        
        if (vmMainContent.includes('chr/register')) {
            console.log('✅ PASS: VM provisioner includes CHR registration endpoint');
        } else {
            console.log('❌ FAIL: VM provisioner does not include CHR registration endpoint');
            return false;
        }
        
        if (vmMainContent.includes('${var.chr_api_server}')) {
            console.log('✅ PASS: VM provisioner uses chr_api_server variable');
        } else {
            console.log('❌ FAIL: VM provisioner does not use chr_api_server variable');
            return false;
        }
        
        if (vmMainContent.includes('password = var.ssh_password')) {
            console.log('✅ PASS: VM provisioner uses password authentication');
        } else {
            console.log('❌ FAIL: VM provisioner does not use password authentication');
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.log('❌ FAIL: Error reading VM main.tf:', error.message);
        return false;
    }
}

// Run all tests
function runAllTests() {
    console.log('🚀 Starting CHR Global Settings Integration Tests\n');
    
    const tests = [
        testGlobalSettingsIntegration,
        testTerraformVariables,
        testWebInterfaceIntegration,
        testDocumentation,
        testProvisionerScript
    ];
    
    let passed = 0;
    let failed = 0;
    
    tests.forEach((test, index) => {
        try {
            if (test()) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.log(`❌ FAIL: Test ${index + 1} threw an error:`, error.message);
            failed++;
        }
    });
    
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📋 Total:  ${tests.length}`);
    
    if (failed === 0) {
        console.log('\n🎉 All CHR Global Settings Integration tests passed!');
        console.log('\n🔍 Next Steps:');
        console.log('1. Test the web interface at http://localhost:3000');
        console.log('2. Verify that generated tfvars include chr_api_server');
        console.log('3. Deploy a test VM to validate CHR registration');
        console.log('4. Monitor CHR registration process in satellite logs');
    } else {
        console.log('\n⚠️  Some tests failed. Please review the output above.');
    }
    
    return failed === 0;
}

// Run the tests
runAllTests();
