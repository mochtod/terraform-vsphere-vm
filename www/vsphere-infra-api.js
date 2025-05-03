// API endpoint for vSphere infrastructure components
const express = require('express');
const router = express.Router();
const vsphereRest = require('./vsphere-rest-client');

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
        
        // Authenticate to vSphere REST API
        let cookie;
        try {
            cookie = await vsphereRest.loginVSphere(vsphereServer, vsphereUser, vspherePassword);
        } catch (err) {
            return res.status(500).json({
                success: false,
                error: 'vSphere login failed: ' + err.message
            });
        }
        
        let responseData;
        
                // Return the appropriate component data based on request
        switch (component) {
            case 'datacenters':
                try {
                    const dcs = await vsphereRest.getDatacenters(vsphereServer, cookie);
                    responseData = dcs.map(dc => ({ id: dc.datacenter, name: dc.name }));
                } catch (err) {
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to fetch datacenters: ' + err.message
                    });
                }
                break;
            case 'clusters':
                if (!parent) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing parent datacenter'
                    });
                }
                try {
                    const clusters = await vsphereRest.getClusters(vsphereServer, cookie, parent);
                    responseData = clusters.map(cl => ({ id: cl.cluster, name: cl.name }));
                } catch (err) {
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to fetch clusters: ' + err.message
                    });
                }
                break;
            case 'datastoreClusters':
                if (!parent) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing parent cluster'
                    });
                }
                try {
                    console.log(`[vSphere API] Requesting datastore clusters for cluster: ${parent}`);
                    const datastoreClusters = await vsphereRest.getDatastoreClusters(vsphereServer, cookie, parent);
                    
                    if (!datastoreClusters || datastoreClusters.length === 0) {
                        console.log(`[vSphere API] No datastore clusters found for cluster: ${parent}`);
                        // Return an empty array but with success=true to indicate this is a valid state
                        // The UI can then handle displaying a message about no datastore clusters
                        return res.json({
                            success: true,
                            component: component,
                            parent: parent,
                            data: [],
                            message: 'No datastore clusters found in this vSphere environment'
                        });
                    }
                    
                    // Log each datastore cluster found
                    console.log(`[vSphere API] Found ${datastoreClusters.length} datastore clusters:`);
                    datastoreClusters.forEach(ds => {
                        console.log(`[vSphere API] - ${ds.name} (ID: ${ds.datastore_cluster || ds.storage_pod || ds.id || 'unknown'})`)
                        
                        // Specifically log if we found the example cluster
                        if (ds.name === 'np-cl60-dsc') {
                            console.log(`[vSphere API] FOUND EXAMPLE CLUSTER: np-cl60-dsc in results`);
                        }
                    });
                    
                    // Map to a consistent format, handling different possible response formats
                    responseData = datastoreClusters.map(ds => {
                        // Check different possible property names for the ID
                        const id = ds.datastore_cluster || ds.storage_pod || ds.id || ds.identifier || ds.value;
                        
                        if (!id) {
                            console.warn(`[vSphere API] Datastore cluster has no ID: ${JSON.stringify(ds)}`);
                        }
                        
                        if (!ds.name) {
                            console.warn(`[vSphere API] Datastore cluster has no name: ${JSON.stringify(ds)}`);
                        }
                        
                        return {
                            id: id || `unknown-${Math.random().toString(36).substr(2, 9)}`,
                            name: ds.name || `Unknown Cluster ${id ? id.substring(0, 8) : ''}`,
                            // Keep any additional useful properties
                            type: 'datastore_cluster',
                            original: ds // Store the original data for debugging
                        };
                    });
                    
                    // Log the mapped data for debugging
                    console.log(`[vSphere API] Mapped ${responseData.length} datastore clusters for cluster: ${parent}`);
                    console.log('[vSphere API] First datastore cluster:', responseData.length > 0 ? JSON.stringify(responseData[0]) : 'None');
                } catch (err) {
                    console.error(`[vSphere API] Error fetching datastore clusters: ${err.message}`);
                    console.error(`[vSphere API] Stack trace:`, err.stack);
                    
                    // Return a clear error to the client with appropriate status code
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to fetch datastore clusters: ' + err.message,
                        component: component,
                        parent: parent
                    });
                }
                break;
            case 'networks':
                if (!parent) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing parent cluster'
                    });
                }
                try {
                    const networks = await vsphereRest.getNetworks(vsphereServer, cookie, parent);
                    responseData = networks.map(net => ({ id: net.network, name: net.name }));
                } catch (err) {
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to fetch networks: ' + err.message
                    });
                }
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid or unsupported component type'
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
