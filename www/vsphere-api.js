// API endpoint for vSphere VM templates and VM operations
const express = require('express');
const router = express.Router();
const govcHelper = require('./govc-helper');

// Endpoint to get VM templates from vSphere
router.post('/templates', async (req, res) => {
    try {
        const { vsphereServer, vsphereUser, vspherePassword } = req.body;
        
        if (!vsphereServer || !vsphereUser || !vspherePassword) {
            return res.status(400).json({
                success: false,
                error: 'Missing vSphere connection details'
            });
        }
        
        // Create connection details object
        const connectionDetails = {
            server: vsphereServer,
            user: vsphereUser,
            password: vspherePassword
        };
        
        let templates = [];
          try {
            // Attempt to get templates from vSphere using govc
            templates = await govcHelper.getVmTemplates(connectionDetails);
        } catch (error) {
            console.error(`Error fetching VM templates: ${error.message}`);
            
            // Return error instead of demo data
            return res.status(500).json({
                success: false,
                error: `Failed to fetch VM templates: ${error.message}`
            });
        }
        
        return res.json({
            success: true,
            templates: templates
        });
        
    } catch (error) {
        console.error(`Error in /api/vsphere/templates endpoint: ${error.message}`);
        
        return res.status(500).json({
            success: false,
            error: `Server error: ${error.message}`
        });
    }
});

// Endpoint to get VM power status
router.post('/vm/status', async (req, res) => {
    try {
        const { vsphereServer, vsphereUser, vspherePassword, vmName } = req.body;
        
        if (!vsphereServer || !vsphereUser || !vspherePassword) {
            return res.status(400).json({
                success: false,
                error: 'Missing vSphere connection details'
            });
        }
        
        if (!vmName) {
            return res.status(400).json({
                success: false,
                error: 'Missing VM name'
            });
        }
        
        // Create connection details object
        const connectionDetails = {
            server: vsphereServer,
            user: vsphereUser,
            password: vspherePassword
        };
        
        let vmStatus = 'unknown';
        
        try {
            // Execute govc command to get VM power state
            const env = govcHelper.createGovcEnv(connectionDetails);
            const output = await govcHelper.executeGovc(`vm.info -json=false "${vmName}"`, env);
            
            // Parse the output to determine power state
            if (output.includes('poweredOn')) {
                vmStatus = 'poweredOn';
            } else if (output.includes('poweredOff')) {
                vmStatus = 'poweredOff';
            } else if (output.includes('suspended')) {
                vmStatus = 'suspended';
            }
        } catch (error) {
            console.error(`Error getting VM status: ${error.message}`);
            // Keep the default 'unknown' status
        }
        
        return res.json({
            success: true,
            vmName: vmName,
            status: vmStatus
        });
        
    } catch (error) {
        console.error(`Error in /api/vsphere/vm/status endpoint: ${error.message}`);
        
        return res.status(500).json({
            success: false,
            error: `Server error: ${error.message}`
        });
    }
});

module.exports = router;
