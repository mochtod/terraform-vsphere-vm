const fs = require('fs');
const path = require('path');

// Global cache for vSphere session and infrastructure
let vsphereSession = null;
let cachedInfrastructure = {
    datacenters: [],
    clusters: {},
    datastoreClusters: {},
    networks: {}
};

// Path to cache infrastructure data persistently
const INFRA_CACHE_PATH = path.join(__dirname, 'temp', 'vsphere_infra_cache.json');

// Function to initialize vSphere connection and cache infrastructure
async function initializeVSphereConnection(settings, vsphereRestClient) {
    try {
        console.log('[vSphere] Initializing global connection and caching infrastructure...');

        // Login to vSphere
        vsphereSession = await vsphereRestClient.loginVSphere(
            settings.vsphere.server,
            settings.vsphere.user,
            settings.vsphere.password
        );

        // Fetch datacenters
        const datacenters = await vsphereRestClient.getDatacenters(settings.vsphere.server, vsphereSession);
        cachedInfrastructure.datacenters = datacenters;

        // Fetch clusters for each datacenter
        for (const datacenter of datacenters) {
            const clusters = await vsphereRestClient.getClusters(settings.vsphere.server, vsphereSession, datacenter.datacenter);
            cachedInfrastructure.clusters[datacenter.datacenter] = clusters;
            
            // Fetch datastore clusters and networks for each cluster
            for (const cluster of clusters) {
                try {
                    // Initialize storage for this cluster if not already done
                    if (!cachedInfrastructure.datastoreClusters) {
                        cachedInfrastructure.datastoreClusters = {};
                    }
                    if (!cachedInfrastructure.networks) {
                        cachedInfrastructure.networks = {};
                    }
                    
                    // Fetch and cache datastore clusters for this cluster
                    const clusterId = cluster.cluster;
                    if (clusterId) {
                        console.log(`[vSphere] Fetching datastore clusters for cluster: ${cluster.name} (${clusterId})`);
                        
                        try {
                            const datastoreClusters = await vsphereRestClient.getDatastoreClusters(
                                settings.vsphere.server, vsphereSession, clusterId
                            );
                            
                            // Log detailed information about the datastore clusters found
                            console.log(`[vSphere] Found ${datastoreClusters.length} datastore clusters for cluster ${cluster.name}`);
                            if (datastoreClusters.length > 0) {
                                console.log('[vSphere] First datastore cluster sample:', JSON.stringify(datastoreClusters[0]));
                            }
                            
                            // Transform the data to ensure it has the right format
                            const transformedClusters = datastoreClusters.map(ds => {
                                // Detailed logging of each datastore cluster item
                                console.log(`[vSphere] Processing datastore cluster item: ${JSON.stringify(ds)}`);
                                
                                // Extract properties with more robust handling
                                const id = ds.datastore_cluster || ds.storage_pod || ds.id || 
                                          (ds.original && ds.original.id) || 
                                          (typeof ds === 'string' ? ds : null);
                                          
                                const name = ds.name || 
                                            (ds.original && ds.original.name) || 
                                            (typeof ds === 'object' && 'label' in ds ? ds.label : null);
                                
                                // Skip items that don't have required properties
                                if (!id || !name) {
                                    console.log(`[vSphere] Skipping datastore cluster item due to missing required properties`);
                                    return null;
                                }
                                
                                return {
                                    datastore_cluster: id,
                                    name: name,
                                    type: 'datastore_cluster',
                                    // Include original data for debugging
                                    original: ds.original || ds
                                };
                            }).filter(Boolean); // Remove any null entries
                            
                            cachedInfrastructure.datastoreClusters[clusterId] = transformedClusters;
                            console.log(`[vSphere] Cached ${transformedClusters.length} datastore clusters for cluster ${cluster.name}`);
                        } catch (dsError) {
                            console.error(`[vSphere] Error fetching datastore clusters for cluster ${cluster.name}:`, dsError.message);
                            cachedInfrastructure.datastoreClusters[clusterId] = [];
                        }
                        
                        // Fetch and cache networks for this cluster
                        try {
                            console.log(`[vSphere] Fetching networks for cluster: ${cluster.name}`);
                            const networks = await vsphereRestClient.getNetworks(
                                settings.vsphere.server, vsphereSession, clusterId
                            );
                            
                            // Sort networks alphabetically
                            networks.sort((a, b) => a.name.localeCompare(b.name));
                            
                            cachedInfrastructure.networks[clusterId] = networks;
                            console.log(`[vSphere] Cached ${networks.length} networks for cluster ${cluster.name}`);
                        } catch (netError) {
                            console.error(`[vSphere] Error fetching networks for cluster ${cluster.name}:`, netError.message);
                            cachedInfrastructure.networks[clusterId] = [];
                        }
                    }
                } catch (err) {
                    console.error(`[vSphere] Error fetching resources for cluster ${cluster.name}:`, err.message);
                    // Ensure the cluster ID exists before setting empty arrays
                    if (cluster.cluster) {
                        cachedInfrastructure.datastoreClusters[cluster.cluster] = [];
                        cachedInfrastructure.networks[cluster.cluster] = [];
                    }
                }
            }
        }

        // Save infrastructure cache to file
        fs.writeFileSync(INFRA_CACHE_PATH, JSON.stringify(cachedInfrastructure, null, 2));
        console.log('[vSphere] Infrastructure cached successfully.');
    } catch (err) {
        console.error('[vSphere] Error initializing connection or caching infrastructure:', err.message);
        vsphereSession = null;
        cachedInfrastructure = { datacenters: [], clusters: {} };
    }
}

// Function to load cached infrastructure from file
function loadCachedInfrastructure() {
    try {
        if (fs.existsSync(INFRA_CACHE_PATH)) {
            const data = JSON.parse(fs.readFileSync(INFRA_CACHE_PATH, 'utf8'));
            cachedInfrastructure = data;
            console.log('[vSphere] Loaded cached infrastructure from file.');
        }
    } catch (err) {
        console.error('[vSphere] Error loading cached infrastructure:', err.message);
    }
}

// Export functions and cache
module.exports = {
    initializeVSphereConnection,
    loadCachedInfrastructure,
    getCachedInfrastructure: () => cachedInfrastructure,
    getVSphereSession: () => vsphereSession
};
