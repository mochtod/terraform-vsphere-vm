// Infrastructure component selection for vSphere VM Provisioning
document.addEventListener('DOMContentLoaded', function() {
    // DOM elements for infrastructure dropdowns
    const datacenterSelect = document.getElementById('datacenter');
    const clusterSelect = document.getElementById('cluster');
    const datastoreClusterSelect = document.getElementById('datastore_cluster');
    const networkSelect = document.getElementById('network');
    
    // Initial flag to prevent multiple calls on first load
    let initialLoad = true;
    
    // Fetch and populate datacenters on page load
    function initializeInfrastructureSelects() {
        // Get vSphere connection info from global settings or form
        const vsphereSettings = getVSphereConnectionInfo();
        
        if (!vsphereSettings.server || !vsphereSettings.user || !vsphereSettings.password) {
            // If connection details aren't available, show 'No data' in dropdowns
            datacenterSelect.innerHTML = '<option value="">No data</option>';
            datacenterSelect.disabled = true;
            return;
        }
        
        // Load datacenters
        fetchInfrastructureComponent('datacenters', null, datacenterSelect)
            .then(result => {
                // If we have a current workspace, try to select the saved datacenter
                if (window.currentWorkspace && window.currentWorkspace.config && window.currentWorkspace.config.datacenter) {
                    selectOptionByText(datacenterSelect, window.currentWorkspace.config.datacenter);
                    
                    // If datacenter is selected, load clusters
                    if (datacenterSelect.value) {
                        const datacenterName = datacenterSelect.options[datacenterSelect.selectedIndex].text;
                        loadClusters(datacenterName);
                    }
                }
            });
    }
    
    // Listen for changes on vSphere connection fields
    const connectionFields = ['vsphere_server', 'vsphere_user', 'vsphere_password'];
    connectionFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('change', function() {
                // Only reload datacenters if we have all connection fields
                const vsphereServer = document.getElementById('vsphere_server').value;
                const vsphereUser = document.getElementById('vsphere_user').value;
                const vspherePassword = document.getElementById('vsphere_password').value;
                
                if (vsphereServer && vsphereUser && vspherePassword) {
                    resetSelects();
                    initializeInfrastructureSelects();
                }
            });
        }
    });
    
    // Reset all select dropdowns to empty state
    function resetSelects() {
        clusterSelect.innerHTML = '<option value="">Select Cluster</option>';
        datastoreClusterSelect.innerHTML = '<option value="">Select Datastore Cluster</option>';
        networkSelect.innerHTML = '<option value="">Select Network</option>';
        
        // Disable dependent selects until parent is selected
        clusterSelect.disabled = true;
        datastoreClusterSelect.disabled = true;
        networkSelect.disabled = true;
    }
    
    // Event listener for datacenter selection
    datacenterSelect.addEventListener('change', function() {
        resetSelects();
        
        if (this.value) {
            const datacenterName = this.options[this.selectedIndex].text;
            loadClusters(datacenterName);
        }
        
        // Generate tfvars if not initial load
        if (!initialLoad) {
            if (typeof generateTfvars === 'function') {
                generateTfvars();
            }
        }
    });
    
    // Event listener for cluster selection
    clusterSelect.addEventListener('change', function() {
        // Reset dependent selects
        datastoreClusterSelect.innerHTML = '<option value="">Select Datastore Cluster</option>';
        networkSelect.innerHTML = '<option value="">Select Network</option>';
        datastoreClusterSelect.disabled = true;
        networkSelect.disabled = true;
        
        if (this.value) {
            const clusterName = this.options[this.selectedIndex].text;
            loadDatastoreClusters(clusterName);
            loadNetworks(clusterName);
        }
        
        // Generate tfvars
        if (!initialLoad) {
            if (typeof generateTfvars === 'function') {
                generateTfvars();
            }
        }
    });
    
    // Event listeners for remaining select changes
    datastoreClusterSelect.addEventListener('change', function() {
        if (!initialLoad && typeof generateTfvars === 'function') {
            generateTfvars();
        }
    });
    
    networkSelect.addEventListener('change', function() {
        if (!initialLoad && typeof generateTfvars === 'function') {
            generateTfvars();
        }
    });
    
    // Load clusters for selected datacenter
    function loadClusters(datacenterName) {
        clusterSelect.disabled = false;
        fetchInfrastructureComponent('clusters', datacenterName, clusterSelect)
            .then(result => {
                // If we have a current workspace, try to select the saved cluster
                if (window.currentWorkspace && window.currentWorkspace.config && window.currentWorkspace.config.cluster) {
                    selectOptionByText(clusterSelect, window.currentWorkspace.config.cluster);
                    
                    // If cluster is selected, load datastore clusters and networks
                    if (clusterSelect.value) {
                        const clusterName = clusterSelect.options[clusterSelect.selectedIndex].text;
                        loadDatastoreClusters(clusterName);
                        loadNetworks(clusterName);
                    }
                }
            });
    }
    
    // Load datastore clusters for selected cluster
    function loadDatastoreClusters(clusterName) {
        datastoreClusterSelect.disabled = false;
        datastoreClusterSelect.innerHTML = '<option value="">Loading...</option>';
        
        // Clear any existing help text
        if (datastoreClusterSelect.parentNode) {
            const existingHelp = datastoreClusterSelect.parentNode.querySelector('.help-text');
            if (existingHelp) {
                existingHelp.remove();
            }
        }
        
        console.log(`[UI] Fetching datastore clusters for cluster: ${clusterName}`);
        
        fetchInfrastructureComponent('datastoreClusters', clusterName, datastoreClusterSelect)
            .then(result => {
                // Check if we have any datastore clusters
                const hasClusters = result && result.data && result.data.length > 0;
                
                if (!hasClusters) {
                    console.log(`[UI] No datastore clusters found for cluster: ${clusterName}`);
                    
                    // Handle the case where no datastore clusters are available
                    datastoreClusterSelect.innerHTML = '<option value="">No datastore clusters available</option>';
                    
                    // Add a help text explaining why
                    const helpText = document.createElement('div');
                    helpText.className = 'help-text';
                    helpText.style.color = '#666';
                    helpText.style.fontSize = '0.9em';
                    helpText.style.marginTop = '5px';
                    helpText.textContent = 'Datastore clusters (e.g., np-cl60-dsc) are not configured in this vSphere environment for the selected cluster.';
                    
                    // Insert after the select element
                    if (datastoreClusterSelect.parentNode) {
                        datastoreClusterSelect.parentNode.insertBefore(helpText, datastoreClusterSelect.nextSibling);
                    }
                    
                    // Update the form state
                    if (typeof generateTfvars === 'function' && !initialLoad) {
                        generateTfvars();
                    }
                    return;
                }
                
                console.log(`[UI] Found ${result.data.length} datastore clusters for cluster: ${clusterName}`);
                
                // Log if np-cl60-dsc is in the results
                const exampleClusterFound = result.data.some(ds => ds.name === 'np-cl60-dsc');
                if (exampleClusterFound) {
                    console.log(`[UI] Example cluster 'np-cl60-dsc' found in results`);
                }
                
                // If we have a current workspace, try to select the saved datastore cluster
                if (window.currentWorkspace && window.currentWorkspace.config && window.currentWorkspace.config.datastore_cluster) {
                    const selected = selectOptionByText(datastoreClusterSelect, window.currentWorkspace.config.datastore_cluster);
                    if (selected) {
                        console.log(`[UI] Selected saved datastore cluster: ${window.currentWorkspace.config.datastore_cluster}`);
                    }
                }
            })
            .catch(error => {
                console.error('[UI] Error loading datastore clusters:', error);
                datastoreClusterSelect.innerHTML = '<option value="">Error loading datastore clusters</option>';
                
                // Add a help text explaining the error
                const helpText = document.createElement('div');
                helpText.className = 'help-text error';
                helpText.style.color = '#d9534f';
                helpText.style.fontSize = '0.9em';
                helpText.style.marginTop = '5px';
                helpText.textContent = `Failed to load datastore clusters: ${error.message || 'Unknown error'}. Check vSphere configuration.`;
                
                // Insert after the select element
                if (datastoreClusterSelect.parentNode) {
                    datastoreClusterSelect.parentNode.insertBefore(helpText, datastoreClusterSelect.nextSibling);
                }
            });
    }
    
    // Load networks for selected cluster
    function loadNetworks(clusterName) {
        networkSelect.disabled = false;
        fetchInfrastructureComponent('networks', clusterName, networkSelect)
            .then(result => {
                // If we have a current workspace, try to select the saved network
                if (window.currentWorkspace && window.currentWorkspace.config && window.currentWorkspace.config.network) {
                    selectOptionByText(networkSelect, window.currentWorkspace.config.network);
                }
            });
    }
    
    // Helper function to get vSphere connection information
    function getVSphereConnectionInfo() {
        // Get password from form (it's always input directly for security reasons)
        const vspherePassword = document.getElementById('vsphere_password').value;
        
        // Try to get server and user from global settings if available
        if (window.globalSettings && window.globalSettings.vsphere) {
            return {
                server: window.globalSettings.vsphere.server || '',
                user: window.globalSettings.vsphere.user || '',
                password: vspherePassword || ''
            };
        }
        
        // Fallback to form fields
        return {
            server: document.getElementById('vsphere_server')?.value || '',
            user: document.getElementById('vsphere_user')?.value || '',
            password: vspherePassword || ''
        };
    }
    
    // Helper function to fetch infrastructure components from API
    async function fetchInfrastructureComponent(component, parent, selectElement) {
        try {
            selectElement.innerHTML = '<option value="">Loading...</option>';
            const vsphereSettings = getVSphereConnectionInfo();
            if (!vsphereSettings.server || !vsphereSettings.user || !vsphereSettings.password) {
                // No connection details, clear dropdown
                selectElement.innerHTML = '<option value="">No data</option>';
                selectElement.disabled = true;
                return;
            }
            // For datacenters, no parent needed. For clusters, parent is datacenter ID.
            let parentId = parent;
            if (component === 'clusters' && datacenterSelect) {
                const selected = datacenterSelect.options[datacenterSelect.selectedIndex];
                parentId = selected ? selected.value : parent;
            }
            const response = await fetch('/api/vsphere-infra/components', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vsphereServer: vsphereSettings.server,
                    vsphereUser: vsphereSettings.user,
                    vspherePassword: vsphereSettings.password,
                    component,
                    parent: parentId
                })
            });
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                populateSelect(selectElement, data.data);
                selectElement.disabled = false;
            } else {
                selectElement.innerHTML = '<option value="">No data</option>';
                selectElement.disabled = true;
            }
        } catch (err) {
            selectElement.innerHTML = '<option value="">No data</option>';
            selectElement.disabled = true;
        }
    }
    
    // Helper function to populate a select element with options
    function populateSelect(selectElement, data) {
        // Clear existing options except the first one
        selectElement.innerHTML = '<option value="">Select an option</option>';
        
        // Sort the data alphabetically by name (A-Z)
        data.sort((a, b) => a.name.localeCompare(b.name));
        
    // Log detailed information for datastore clusters
    if (selectElement.id === 'datastore_cluster') {
        console.log('************************ DATASTORE CLUSTERS DEBUG ************************');
        console.log(`Populating datastore clusters dropdown with ${data.length} items:`);
        console.log(JSON.stringify(data, null, 2));
        console.log('************************************************************************');
    }
        
        // Add new options - special handling for datastore clusters
        data.forEach(item => {
            const option = document.createElement('option');
            
            // For datastore clusters, use ID as value to ensure correct selection
            if (selectElement.id === 'datastore_cluster') {
                // For datastore clusters, use the most reliable ID property available
                const datastoreClusterId = item.datastore_cluster || item.id || (item.original && item.original.id);
                option.value = datastoreClusterId;
                
                // Add data attributes for debugging and traceability
                option.dataset.type = 'datastore_cluster';
                
                // Store original data for debugging if available
                if (item.original) {
                    option.dataset.original = JSON.stringify(item.original);
                }
                
                // Log each item as it's added to the dropdown
                console.log(`[UI] Adding datastore cluster option: ${item.name} (${datastoreClusterId})`);
            } else {
                option.value = item.name; // Use name for other dropdown types
            }
            
            option.textContent = item.name;
            option.dataset.id = item.id; // Always store ID as data attribute
            
            // Add the item to the dropdown
            selectElement.appendChild(option);
        });
        
        // Enable the select element
        selectElement.disabled = false;
    }
    
    // Helper function to select an option by text
    function selectOptionByText(selectElement, text) {
        for (let i = 0; i < selectElement.options.length; i++) {
            if (selectElement.options[i].text === text) {
                selectElement.selectedIndex = i;
                return true;
            }
        }
        return false;
    }
    
    // Fetch and populate global infrastructure data
    async function fetchGlobalInfrastructure() {
        try {
            const response = await fetch('/api/vsphere-infra/cache');
            const data = await response.json();
            if (data.success) {
                populateInfrastructureDropdowns(data.infrastructure);
            } else {
                console.error('Failed to fetch global infrastructure:', data.error);
            }
        } catch (err) {
            console.error('Error fetching global infrastructure:', err.message);
        }
    }

    // Populate dropdowns with global infrastructure data
    function populateInfrastructureDropdowns(infrastructure) {
        const datacenterSelect = document.getElementById('datacenter');
        const clusterSelect = document.getElementById('cluster');
        const datastoreClusterSelect = document.getElementById('datastore_cluster');
        const networkSelect = document.getElementById('network');

        // Populate datacenters
        datacenterSelect.innerHTML = '<option value="">Select Datacenter</option>';
        infrastructure.datacenters.forEach(dc => {
            const option = document.createElement('option');
            option.value = dc.datacenter;
            option.textContent = dc.name;
            datacenterSelect.appendChild(option);
        });

        // Populate clusters when a datacenter is selected
        datacenterSelect.addEventListener('change', function () {
            const selectedDatacenter = this.value;
            clusterSelect.innerHTML = '<option value="">Select Cluster</option>';
            datastoreClusterSelect.innerHTML = '<option value="">Select Datastore Cluster</option>';
            networkSelect.innerHTML = '<option value="">Select Network</option>';
            
            // Disable dependent selects
            datastoreClusterSelect.disabled = true;
            networkSelect.disabled = true;
            
            if (selectedDatacenter && infrastructure.clusters[selectedDatacenter]) {
                // Enable cluster select
                clusterSelect.disabled = false;
                
                infrastructure.clusters[selectedDatacenter].forEach(cluster => {
                    const option = document.createElement('option');
                    option.value = cluster.cluster;
                    option.textContent = cluster.name;
                    clusterSelect.appendChild(option);
                });
            } else {
                clusterSelect.disabled = true;
            }
        });
        
        // Populate datastore clusters and networks when a cluster is selected
        clusterSelect.addEventListener('change', function () {
            const selectedCluster = this.value;
            datastoreClusterSelect.innerHTML = '<option value="">Select Datastore Cluster</option>';
            networkSelect.innerHTML = '<option value="">Select Network</option>';
            
            // Check if we have datastore clusters and networks for this cluster
            if (selectedCluster) {
                // Enable datastore cluster and network selects
                datastoreClusterSelect.disabled = false;
                networkSelect.disabled = false;
                
                // Populate datastore clusters
                if (infrastructure.datastoreClusters && infrastructure.datastoreClusters[selectedCluster]) {
                    let datastoreClusters = infrastructure.datastoreClusters[selectedCluster];
                    // Log the datastore clusters received from the cache
                    console.log('Cache-provided datastore clusters:', JSON.stringify(datastoreClusters));
                    
                    // Sort datastore clusters alphabetically by name
                    datastoreClusters.sort((a, b) => a.name.localeCompare(b.name));
                    
                    datastoreClusters.forEach(ds => {
                        const option = document.createElement('option');
                        // For datastore clusters, use the most reliable ID property available
                        const dsId = ds.datastore_cluster || ds.id || (ds.original && ds.original.id);
                        option.value = dsId;
                        option.textContent = ds.name;
                        
                        // Add data attributes for debugging
                        option.dataset.type = 'datastore_cluster';
                        if (ds.original) {
                            option.dataset.original = JSON.stringify(ds.original);
                        }
                        
                        // Log each datastore cluster being added
                        console.log(`[UI] Adding cached datastore cluster option: ${ds.name} (${dsId})`);
                        
                        datastoreClusterSelect.appendChild(option);
                    });
                }
                
                // Populate networks
                if (infrastructure.networks && infrastructure.networks[selectedCluster]) {
                    let networks = infrastructure.networks[selectedCluster];
                    // Sort networks alphabetically by name
                    networks.sort((a, b) => a.name.localeCompare(b.name));
                    networks.forEach(network => {
                        const option = document.createElement('option');
                        option.value = network.network;
                        option.textContent = network.name;
                        networkSelect.appendChild(option);
                    });
                }
            } else {
                datastoreClusterSelect.disabled = true;
                networkSelect.disabled = true;
            }
        });
    }

    // Call this function on page load to initialize dropdowns
    fetchGlobalInfrastructure();
    
    // Initialize dropdowns when global settings are loaded
    // We'll set up an observer to wait for global settings to be loaded
    
    // Function to check if we can initialize (either from global settings or form fields)
    function checkAndInitializeDropdowns() {
        const settings = getVSphereConnectionInfo();
        
        if (settings.server && settings.user) {
            // Initialize the dropdowns
            initializeInfrastructureSelects();
            
            // Set initial load to false after a short delay
            setTimeout(() => {
                initialLoad = false;
            }, 1000);
            
            return true;
        }
        
        return false;
    }
    
    // Add an event listener for when global settings are loaded
    document.addEventListener('settingsLoaded', function() {
        checkAndInitializeDropdowns();
    });
    
    // Try to initialize right away as well (in case settings are already loaded)
    if (!checkAndInitializeDropdowns()) {
        // If we don't have connection details, initialize with demo data
        initializeInfrastructureSelects();
    }
    
    // Fetch and populate datacenter dropdown on page load or workspace creation
    async function initializeDatacenterDropdown() {
        const datacenterSelect = document.getElementById('datacenter');
        try {
            // Fetch global infrastructure data
            const response = await fetch('/api/vsphere-infra/cache');
            const data = await response.json();

            if (data.success && data.infrastructure.datacenters.length > 0) {
                // Populate datacenter dropdown
                datacenterSelect.innerHTML = '<option value="">Select Datacenter</option>';
                data.infrastructure.datacenters.forEach(dc => {
                    const option = document.createElement('option');
                    option.value = dc.datacenter;
                    option.textContent = dc.name;
                    datacenterSelect.appendChild(option);
                });
                datacenterSelect.disabled = false;
            } else {
                datacenterSelect.innerHTML = '<option value="">No datacenters available</option>';
                datacenterSelect.disabled = true;
            }
        } catch (err) {
            console.error('Error fetching datacenters:', err.message);
            datacenterSelect.innerHTML = '<option value="">Error loading datacenters</option>';
            datacenterSelect.disabled = true;
        }
    }

    // Call this function when a new workspace is created or the page loads
    initializeDatacenterDropdown();
});
