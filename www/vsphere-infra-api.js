// API endpoint for vSphere infrastructure components
const express = require('express');
const router = express.Router();

// Endpoint to get vSphere infrastructure components
router.post('/components', async (req, res) => {
    try {
        const { vsphereServer, vsphereUser, vspherePassword, component, parent } = req.body;
        
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
        
        // Sample infrastructure components
        const infrastructureData = {
            datacenters: [
                { id: 'datacenter-1', name: 'EBDC NONPROD' },
                { id: 'datacenter-2', name: 'EBDC PROD' },
                { id: 'datacenter-3', name: 'USDC NONPROD' },
                { id: 'datacenter-4', name: 'USDC PROD' }
            ],
            clusters: {
                'EBDC NONPROD': [
                    { id: 'cluster-1', name: 'np-cl60-lin' },
                    { id: 'cluster-2', name: 'np-cl61-lin' },
                    { id: 'cluster-3', name: 'np-cl62-win' }
                ],
                'EBDC PROD': [
                    { id: 'cluster-4', name: 'pr-cl60-lin' },
                    { id: 'cluster-5', name: 'pr-cl61-lin' },
                    { id: 'cluster-6', name: 'pr-cl62-win' }
                ],
                'USDC NONPROD': [
                    { id: 'cluster-7', name: 'np-cl70-lin' },
                    { id: 'cluster-8', name: 'np-cl71-win' }
                ],
                'USDC PROD': [
                    { id: 'cluster-9', name: 'pr-cl70-lin' },
                    { id: 'cluster-10', name: 'pr-cl71-win' }
                ]
            },
            datastoreClusters: {
                'np-cl60-lin': [
                    { id: 'datastore-cluster-1', name: 'np-cl60-dsc' },
                    { id: 'datastore-cluster-2', name: 'np-cl60-dsc-ssd' }
                ],
                'np-cl61-lin': [
                    { id: 'datastore-cluster-3', name: 'np-cl61-dsc' },
                    { id: 'datastore-cluster-4', name: 'np-cl61-dsc-ssd' }
                ],
                'pr-cl60-lin': [
                    { id: 'datastore-cluster-5', name: 'pr-cl60-dsc' },
                    { id: 'datastore-cluster-6', name: 'pr-cl60-dsc-ssd' }
                ],
                'np-cl70-lin': [
                    { id: 'datastore-cluster-7', name: 'np-cl70-dsc' }
                ]
            },
            networks: {
                'np-cl60-lin': [
                    { id: 'network-1', name: 'np-lin-vds-989-linux' },
                    { id: 'network-2', name: 'np-lin-vds-990-linux' }
                ],
                'np-cl61-lin': [
                    { id: 'network-3', name: 'np-lin-vds-991-linux' },
                    { id: 'network-4', name: 'np-lin-vds-992-linux' }
                ],
                'pr-cl60-lin': [
                    { id: 'network-5', name: 'pr-lin-vds-989-linux' },
                    { id: 'network-6', name: 'pr-lin-vds-990-linux' }
                ],
                'np-cl70-lin': [
                    { id: 'network-7', name: 'np-lin-vds-993-linux' }
                ]
            }
        };
        
        let responseData;
        
                // Return the appropriate component data based on request
        switch (component) {
            case 'datacenters':
                // Ensure we're returning the actual datacenter names in the data
                responseData = infrastructureData.datacenters;
                break;
            case 'clusters':
                if (!parent) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing parent datacenter'
                    });
                }
                responseData = infrastructureData.clusters[parent] || [];
                break;
            case 'datastoreClusters':
                if (!parent) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing parent cluster'
                    });
                }
                responseData = infrastructureData.datastoreClusters[parent] || [];
                break;
            case 'networks':
                if (!parent) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing parent cluster'
                    });
                }
                responseData = infrastructureData.networks[parent] || [];
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid component type'
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
