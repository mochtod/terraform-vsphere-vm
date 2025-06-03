/**
 * CHR Integration End-to-End Test
 * Validates the complete workflow from web interface through Terraform deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing CHR Integration End-to-End...\n');

// Test 1: Verify web interface form includes vm_host_group field
function testWebFormIntegration() {
    console.log('1. Testing Web Form Integration...');
    
    const htmlPath = path.join(__dirname, 'www', 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // Check for host group field
    const hasHostGroupField = htmlContent.includes('name="vm_host_group"');
    const hasHostGroupLabel = htmlContent.includes('Host Group (Linux only)');
    
    console.log(`   ✓ Host Group field present: ${hasHostGroupField}`);
    console.log(`   ✓ Host Group label present: ${hasHostGroupLabel}`);
    
    return hasHostGroupField && hasHostGroupLabel;
}

// Test 2: Verify JavaScript generates tfvars with vm_host_group
function testTfvarsGeneration() {
    console.log('\n2. Testing Tfvars Generation...');
    
    const scriptPath = path.join(__dirname, 'www', 'script.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    // Check that generateTfvars function includes all form fields
    const hasGenerateTfvars = scriptContent.includes('function generateTfvars()');
    const hasFormDataLoop = scriptContent.includes('for (const [key, value] of formData.entries())');
    const excludesPassword = scriptContent.includes('if (key !== \'vsphere_password\')');
    
    console.log(`   ✓ generateTfvars function exists: ${hasGenerateTfvars}`);
    console.log(`   ✓ Loops through all form fields: ${hasFormDataLoop}`);
    console.log(`   ✓ Excludes password field: ${excludesPassword}`);
    
    return hasGenerateTfvars && hasFormDataLoop && excludesPassword;
}

// Test 3: Verify Terraform root variables include CHR settings
function testTerraformRootVariables() {
    console.log('\n3. Testing Terraform Root Variables...');
    
    const variablesPath = path.join(__dirname, 'variables.tf');
    const variablesContent = fs.readFileSync(variablesPath, 'utf8');
    
    const chrVariables = [
        'vm_host_group',
        'chr_api_server',
        'ssh_private_key_path',
        'ssh_user'
    ];
    
    const results = chrVariables.map(varName => {
        const hasVariable = variablesContent.includes(`variable "${varName}"`);
        console.log(`   ✓ Variable ${varName}: ${hasVariable}`);
        return hasVariable;
    });
    
    return results.every(result => result);
}

// Test 4: Verify main.tf passes CHR variables to VM module
function testMainTfModuleCall() {
    console.log('\n4. Testing Main.tf Module Call...');
    
    const mainPath = path.join(__dirname, 'main.tf');
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    
    const chrVariables = [
        'vm_host_group',
        'chr_api_server',
        'ssh_private_key_path',
        'ssh_user'
    ];
      const results = chrVariables.map(varName => {
        const hasVariable = mainContent.includes(`${varName}`) && mainContent.includes(`var.${varName}`);
        console.log(`   ✓ Passes ${varName} to module: ${hasVariable}`);
        return hasVariable;
    });
    
    return results.every(result => result);
}

// Test 5: Verify VM module variables
function testVmModuleVariables() {
    console.log('\n5. Testing VM Module Variables...');
    
    const vmVariablesPath = path.join(__dirname, 'modules', 'vm', 'variables.tf');
    const vmVariablesContent = fs.readFileSync(vmVariablesPath, 'utf8');
    
    const chrVariables = [
        'vm_host_group',
        'chr_api_server',
        'ssh_private_key_path',
        'ssh_user'
    ];
    
    const results = chrVariables.map(varName => {
        const hasVariable = vmVariablesContent.includes(`variable "${varName}"`);
        console.log(`   ✓ VM Module variable ${varName}: ${hasVariable}`);
        return hasVariable;
    });
    
    return results.every(result => result);
}

// Test 6: Verify VM module provisioner implementation
function testVmModuleProvisioner() {
    console.log('\n6. Testing VM Module Provisioner...');
    
    const vmMainPath = path.join(__dirname, 'modules', 'vm', 'main.tf');
    const vmMainContent = fs.readFileSync(vmMainPath, 'utf8');
      const hasProvisioner = vmMainContent.includes('provisioner "remote-exec"');
    const hasChrCondition = vmMainContent.includes('vm_host_group');
    const hasCurlCommand = vmMainContent.includes('curl -sS -X POST');
    const hasJqCommand = vmMainContent.includes('| jq -r');
    const hasRegistrationLogic = vmMainContent.includes('registration_command');
    
    console.log(`   ✓ Remote-exec provisioner: ${hasProvisioner}`);
    console.log(`   ✓ CHR condition check: ${hasChrCondition}`);
    console.log(`   ✓ Curl command: ${hasCurlCommand}`);
    console.log(`   ✓ JQ command: ${hasJqCommand}`);
    console.log(`   ✓ Registration logic: ${hasRegistrationLogic}`);
    
    return hasProvisioner && hasChrCondition && hasCurlCommand && hasJqCommand && hasRegistrationLogic;
}

// Test 7: Verify documentation exists
function testDocumentation() {
    console.log('\n7. Testing Documentation...');
    
    const docPath = path.join(__dirname, 'CHR-REGISTRATION.md');
    const docExists = fs.existsSync(docPath);
    
    if (docExists) {
        const docContent = fs.readFileSync(docPath, 'utf8');
        const hasUsageSection = docContent.includes('## Usage');
        const hasExampleSection = docContent.includes('## Example');
        const hasTroubleshootingSection = docContent.includes('## Troubleshooting');
        
        console.log(`   ✓ Documentation file exists: ${docExists}`);
        console.log(`   ✓ Usage section: ${hasUsageSection}`);
        console.log(`   ✓ Example section: ${hasExampleSection}`);
        console.log(`   ✓ Troubleshooting section: ${hasTroubleshootingSection}`);
        
        return hasUsageSection && hasExampleSection && hasTroubleshootingSection;
    }
    
    console.log(`   ✗ Documentation file missing: ${docPath}`);
    return false;
}

// Run all tests
async function runAllTests() {
    console.log('🚀 CHR Integration Test Suite\n');
    console.log('=' .repeat(50));
    
    const tests = [
        { name: 'Web Form Integration', fn: testWebFormIntegration },
        { name: 'Tfvars Generation', fn: testTfvarsGeneration },
        { name: 'Terraform Root Variables', fn: testTerraformRootVariables },
        { name: 'Main.tf Module Call', fn: testMainTfModuleCall },
        { name: 'VM Module Variables', fn: testVmModuleVariables },
        { name: 'VM Module Provisioner', fn: testVmModuleProvisioner },
        { name: 'Documentation', fn: testDocumentation }
    ];
    
    const results = [];
    
    for (const test of tests) {
        try {
            const result = test.fn();
            results.push({ name: test.name, passed: result });
        } catch (error) {
            console.log(`   ✗ Error in ${test.name}: ${error.message}`);
            results.push({ name: test.name, passed: false, error: error.message });
        }
    }
    
    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 TEST SUMMARY\n');
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    results.forEach(result => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} - ${result.name}`);
        if (result.error) {
            console.log(`    Error: ${result.error}`);
        }
    });
    
    console.log(`\n🎯 Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('🎉 All CHR integration tests PASSED!');
        console.log('\n✅ CHR registration functionality is ready for deployment');
        return true;
    } else {
        console.log('⚠️  Some tests failed - review the output above');
        return false;
    }
}

// Run the tests
runAllTests();
