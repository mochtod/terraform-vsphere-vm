// Test WSL detection functionality
const fs = require('fs');

function isRunningInWSL() {
    try {
        // Check for WSL-specific files and environment
        return fs.existsSync('/proc/version') && 
               fs.readFileSync('/proc/version', 'utf8').includes('microsoft');
    } catch (error) {
        return false;
    }
}

console.log('🔍 WSL Detection Test');
console.log('===================');
console.log(`Running in WSL: ${isRunningInWSL()}`);
console.log(`Process platform: ${process.platform}`);
console.log(`Process architecture: ${process.arch}`);

try {
    if (fs.existsSync('/proc/version')) {
        const procVersion = fs.readFileSync('/proc/version', 'utf8').substring(0, 100);
        console.log(`/proc/version: ${procVersion}...`);
    } else {
        console.log('/proc/version: not found');
    }
} catch (error) {
    console.log(`Error reading /proc/version: ${error.message}`);
}

// Test the govc helper module
try {
    const govcHelper = require('./www/govc-helper.js');
    console.log('\n✅ govc-helper module loaded successfully');
} catch (error) {
    console.log(`\n❌ Error loading govc-helper: ${error.message}`);
}
