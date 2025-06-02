// API endpoint for vSphere infrastructure components
const express = require('express');
const router = express.Router();
const govcHelper = require('./govc-helper');

// Endpoint to get vSphere infrastructure components
router.post('/components', async (req, res) => {
    try {
        const { vsphereServer, vsphereUser, vspherePassword, component, parent, datacenterContext } = req.body;
        
        if (!vsphereServer || !vsphereUser || !vspherePassword) {
            return res.status(400).json({
                success: false,
                error: 'Missing vSphere connection details'
            });
        }
        
        if (!component) {
            return res.status(400).json({
                success: false,
                error: 'Missing component type to retrieve'
            });
        }
        
        // Create connection details object
        const connectionDetails = {
            server: vsphereServer,
            user: vsphereUser,
            password: vspherePassword
        };
        
        // Check connection before proceeding
        const connectionOk = await govcHelper.testConnection(connectionDetails);
        if (!connectionOk) {
            console.warn('vSphere connection test failed, will attempt operation anyway');
        }
        
        let responseData = [];
        
        // Get the appropriate data based on component type
        try {
            switch (component) {
                case 'datacenters':
                    responseData = await govcHelper.getDatacenters(connectionDetails);
                    break;
                    
                case 'clusters':
                    if (!parent) {
                        return res.status(400).json({
                            success: false,
                            error: 'Missing parent datacenter'
                        });
                    }
                    responseData = await govcHelper.getClusters(connectionDetails, parent);
                    break;
                    
                case 'datastoreClusters':
                    if (!parent) {
                        return res.status(400).json({
                            success: false,
                            error: 'Missing parent cluster'
                        });
                    }
                    responseData = await govcHelper.getDatastoreClusters(connectionDetails, parent, datacenterContext);
                    break;
                    
                case 'networks':
                    if (!parent) {
                        return res.status(400).json({
                            success: false,
                            error: 'Missing parent cluster'
                        });
                    }
                    responseData = await govcHelper.getNetworks(connectionDetails, parent, datacenterContext);
                    break;
                    
                default:
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid or unsupported component type'
                    });
            }        } catch (error) {
            console.error(`Error fetching ${component}: ${error.message}`);
            
            // Return error instead of demo data
            return res.status(500).json({
                success: false,
                error: `Failed to fetch ${component}: ${error.message}`
            });
        }
        
        return res.json({
            success: true,
            component: component,
            parent: parent,
            data: responseData
        });
        
    } catch (error) {
        console.error(`Error in /api/vsphere/components endpoint: ${error.message}`);
        
        return res.status(500).json({
            success: false,
            error: `Server error: ${error.message}`
        });
    }
});

module.exports = router;
