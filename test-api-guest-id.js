// Test the web API templates endpoint with guest ID functionality
const axios = require('axios');

async function testTemplatesEndpoint() {
    console.log('🔍 Testing Templates API Endpoint with Guest ID...');
    
    try {
        const response = await axios.get('http://localhost:3000/api/templates');
        
        console.log(`✅ Response Status: ${response.status}`);
        console.log(`✅ Templates Found: ${response.data.length}`);
        
        if (response.data.length > 0) {
            console.log('\n📋 Template Details:');
            response.data.forEach((template, index) => {
                console.log(`${index + 1}. ${template.name}`);
                console.log(`   Path: ${template.path}`);
                console.log(`   Guest ID: ${template.guestId || 'N/A'}`);
                console.log(`   Guest OS: ${template.guestFullName || 'N/A'}`);
                console.log('');
            });
            
            // Check if guest IDs are populated
            const templatesWithGuestId = response.data.filter(t => t.guestId);
            console.log(`🎯 Templates with Guest ID: ${templatesWithGuestId.length}/${response.data.length}`);
            
            if (templatesWithGuestId.length === response.data.length) {
                console.log('🎉 SUCCESS: All templates have guest ID information!');
                return true;
            } else {
                console.log('⚠️  WARNING: Some templates are missing guest ID information');
                return false;
            }
        } else {
            console.log('❌ No templates found');
            return false;
        }
        
    } catch (error) {
        console.error('❌ API Request Failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
        return false;
    }
}

// Test the API
testTemplatesEndpoint().then(success => {
    process.exit(success ? 0 : 1);
});
