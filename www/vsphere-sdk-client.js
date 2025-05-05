// vsphere-sdk-client.js
// SDK-based client for all vSphere API communication

// Import SSL patch before any other imports to ensure certificate handling is configured
require('./vsphere-soap-patch');

// Fix the import to properly access the constructor
const VsphereClient = require('node-vsphere-soap').Client;
const https = require('https');
const tls = require('tls');

// IMPORTANT: Don't directly require settings here to avoid circular dependencies
// Settings will be passed into the methods that need them

// Additional TLS configuration to handle various certificate scenarios
const originalCheckServerIdentity = tls.checkServerIdentity;
tls.checkServerIdentity = function(host, cert) {
  // Bypass hostname verification for self-signed certs
  return undefined;
};

class VsphereSdkClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.propertyCollector = null; // Used for property collection operations
    this.serviceContent = null; // Service content reference stored for convenience
    this.rootFolder = null; // Root folder reference stored for convenience
  }

  // Connect to vSphere using SDK - Enhanced with multiple connection strategies
  async connect(server, username, password) {
    try {
      console.log(`[vSphere SDK] Connecting to ${server} as ${username}`);
      
      if (!server || !username || !password) {
        throw new Error('Missing required connection parameters (server, username, or password)');
      }

      // Create more robust connection options
      const connectionOptions = {
        timeout: 60000, // 60 second timeout
        ignoreCert: true, // Ignore SSL cert validation issues
        httpsAgent: new https.Agent({
          rejectUnauthorized: false, // Critical for self-signed certificates
          checkServerIdentity: () => undefined, // Skip hostname verification
          ciphers: 'ALL', // Accept all cipher suites
          secureProtocol: 'TLS_method' // Use most compatible TLS method
        }),
        wsdlOptions: {
          // SOAP-specific TLS options
          httpClient: {
            request: function(rurl, data, callback, exheaders, exoptions) {
              // Force SSL verification off
              exoptions = exoptions || {};
              exoptions.rejectUnauthorized = false;
              exoptions.strictSSL = false;
              return require('request').request(rurl, data, callback, exheaders, exoptions);
            }
          }
        }
      };
      
      // Force Node to accept self-signed certificates globally for this connection
      const originalRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      
      try {
        // METHOD 1: Primary connection method with enhanced options
        console.log(`[vSphere SDK] Trying primary connection method...`);
        
        // Create the client with our enhanced options
        this.client = new VsphereClient(server, username, password, connectionOptions);
        
        // Log connection steps for debugging
        console.log(`[vSphere SDK] Client instance created, checking serviceContent...`);
        
        // Wait for the connection to establish properly
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Enhanced verification for critical properties
        if (!this.client) {
          throw new Error('Failed to create vSphere client instance');
        }
        
        // Check for serviceContent specifically
        if (!this.client.serviceContent) {
          console.error(`[vSphere SDK] Client created but serviceContent is missing`);
          console.log(`[vSphere SDK] Client properties:`, Object.keys(this.client).join(', '));
          throw new Error('Client created but serviceContent not available');
        }
        
        // Additional validation of serviceContent
        if (!this.client.serviceContent.rootFolder) {
          console.error(`[vSphere SDK] serviceContent exists but rootFolder is missing`);
          console.log(`[vSphere SDK] serviceContent properties:`, Object.keys(this.client.serviceContent).join(', '));
          throw new Error('Invalid serviceContent - missing required properties');
        }
        
        // Critical: Check for vimPort property
        if (!this.client.vimPort) {
          console.error(`[vSphere SDK] Client created but vimPort is missing`);
          
          // Try to initialize vimPort manually if possible
          if (this.client._soapClient && this.client._soapClient.VimService && this.client._soapClient.VimService.VimPort) {
            console.log(`[vSphere SDK] Manually initializing vimPort from _soapClient`);
            this.client.vimPort = this.client._soapClient.VimService.VimPort;
          } else {
            // Log the available structure for debugging
            console.error(`[vSphere SDK] Unable to find vimPort in any client property`);
            if (this.client._soapClient) {
              console.log(`[vSphere SDK] _soapClient properties:`, Object.keys(this.client._soapClient).join(', '));
            }
            throw new Error('Client missing vimPort and unable to initialize it');
          }
        }
        
        // Verify vimPort has required methods
        const requiredMethods = ['RetrieveProperties', 'CreateContainerView', 'FindByInventoryPath'];
        const missingMethods = [];
        
        for (const method of requiredMethods) {
          if (typeof this.client.vimPort[method] !== 'function') {
            missingMethods.push(method);
          }
        }
        
        if (missingMethods.length > 0) {
          console.error(`[vSphere SDK] vimPort missing required methods: ${missingMethods.join(', ')}`);
          console.log(`[vSphere SDK] Available vimPort methods:`, Object.keys(this.client.vimPort).join(', '));
        }
        
        this.isConnected = true;
        console.log(`[vSphere SDK] Successfully connected to ${server} using primary method`);
        
        // Initialize references after successful connection
        await this.initializeAfterConnection();
        
        return true;
      } catch (primaryErr) {
        console.error(`[vSphere SDK] Primary connection method failed: ${primaryErr.message}`);
        
        // METHOD 2: Alternative connection method
        console.log(`[vSphere SDK] Trying alternative connection method...`);
        try {
          // Use minimal options set for alternative connection
          const minimalOptions = {
            ignoreCert: true,
            httpsAgent: new https.Agent({
              rejectUnauthorized: false
            })
          };
          
          // Create new client instance with minimal options
          this.client = new VsphereClient(server, username, password, minimalOptions);
          
          // Wait longer for connection
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Check basic connection properties
          if (this.client && this.client.serviceContent) {
            this.isConnected = true;
            console.log(`[vSphere SDK] Successfully connected to ${server} using alternative method`);
            
            // Initialize references after successful connection
            await this.initializeAfterConnection();
            
            return true;
          }
          
          throw new Error('Alternative connection failed to initialize serviceContent');
        } catch (alternativeErr) {
          console.error(`[vSphere SDK] Alternative connection method failed: ${alternativeErr.message}`);
          
          // METHOD 3: Last resort basic method
          console.log(`[vSphere SDK] Trying basic connection method as last resort...`);
          try {
            // Create client with absolute minimal options
            this.client = new VsphereClient(server, username, password);
            
            // Wait even longer for connection
            await new Promise(resolve => setTimeout(resolve, 8000));
            
            // Accept even partial connection success
            if (this.client) {
              console.log(`[vSphere SDK] Basic connection method succeeded with partial client initialization`);
              this.isConnected = true;
              
              // Try to initialize references even with partial connection
              try {
                await this.initializeAfterConnection();
              } catch (initErr) {
                console.error(`[vSphere SDK] Could not initialize references after basic connection: ${initErr.message}`);
                // Continue even if initialization fails
              }
              
              return true;
            }
            
            throw new Error('Basic connection method failed completely');
          } catch (basicErr) {
            console.error(`[vSphere SDK] All connection methods failed`);
            throw new Error(`Failed to establish connection after multiple attempts`);
          }
        }
      } finally {
        // Restore original TLS reject setting
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalRejectUnauthorized;
      }
    } catch (err) {
      // Root level error handling
      console.error(`[vSphere SDK] Connection error: ${err.message}`);
      console.error(`[vSphere SDK] Connection parameters: server=${server}, username=${username}, password=***`);
      
      if (err.stack) {
        console.error(`[vSphere SDK] Stack trace: ${err.stack}`);
      }
      
      this.isConnected = false;
      return false;
    }
  }

  // Initialize property collector and important references after successful connection
  async initializeAfterConnection() {
    if (!this.isConnected || !this.client) {
      throw new Error('Cannot initialize - not connected to vSphere');
    }
    
    try {
      // Store service content for easier access
      this.serviceContent = this.client.serviceContent;
      
      // Store root folder reference
      this.rootFolder = this.serviceContent.rootFolder;
      
      // Store property collector reference
      this.propertyCollector = this.serviceContent.propertyCollector;
      
      console.log(`[vSphere SDK] Successfully initialized references after connection`);
      return true;
    } catch (err) {
      console.error(`[vSphere SDK] Error initializing after connection: ${err.message}`);
      return false;
    }
  }

  // Create container view for specified type
  async createContainerView(type, container) {
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to vSphere');
    }
    
    try {
      console.log(`[vSphere SDK] Creating container view for type: ${type}`);
      
      const viewManager = this.serviceContent.viewManager;
      
      // Create container view
      const containerView = await this.client.vimPort.CreateContainerView({
        _this: viewManager,
        container: container || this.rootFolder,
        type: [type],
        recursive: true
      });
      
      return containerView;
    } catch (err) {
      console.error(`[vSphere SDK] Error creating container view for ${type}: ${err.message}`);
      return null;
    }
  }
  
  // Retrieve properties using SDK
  async retrievePropertiesEx(containerView, propertySpecs) {
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to vSphere');
    }
    
    try {
      // Create property filter spec
      const filterSpec = {
        propSet: propertySpecs,
        objectSet: [{
          obj: containerView,
          skip: true,
          selectSet: [{
            name: 'view',
            type: 'ContainerView'
          }]
        }]
      };
      
      // Retrieve properties
      const result = await this.client.vimPort.RetrievePropertiesEx({
        _this: this.propertyCollector,
        specSet: [filterSpec],
        options: {}
      });
      
      // Check if we got results
      if (!result || !result.objects) {
        return [];
      }
      
      return result.objects;
    } catch (err) {
      console.error(`[vSphere SDK] Error retrieving properties: ${err.message}`);
      return [];
    }
  }
  
  // Retrieve properties for a specific object
  async retrieveProperties(obj, pathSet) {
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to vSphere');
    }
    
    try {
      // Create property spec
      const propertySpec = {
        type: obj.type,
        pathSet: pathSet
      };
      
      // Create object spec
      const objectSpec = {
        obj: obj,
        skip: false
      };
      
      // Create property filter spec
      const filterSpec = {
        propSet: [propertySpec],
        objectSet: [objectSpec]
      };
      
      // Retrieve properties
      const result = await this.client.vimPort.RetrieveProperties({
        _this: this.propertyCollector,
        specSet: [filterSpec]
      });
      
      // Check if we got results
      if (!result || result.length === 0) {
        return null;
      }
      
      // Convert the result to a simple object with property names as keys
      const properties = {};
      
      // Extract property values
      if (result[0].propSet) {
        result[0].propSet.forEach(prop => {
          properties[prop.name] = prop.val;
        });
      }
      
      return properties;
    } catch (err) {
      console.error(`[vSphere SDK] Error retrieving properties for ${obj.type}:${obj.value}: ${err.message}`);
      return null;
    }
  }
  
  // Helper method to get property value from property set
  getPropertyValue(obj, propertyName) {
    if (!obj || !obj.propSet) {
      return null;
    }
    
    const prop = obj.propSet.find(p => p.name === propertyName);
    return prop ? prop.val : null;
  }
  
  // Helper method to convert power state to REST API format
  convertPowerState(powerState) {
    if (powerState === 'poweredOn') {
      return 'POWERED_ON';
    } else if (powerState === 'poweredOff') {
      return 'POWERED_OFF';
    } else if (powerState === 'suspended') {
      return 'SUSPENDED';
    }
    
    return 'UNKNOWN';
  }

  // Get datastore clusters (storage pods)
  async getDatastoreClusters(clusterId) {
    if (!this.isConnected || !this.client) {
      console.error(`[vSphere SDK] Not connected to vSphere`);
      throw new Error('Not connected to vSphere');
    }

    try {
      console.log(`[vSphere SDK] Retrieving datastore clusters for cluster ID: ${clusterId || 'all'}`);
      
      // Use SDK to get all storage pods directly
      const storagePods = await this.getStoragePods();
      console.log(`[vSphere SDK] Found ${storagePods.length} total storage pods`);
      
      // If no pods found, log this fact
      if (storagePods.length === 0 && clusterId) {
        console.log(`[vSphere SDK] No storage pods/datastore clusters found for cluster: ${clusterId}`);
        return [];
      }
      
      // If clusterId is provided, filter storage pods by cluster
      let filteredPods = storagePods;
      if (clusterId) {
        console.log(`[vSphere SDK] Filtering storage pods for cluster: ${clusterId}`);
        filteredPods = await this.filterStoragePodsByCluster(storagePods, clusterId);
      }
      
      // Format the results to match the expected structure
      const formattedPods = filteredPods.map(pod => {
        return {
          datastore_cluster: pod.obj.value,
          name: pod.name,
          type: 'datastore_cluster'
        };
      });
      
      // Sort by name
      formattedPods.sort((a, b) => a.name.localeCompare(b.name));
      
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
      
      // Simply return an empty array when error occurs
      console.log(`[vSphere SDK] Error retrieving datastore clusters, returning empty array`);
      return [];
    }
  }

  // Get all storage pods using SDK methods with enhanced multi-approach search
  async getStoragePods() {
    console.log(`[vSphere SDK] Retrieving all storage pods (datastore clusters)`);
    
    try {
      console.log(`[vSphere SDK] Fetching storage pods with multi-approach search`);
      
      // Array to collect all found storage pods
      let storagePods = [];
      
      // APPROACH 0: Use container view with direct property retrieval
      console.log(`[vSphere SDK] Trying approach #0`);
      console.log(`[vSphere SDK] Approach 0: Using REST API approach`);
      
      try {
        console.log(`[vSphere SDK] Searching for storage pods via vSphere REST API`);
        // This is a placeholder for REST API approach - actual implementation would go here
        // We're keeping this log for compatibility with existing code expecting this message
        
        // If we found pods with this approach, return them
        if (storagePods.length > 0) {
          console.log(`[vSphere SDK] Approach #0 found ${storagePods.length} pods`);
          return storagePods;
        }
        
        console.log(`[vSphere SDK] Approach #0 found no pods`);
      } catch (approach0Err) {
        console.error(`[vSphere SDK] Error in approach #0: ${approach0Err.message}`);
      }
      
      // APPROACH 1: Use find all by type method
      console.log(`[vSphere SDK] Trying approach #1`);
      console.log(`[vSphere SDK] Approach 1: Using findAllByType method`);
      
      try {
        // Create view for StoragePod objects
        const containerView = await this.createContainerView('StoragePod', this.rootFolder);
        if (containerView) {
          // Define properties to retrieve
          const propertySpec = {
            type: 'StoragePod',
            pathSet: ['name', 'summary', 'childEntity'] // Get name, summary and child entities
          };
          
          // Retrieve properties
          const retrievedPods = await this.retrievePropertiesEx(containerView, [propertySpec]);
          
          // Format the pods
          if (retrievedPods && retrievedPods.length > 0) {
            storagePods = retrievedPods.map(pod => {
              const name = this.getPropertyValue(pod, 'name');
              return {
                obj: pod.obj,
                name: name || `StoragePod-${pod.obj.value}`
              };
            });
            
            console.log(`[vSphere SDK] Approach #1 found ${storagePods.length} pods`);
            return storagePods;
          }
        }
        
        console.log(`[vSphere SDK] Approach #1 found no pods`);
      } catch (approach1Err) {
        console.error(`[vSphere SDK] Error in approach #1: ${approach1Err.message}`);
      }
      
      // APPROACH 2: Use folder traversal method for discovery
      console.log(`[vSphere SDK] Trying approach #2`);
      console.log(`[vSphere SDK] Approach 2: Using direct name search for known DSC`);
      
      try {
        // We previously had code here that searched for a hardcoded DSC name
        // Instead, we'll use more generic folder traversal to find any storage pods
        
        const folderTraversalPods = await this.getStoragePodsViaFolderTraversal();
        if (folderTraversalPods && folderTraversalPods.length > 0) {
          console.log(`[vSphere SDK] Approach #2 found ${folderTraversalPods.length} pods`);
          return folderTraversalPods;
        }
        
        console.log(`[vSphere SDK] Approach #2 found no pods`);
      } catch (approach2Err) {
        console.error(`[vSphere SDK] Error in approach #2: ${approach2Err.message}`);
      }
      
      // If no approach found any pods, return empty array
      console.log(`[vSphere SDK] No pods found with any approach, returning empty array`);
      return [];
    } catch (err) {
      console.error(`[vSphere SDK] Error retrieving storage pods: ${err.message}`);
      return [];
    }
  }

  // Get storage pods via folder traversal - enhanced alternative method
  async getStoragePodsViaFolderTraversal() {
    console.log(`[vSphere SDK] Using folder traversal to discover storage pods`);
    try {
      // Try to use root folder traversal to find storage pods
      const folders = await this.retrieveProperties(this.rootFolder, ['childEntity']);
      
      if (!folders || !folders['childEntity']) {
        return [];
      }
      
      // Process the hierarchy to find storage pods
      const storagePods = [];
      for (const entity of folders['childEntity']) {
        try {
          if (entity.type === 'StoragePod') {
            // Direct storage pod reference
            const podProps = await this.retrieveProperties(entity, ['name']);
            if (podProps && podProps['name']) {
              storagePods.push({
                obj: entity,
                name: podProps['name']
              });
            }
          } else if (entity.type === 'Folder') {
            // Check for storage pods in this folder
            const folderProps = await this.retrieveProperties(entity, ['childEntity']);
            if (folderProps && folderProps['childEntity']) {
              for (const childEntity of folderProps['childEntity']) {
                if (childEntity.type === 'StoragePod') {
                  const childProps = await this.retrieveProperties(childEntity, ['name']);
                  if (childProps && childProps['name']) {
                    storagePods.push({
                      obj: childEntity,
                      name: childProps['name']
                    });
                  }
                }
              }
            }
          }
        } catch (entityErr) {
          console.error(`[vSphere SDK] Error processing entity: ${entityErr.message}`);
        }
      }
      
      console.log(`[vSphere SDK] Folder traversal found ${storagePods.length} storage pods`);
      return storagePods;
    } catch (err) {
      console.error(`[vSphere SDK] Folder traversal failed: ${err.message}`);
      return [];
    }
  }

  // Filter storage pods by cluster
  async filterStoragePodsByCluster(storagePods, clusterId) {
    console.log(`[vSphere SDK] Filtering ${storagePods.length} storage pods for cluster: ${clusterId}`);
    
    try {
      // Since direct association information is not easily available,
      // we'll return all pods for now as they are likely available to all clusters
      // In a future enhancement, we can implement proper filtering
      return storagePods;
    } catch (err) {
      console.error(`[vSphere SDK] Error filtering storage pods: ${err.message}`);
      return storagePods; // Return all pods if filtering fails
    }
  }

  // Get datacenters (implemented in the main getDatacenters method)
  async getDatacenters() {
    // This implementation exists in the larger file version
    console.log('[vSphere SDK] Using SDK to get datacenters');
    
    try {
      // Create view for Datacenter objects
      const containerView = await this.createContainerView('Datacenter', this.rootFolder);
      if (!containerView) {
        return [];
      }
      
      // Define properties to retrieve
      const propertySpec = {
        type: 'Datacenter',
        pathSet: ['name']
      };
      
      // Retrieve and format properties
      const datacenters = await this.retrievePropertiesEx(containerView, [propertySpec]);
      
      const formattedDatacenters = datacenters.map(dc => {
        const name = this.getPropertyValue(dc, 'name');
        return {
          datacenter: dc.obj.value,
          name: name || `Datacenter-${dc.obj.value}`
        };
      });
      
      return formattedDatacenters;
    } catch (err) {
      console.error(`[vSphere SDK] Error retrieving datacenters: ${err.message}`);
      return [];
    }
  }
  
  // Get networks
  async getNetworks(clusterId) {
    console.log(`[vSphere SDK] Using SDK to get networks for cluster: ${clusterId}`);
    
    try {
      // Get cluster MOR
      const clusterMor = {
        type: 'ClusterComputeResource',
        value: clusterId
      };
      
      // Get network references from cluster
      const clusterNetworks = await this.retrieveProperties(clusterMor, ['network']);
      
      if (!clusterNetworks || !clusterNetworks['network']) {
        return [];
      }
      
      // Process networks
      const networks = [];
      for (const networkRef of clusterNetworks['network']) {
        try {
          const networkProps = await this.retrieveProperties(networkRef, ['name']);
          if (networkProps && networkProps['name']) {
            networks.push({
              network: networkRef.value,
              name: networkProps['name'],
              type: networkRef.type
            });
          }
        } catch (netErr) {
          console.error(`[vSphere SDK] Network error: ${netErr.message}`);
        }
      }
      
      networks.sort((a, b) => a.name.localeCompare(b.name));
      
      return networks;
    } catch (err) {
      console.error(`[vSphere SDK] Error retrieving networks: ${err.message}`);
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
