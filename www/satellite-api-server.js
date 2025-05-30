// Server-side Satellite API for CHR integration
const express = require('express');
const router = express.Router();
const settings = require('./settings');

// Get available host groups from CHR Satellite
router.get('/host-groups', async (req, res) => {
    try {
        const globalSettings = settings.getSettings();
        
        if (!globalSettings.satellite || !globalSettings.satellite.url) {
            return res.status(400).json({
                success: false,
                error: 'CHR Satellite URL not configured. Please configure satellite settings.'
            });
        }

        const satelliteUrl = globalSettings.satellite.url;
        const username = globalSettings.satellite.username;
        const password = globalSettings.satellite.password;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'CHR Satellite credentials not configured. Please provide username and password in settings.'
            });
        }        // Make actual API call to CHR Satellite with pagination support
        const https = require('https');
        let allHostGroups = [];
        let page = 1;
        let totalPages = 1;
        
        // Fetch all pages of host groups
        do {
            const url = new URL(`/api/v2/hostgroups?per_page=100&page=${page}`, satelliteUrl);
            
            const requestOptions = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname + url.search,
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
                },
                rejectUnauthorized: false // For self-signed certificates
            };

            const satelliteData = await new Promise((resolve, reject) => {
                const req = https.request(requestOptions, (response) => {
                    let data = '';
                    
                    response.on('data', (chunk) => {
                        data += chunk;
                    });

                    response.on('end', () => {
                        try {
                            if (response.statusCode >= 200 && response.statusCode < 300) {
                                const parsedData = JSON.parse(data);
                                resolve(parsedData);
                            } else {
                                reject(new Error(`CHR Satellite API returned status ${response.statusCode}: ${data}`));
                            }
                        } catch (error) {
                            reject(new Error(`Failed to parse CHR Satellite response: ${error.message}`));
                        }
                    });
                });
                
                req.on('error', (error) => {
                    reject(new Error(`Failed to connect to CHR Satellite: ${error.message}`));
                });
                
                req.setTimeout(10000, () => {
                    req.destroy();
                    reject(new Error('CHR Satellite API request timeout'));
                });
                
                req.end();
            });

            // Add results from this page
            if (satelliteData.results) {
                allHostGroups = allHostGroups.concat(satelliteData.results);
            }
            
            // Update pagination info
            totalPages = Math.ceil(satelliteData.total / satelliteData.per_page) || 1;
            page++;
            
            console.log(`Fetched page ${page - 1}/${totalPages}, got ${satelliteData.results ? satelliteData.results.length : 0} host groups`);
            
        } while (page <= totalPages);

        console.log(`Total host groups fetched: ${allHostGroups.length}`);        // Transform satellite response to our format
        // Note: Satellite API returns:
        // - name: leaf name only (e.g., "Development") 
        // - title: full hierarchical path (e.g., "App_Hosting_Global/Development")
        const hostGroups = allHostGroups.map(hg => {
            const fullPath = hg.title || hg.name; // Use title for full path, fallback to name
            return {
                id: hg.id,
                name: fullPath, // Use full path as the name for selection
                description: fullPath,
                shortName: hg.name // Keep the short name for reference
            };
        });

        console.log('Sample host group data from Satellite:', allHostGroups.slice(0, 3));

        res.json({
            success: true,
            hostGroups: hostGroups
        });

    } catch (error) {
        console.error('Error fetching host groups from CHR Satellite:', error);
        res.status(500).json({
            success: false,
            error: `CHR Satellite API Error: ${error.message}`
        });
    }
});

// Generate CHR registration command
router.post('/registration-command', (req, res) => {
    try {
        const { hostGroup, hostname } = req.body;
        
        if (!hostGroup || !hostname) {
            return res.status(400).json({
                success: false,
                error: 'Host group and hostname are required'
            });
        }

        const globalSettings = settings.getSettings();
        
        if (!globalSettings.satellite || !globalSettings.satellite.url) {
            return res.status(400).json({
                success: false,
                error: 'CHR Satellite URL not configured'
            });
        }

        const satelliteUrl = globalSettings.satellite.url;
        const username = globalSettings.satellite.username;
        const password = globalSettings.satellite.password;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'CHR Satellite credentials not configured'
            });
        }
        
        // Generate the curl command for CHR Satellite registration using Satellite 6 API
        const registrationCommand = `curl -X POST "${satelliteUrl}/api/v2/hosts" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -u "${username}:${password}" \\
  -k \\
  -d '{
    "host": {
      "name": "${hostname}",
      "hostgroup_id": ${hostGroup.id || hostGroup},
      "build": false,
      "enabled": true,
      "managed": true,
      "provision_method": "build"
    }
  }'`;

        res.json({
            success: true,
            command: registrationCommand,
            hostname: hostname,
            hostGroup: hostGroup
        });

    } catch (error) {
        console.error('Error generating registration command:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// For other endpoints that aren't yet implemented, return proper errors
router.post('/vm-health', async (req, res) => {
    res.status(501).json({
        success: false,
        error: 'VM health check not yet implemented for CHR Satellite integration'
    });
});

router.get('/ansible-jobs', (req, res) => {
    res.status(501).json({
        success: false,
        error: 'Ansible job templates fetching not yet implemented for CHR Satellite integration'
    });
});

router.post('/ansible-job/:jobId', async (req, res) => {
    res.status(501).json({
        success: false,
        error: 'Ansible job execution not yet implemented for CHR Satellite integration'
    });
});

router.post('/register-vm', async (req, res) => {
    res.status(501).json({
        success: false,
        error: 'VM registration execution not yet implemented. Use the provided curl command manually on the VM.'
    });
});

module.exports = router;
