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
            // If connection details aren't available, use demo values
            populateSelectWithDemoData(datacenterSelect, [
                { id: 'datacenter-1', name: 'EBDC NONPROD' },
                { id: 'datacenter-2', name: 'EBDC PROD' },
                { id: 'datacenter-3', name: 'USDC NONPROD' },
                { id: 'datacenter-4', name: 'USDC PROD' }
            ]);
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
        fetchInfrastructureComponent('datastoreClusters', clusterName, datastoreClusterSelect)
            .then(result => {
                // If we have a current workspace, try to select the saved datastore cluster
                if (window.currentWorkspace && window.currentWorkspace.config && window.currentWorkspace.config.datastore_cluster) {
                    selectOptionByText(datastoreClusterSelect, window.currentWorkspace.config.datastore_cluster);
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
            // Show loading state
            selectElement.innerHTML = '<option value="">Loading...</option>';
            
            // Get vSphere connection details
            const vsphereSettings = getVSphereConnectionInfo();
            
            if (!vsphereSettings.server || !vsphereSettings.user || !vsphereSettings.password) {
                // Use demo data if no connection details
                return populateSelectWithDemoData(selectElement, getDemoDataForComponent(component, parent));
            }
            
            // Make API call to fetch infrastructure components
            const response = await fetch('/api/vsphere-infra/components', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    vsphereServer: vsphereSettings.server,
                    vsphereUser: vsphereSettings.user,
                    vspherePassword: vsphereSettings.password,
                    component,
                    parent
                })
            });
            
            const data = await response.json();
            
            if (data.success && data.data && data.data.length > 0) {
                // Populate select with fetched data
                populateSelect(selectElement, data.data);
                return true;
            } else {
                // Fall back to demo data if API call fails or returns no data
                return populateSelectWithDemoData(selectElement, getDemoDataForComponent(component, parent));
            }
        } catch (error) {
            console.error(`Error fetching ${component}:`, error);
            return populateSelectWithDemoData(selectElement, getDemoDataForComponent(component, parent));
        }
    }
    
    // Helper function to populate a select element with options
    function populateSelect(selectElement, data) {
        // Clear existing options except the first one
        selectElement.innerHTML = '<option value="">Select an option</option>';
        
            // Add new options
            data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.name; // Use name as value, not ID
                option.textContent = item.name;
                option.dataset.id = item.id; // Store ID as data attribute if needed
                selectElement.appendChild(option);
            });
        
        // Enable the select element
        selectElement.disabled = false;
    }
    
    // Helper function to populate a select with demo data
    function populateSelectWithDemoData(selectElement, data) {
        // Clear existing options
        selectElement.innerHTML = '<option value="">Select an option</option>';
        
        // Add demo options
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.name; // Use name as value, not ID
            option.textContent = item.name;
            option.dataset.id = item.id; // Store ID as data attribute if needed
            selectElement.appendChild(option);
        });
        
        // Enable the select element
        selectElement.disabled = false;
        
        return true;
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
    
    // Demo data for each component type
    function getDemoDataForComponent(component, parent) {
        const demoData = {
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
                    { id: 'cluster-5', name: 'pr-cl61-lin' }
                ],
                'default': [
                    { id: 'cluster-1', name: 'np-cl60-lin' }
                ]
            },
            datastoreClusters: {
                'np-cl60-lin': [
                    { id: 'datastore-cluster-1', name: 'np-cl60-dsc' },
                    { id: 'datastore-cluster-2', name: 'np-cl60-dsc-ssd' }
                ],
                'default': [
                    { id: 'datastore-cluster-1', name: 'np-cl60-dsc' }
                ]
            },
            networks: {
                'np-cl60-lin': [
                    { id: 'network-1', name: 'np-lin-vds-989-linux' },
                    { id: 'network-2', name: 'np-lin-vds-990-linux' }
                ],
                'default': [
                    { id: 'network-1', name: 'np-lin-vds-989-linux' }
                ]
            }
        };
        
        if (component === 'datacenters') {
            return demoData.datacenters;
        } else if (component === 'clusters') {
            return demoData.clusters[parent] || demoData.clusters.default;
        } else if (component === 'datastoreClusters') {
            return demoData.datastoreClusters[parent] || demoData.datastoreClusters.default;
        } else if (component === 'networks') {
            return demoData.networks[parent] || demoData.networks.default;
        }
        
        return [];
    }
    
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
});
