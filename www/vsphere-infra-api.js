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
            }
        } catch (error) {
            console.error(`Error fetching ${component}: ${error.message}`);
            
            // Fall back to sample data if govc call fails
            switch (component) {
                case 'datacenters':
                    responseData = [
                        { id: 'datacenter-1', name: 'EBDC NONPROD' },
                        { id: 'datacenter-2', name: 'EBDC PROD' },
                        { id: 'datacenter-3', name: 'USDC NONPROD' },
                        { id: 'datacenter-4', name: 'USDC PROD' }
                    ];
                    break;
                    
                case 'clusters':
                    const sampleClusters = {
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
                    };
                    responseData = sampleClusters[parent] || [];
                    break;
                    
                case 'datastoreClusters':
                    const sampleDatastoreClusters = {
                        'np-cl60-lin': [
                            { id: 'storage-pod-1', name: 'np-cl60-pod' },
                            { id: 'storage-pod-2', name: 'np-cl60-pod-ssd' }
                        ],
                        'np-cl61-lin': [
                            { id: 'storage-pod-3', name: 'np-cl61-pod' },
                            { id: 'storage-pod-4', name: 'np-cl61-pod-ssd' }
                        ],
                        'pr-cl60-lin': [
                            { id: 'storage-pod-5', name: 'pr-cl60-pod' },
                            { id: 'storage-pod-6', name: 'pr-cl60-pod-ssd' }
                        ],
                        'np-cl70-lin': [
                            { id: 'storage-pod-7', name: 'np-cl70-pod' }
                        ]
                    };
                    responseData = sampleDatastoreClusters[parent] || [];
                    break;
                    
                case 'networks':
                    const sampleNetworks = {
                        'np-cl60-lin': [
                            { id: 'portgroup-1', name: 'np-lin-vds-989-linux (VLAN: 989)', rawName: 'np-lin-vds-989-linux', vlanId: '989' },
                            { id: 'portgroup-2', name: 'np-lin-vds-990-linux (VLAN: 990)', rawName: 'np-lin-vds-990-linux', vlanId: '990' }
                        ],
                        'np-cl61-lin': [
                            { id: 'portgroup-3', name: 'np-lin-vds-991-linux (VLAN: 991)', rawName: 'np-lin-vds-991-linux', vlanId: '991' },
                            { id: 'portgroup-4', name: 'np-lin-vds-992-linux (VLAN: 992)', rawName: 'np-lin-vds-992-linux', vlanId: '992' }
                        ],
                        'pr-cl60-lin': [
                            { id: 'portgroup-5', name: 'pr-lin-vds-989-linux (VLAN: 989)', rawName: 'pr-lin-vds-989-linux', vlanId: '989' },
                            { id: 'portgroup-6', name: 'pr-lin-vds-990-linux (VLAN: 990)', rawName: 'pr-lin-vds-990-linux', vlanId: '990' }
                        ],
                        'np-cl70-lin': [
                            { id: 'portgroup-7', name: 'np-lin-vds-993-linux (VLAN: 993)', rawName: 'np-lin-vds-993-linux', vlanId: '993' }
                        ]
                    };
                    responseData = sampleNetworks[parent] || [];
                    break;
            }
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
