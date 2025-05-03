// vsphere-sdk-client.js
// SDK-based client specifically for retrieving datastore clusters
// Fix the import to properly access the constructor
const VsphereClient = require('node-vsphere-soap').Client;

// IMPORTANT: Don't directly require settings here to avoid circular dependencies
// Settings will be passed into the methods that need them

class VsphereSdkClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  // Connect to vSphere using SDK
  async connect(server, username, password) {
    try {
      console.log(`[vSphere SDK] Connecting to ${server} as ${username}`);
      
      // For older versions of node-vsphere-soap, the client is already connected when created
      // No separate connect() method is needed
      this.client = new VsphereClient(server, username, password);
      
      // Verify connection by checking for critical properties
      if (!this.client || !this.client.serviceContent) {
        throw new Error('Failed to initialize vSphere client or serviceContent not available');
      }
      
      this.isConnected = true;
      console.log(`[vSphere SDK] Successfully connected to ${server}`);
      return true;
    } catch (err) {
      console.error(`[vSphere SDK] Connection error: ${err.message}`);
      if (err.stack) {
        console.error(`[vSphere SDK] Stack trace: ${err.stack}`);
      }
      this.isConnected = false;
      return false;
    }
  }

  // Get datastore clusters (storage pods)
  async getDatastoreClusters(clusterId) {
    if (!this.isConnected || !this.client) {
      console.error(`[vSphere SDK] Not connected to vSphere`);
      throw new Error('Not connected to vSphere');
    }

    try {
      console.log(`[vSphere SDK] Retrieving datastore clusters for cluster ID: ${clusterId || 'all'}`);
      
      // First, get all storage pods (datastore clusters)
      const storagePods = await this.getAllStoragePods();
      console.log(`[vSphere SDK] Found ${storagePods.length} total storage pods`);
      
      if (storagePods.length === 0) {
        return [];
      }
      
      // If clusterId is provided, filter storage pods by cluster
      let filteredPods = storagePods;
      if (clusterId) {
        console.log(`[vSphere SDK] Filtering storage pods for cluster: ${clusterId}`);
        // We'll need to get the compute resources associated with each storage pod
        // Since this could be complex, we'll log details to help debug
        
        // This filtering is a simplification - the actual relation between 
        // clusters and storage pods might be more complex
        filteredPods = await this.filterStoragePodsByCluster(storagePods, clusterId);
      }
      
      // Format the results to match the expected structure
      const formattedPods = this.formatStoragePods(filteredPods);
      console.log(`[vSphere SDK] Returning ${formattedPods.length} datastore clusters`);
      
      // Debug log the first pod if available
      if (formattedPods.length > 0) {
        console.log(`[vSphere SDK] Sample datastore cluster:`, JSON.stringify(formattedPods[0]));
      }
      
      return formattedPods;
    } catch (err) {
      console.error(`[vSphere SDK] Error retrieving datastore clusters: ${err.message}`);
      if (err.stack) {
        console.error(`[vSphere SDK] Stack trace: ${err.stack}`);
      }
      throw err;
    }
  }

  // Helper method to get all storage pods using older SDK methods
  async getAllStoragePods() {
    console.log(`[vSphere SDK] Fetching storage pods via older SDK methods`);
    
    try {
      // Verify client is initialized
      if (!this.client || !this.client.serviceContent) {
        throw new Error('Client not properly initialized');
      }
      
      // First try: Use findAllByType if available (common in older versions)
      if (typeof this.client.findAllByType === 'function') {
        try {
          console.log(`[vSphere SDK] Attempting to find storage pods using findAllByType`);
          const pods = await this.client.findAllByType('StoragePod');
          
          if (pods && pods.length > 0) {
            console.log(`[vSphere SDK] Found ${pods.length} storage pods via findAllByType`);
            
            // Log found pods
            pods.forEach(pod => {
              if (pod && pod.name) {
                console.log(`[vSphere SDK] Found storage pod: ${pod.name}`);
                
                // Look for example cluster
                if (pod.name === 'np-cl60-dsc') {
                  console.log(`[vSphere SDK] FOUND EXAMPLE CLUSTER: ${pod.name}`);
                }
              }
            });
            
            return pods;
          } else {
            console.log(`[vSphere SDK] No storage pods found via findAllByType`);
          }
        } catch (err) {
          console.error(`[vSphere SDK] findAllByType error: ${err.message}`);
        }
      }
      
      // Second try: Use vimPort directly (for very old versions)
      try {
        console.log(`[vSphere SDK] Attempting direct vimPort method for storage pods`);
        
        const propertyCollector = this.client.serviceContent.propertyCollector;
        
        // Create traversal specs - this is the lower-level API approach
        const traversalSpec = {
          name: 'traverseEntities',
          type: 'TraversalSpec',
          path: 'childEntity',
          skip: false
        };
        
        // For older versions, we may need to use the vimPort directly
        const result = await this.client.vimPort.RetrieveProperties({
          _this: propertyCollector,
          specSet: [{
            propSet: [{
              type: 'StoragePod',
              pathSet: ['name', 'summary']
            }],
            objectSet: [{
              obj: this.client.serviceContent.rootFolder,
              skip: false,
              selectSet: [traversalSpec]
            }]
          }]
        });
        
        if (result && result.returnval && result.returnval.length > 0) {
          console.log(`[vSphere SDK] Found ${result.returnval.length} storage pods via vimPort`);
          
          // Log the pods
          result.returnval.forEach(pod => {
            const name = pod.propSet?.find(p => p.name === 'name')?.val || 'Unknown';
            console.log(`[vSphere SDK] Found storage pod: ${name}`);
            
            // Look for example cluster
            if (name === 'np-cl60-dsc') {
              console.log(`[vSphere SDK] FOUND EXAMPLE CLUSTER: ${name}`);
            }
          });
          
          return result.returnval;
        } else {
          console.log(`[vSphere SDK] No storage pods found via vimPort`);
        }
      } catch (err) {
        console.error(`[vSphere SDK] vimPort method error: ${err.message}`);
      }
      
      // If we've tried both methods and found nothing, throw an error
      console.error(`[vSphere SDK] No storage pods found with any available method`);
      throw new Error('No storage pods found in vSphere environment or methods not supported in this SDK version');
    } catch (err) {
      console.error(`[vSphere SDK] Error retrieving storage pods: ${err.message}`);
      if (err.stack) {
        console.error(`[vSphere SDK] Stack trace: ${err.stack}`);
      }
      throw err;
    }
  }

  // Helper method to filter storage pods by cluster
  async filterStoragePodsByCluster(storagePods, clusterId) {
    // This is a simplified implementation - the actual filtering might be more complex
    // based on the exact structure of your vSphere environment
    try {
      console.log(`[vSphere SDK] Filtering ${storagePods.length} storage pods for cluster: ${clusterId}`);
      
      // For now, we'll return all storage pods as we develop the filtering logic
      // This can be refined once we understand the exact relationship between clusters and storagePods
      return storagePods;
      
      /* 
      Placeholder for actual filtering logic - would look something like:
      
      return storagePods.filter(pod => {
        // Check if the pod is related to the cluster
        // This could involve checking parent/child relationships
        // or examining datastores in the pod and their hosts/clusters
        return someRelationshipToCluster(pod, clusterId);
      });
      */
    } catch (err) {
      console.error(`[vSphere SDK] Error filtering storage pods: ${err.message}`);
      return storagePods; // Return all pods if filtering fails
    }
  }

  // Helper method to format storage pods to match expected structure
  formatStoragePods(storagePods) {
    try {
      console.log(`[vSphere SDK] Formatting ${storagePods.length} storage pods`);
      
      const formattedPods = storagePods.map(pod => {
        // Extract the necessary information from the pod
        // The exact properties might vary based on the SDK's return format
        
        let id = '';
        let name = '';
        
        // Enhanced property extraction for different response formats
        
        // Handle findAllByType response format
        if (pod.name && pod.mo && pod.mo._ref) {
          name = pod.name;
          id = pod.mo._ref;
          console.log(`[vSphere SDK] Found pod from findAllByType: ${name} (${id})`);
        }
        // Handle vimPort.RetrieveProperties response format
        else if (pod.propSet && pod.obj) {
          const nameProp = pod.propSet.find(p => p.name === 'name');
          if (nameProp) {
            name = nameProp.val;
          }
          
          if (pod.obj.value) {
            id = pod.obj.value;
          } else if (pod.obj._moRef && pod.obj._moRef.value) {
            id = pod.obj._moRef.value;
          }
          
          console.log(`[vSphere SDK] Found pod from vimPort: ${name} (${id})`);
        }
        // Handle older SDK format with direct properties
        else if (pod.obj && pod.obj._moRef) {
          id = pod.obj._moRef.value;
          
          if (pod.name) {
            name = pod.name;
          }
          
          console.log(`[vSphere SDK] Found pod with direct properties: ${name} (${id})`);
        }
        // Other possible formats
        else {
          if (pod.moRef) {
            id = pod.moRef.value;
          } else if (pod.value) {
            id = pod.value;
          } else if (typeof pod === 'string') {
            // Sometimes older APIs just return the ID as a string
            id = pod;
            name = `Storage Pod ${pod.split(':').pop()}`; // Use last part of ID as name
          }
          
          // Get name if not found yet
          if (!name && pod.name) {
            name = pod.name;
          }
          
          console.log(`[vSphere SDK] Found pod with alternative format: ${name} (${id})`);
        }
        
        // If we still couldn't extract a name but have an ID, use a generic name
        if (!name && id) {
          name = `Storage Pod ${id.split(':').pop() || id.substring(0, 8)}`;
          console.log(`[vSphere SDK] Using generated name for pod: ${name} (${id})`);
        }
        
        // If we have a complete pod, return it
        if (id && name) {
          return {
            datastore_cluster: id,
            name: name,
            type: 'datastore_cluster'
          };
        }
        
        console.warn(`[vSphere SDK] Could not extract ID and name from pod:`, JSON.stringify(pod));
        return null;
      }).filter(Boolean); // Filter out null entries
      
      console.log(`[vSphere SDK] Successfully formatted ${formattedPods.length} storage pods`);
      
      return formattedPods;
    } catch (err) {
      console.error(`[vSphere SDK] Error formatting storage pods: ${err.message}`);
      if (err.stack) {
        console.error(`[vSphere SDK] Stack trace: ${err.stack}`);
      }
      
      // Just return an empty array for formatting errors, don't throw
      return [];
    }
  }

  // Disconnect from vSphere
  disconnect() {
    if (this.client) {
      try {
        this.client.disconnect();
        console.log(`[vSphere SDK] Disconnected from vSphere`);
      } catch (err) {
        console.error(`[vSphere SDK] Error disconnecting: ${err.message}`);
      }
      this.isConnected = false;
      this.client = null;
    }
  }
}

// Create and export a singleton instance
module.exports = new VsphereSdkClient();
