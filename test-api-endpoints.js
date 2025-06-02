const http = require('http');

// Test the vSphere API endpoint
const testEndpoint = (path, description) => {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`${description}:`);
        console.log(`  Status: ${res.statusCode}`);
        console.log(`  Response: ${data.substring(0, 200)}...`);
        console.log('');
        resolve();
      });
    }).on('error', (err) => {
      console.log(`${description}: ERROR - ${err.message}`);
      console.log('');
      resolve();
    });
  });
};

(async () => {
  console.log('Testing API endpoints for connection status...\n');
  
  await testEndpoint('/api/vsphere/templates', 'vSphere Templates API');
  await testEndpoint('/api/vsphere/datacenters', 'vSphere Datacenters API');
  await testEndpoint('/api/vsphere/test-connection', 'vSphere Test Connection API');
  
  console.log('API endpoint testing complete.');
})();
