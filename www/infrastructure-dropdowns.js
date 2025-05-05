// Infrastructure component selection for vSphere VM Provisioning
document.addEventListener('DOMContentLoaded', function() {
    // DOM elements for infrastructure dropdowns
    const datacenterSelect = document.getElementById('datacenter');
    const clusterSelect = document.getElementById('cluster');
    const datastoreClusterSelect = document.getElementById('datastore_cluster');
    const networkSelect = document.getElementById('network');

    // Initial flag to prevent multiple calls on first load
    let initialLoad = true;

    // Helper function to get vSphere connection information
    function getVSphereConnectionInfo() {
        const vspherePassword = document.getElementById('vsphere_password').value;
        let server = '';
        let user = '';

        // Prioritize global settings
        if (window.globalSettings && window.globalSettings.vsphere) {
            server = window.globalSettings.vsphere.server || '';
            user = window.globalSettings.vsphere.user || '';
        }
        // No else needed - if global settings don't provide values, server/user remain ''

        return {
            server: server,
            user: user,
            password: vspherePassword || ''
        };
    }

    // Function to populate dropdowns (can be called initially or on update)
    function updateInfrastructureDropdowns() {
        console.log("Attempting to update infrastructure dropdowns...");
        const vsphereSettings = getVSphereConnectionInfo();

        // Always try to fetch datacenters if possible, otherwise use demo
        if (vsphereSettings.server && vsphereSettings.user && vsphereSettings.password) {
            console.log("Fetching real datacenter data...");
            fetchInfrastructureComponent('datacenters', null, datacenterSelect)
                .then(success => {
                    if (success) {
                        console.log("Successfully fetched real datacenter data.");
                        // If fetch worked, potentially load children based on workspace
                        if (window.currentWorkspace && window.currentWorkspace.config && window.currentWorkspace.config.datacenter) {
                            if (selectOptionByText(datacenterSelect, window.currentWorkspace.config.datacenter)) {
                                console.log("Pre-selecting datacenter and loading clusters for workspace:", window.currentWorkspace.config.datacenter);
                                loadClusters(datacenterSelect.options[datacenterSelect.selectedIndex].text);
                            }
                        }
                    } else {
                         console.log("Fetch infrastructure component returned false, likely using demo data fallback.");
                    }
                    // If fetch failed, fetchInfrastructureComponent already fell back to demo data
                });
        } else {
            // Populate datacenters with demo data if connection info incomplete
            console.log("Connection info incomplete, populating datacenters with demo data.");
            populateSelectWithDemoData(datacenterSelect, getDemoDataForComponent('datacenters', null));
            // Reset children selects as we are using demo data
            resetSelects();
        }
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
                    updateInfrastructureDropdowns();
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
            console.log("Datacenter changed, loading clusters for:", datacenterName);
            loadClusters(datacenterName);
        }
        if (!initialLoad && typeof generateTfvars === 'function') {
            generateTfvars();
        }
    });
    
    // Event listener for cluster selection
    clusterSelect.addEventListener('change', function() {
        datastoreClusterSelect.innerHTML = '<option value="">Select Datastore Cluster</option>';
        networkSelect.innerHTML = '<option value="">Select Network</option>';
        datastoreClusterSelect.disabled = true;
        networkSelect.disabled = true;
        if (this.value) {
            const clusterName = this.options[this.selectedIndex].text;
            console.log("Cluster changed, loading datastores and networks for:", clusterName);
            loadDatastoreClusters(clusterName);
            loadNetworks(clusterName);
        }
        if (!initialLoad && typeof generateTfvars === 'function') {
            generateTfvars();
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
    
    // --- Initialization ---

    // 1. Initial population on DOMContentLoaded: Always start with demo data
    console.log("Initial population with demo data.");
    populateSelectWithDemoData(datacenterSelect, getDemoDataForComponent('datacenters', null));
    resetSelects(); // Ensure children are reset and disabled initially

    // 2. Add listener for settings loaded
    document.addEventListener('settingsLoaded', function() {
        console.log('Global settings loaded event received.');
        updateInfrastructureDropdowns(); // Try loading real data now
    });

    // 3. Add listener for password input change (required for API calls)
    const passwordInput = document.getElementById('vsphere_password');
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            // Debounce or throttle this if it causes performance issues
            console.log('Password input changed.');
            updateInfrastructureDropdowns(); // Try loading real data now
        });
    }

    // 4. Set initialLoad flag after a delay
    setTimeout(() => {
        console.log("Initial load period finished.");
        initialLoad = false;
    }, 1500); // Delay to allow initial population/selection

    // --- Event Listeners for Dropdown Changes ---
    // (These remain largely the same, ensuring they call functions that handle API/demo fallback)

}); // End DOMContentLoaded
