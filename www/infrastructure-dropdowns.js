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
    // Returns connection details object or null if incomplete
    function getVSphereConnectionInfo() {
        // Try multiple strategies to find the password field
        let passwordField = null;
        let vspherePassword = '';
        
        // Strategy 1: Direct ID lookup
        passwordField = document.getElementById('vsphere_password');
        
        // Strategy 2: Query selector fallback
        if (!passwordField) {
            passwordField = document.querySelector('input[id="vsphere_password"]');
        }
        
        // Strategy 3: Find by type and name attributes
        if (!passwordField) {
            passwordField = document.querySelector('input[type="password"][name="vsphere_password"]');
        }
        
        // Strategy 4: Any password field as a last resort
        if (!passwordField) {
            passwordField = document.querySelector('input[type="password"]');
        }
        
        // Get password value if field was found
        if (passwordField) {
            vspherePassword = passwordField.value || '';
        }
        
        let server = '';
        let user = '';

        // Get server and user from global settings
        if (window.globalSettings && window.globalSettings.vsphere) {
            server = window.globalSettings.vsphere.server || '';
            user = window.globalSettings.vsphere.user || '';
        }
        
        // Enhanced logging for troubleshooting
        console.log("Connection info check:", { 
            hasServer: !!server, 
            hasUser: !!user, 
            hasPassword: !!vspherePassword,
            passwordFieldFound: !!passwordField,
            passwordFieldId: passwordField ? passwordField.id : 'not found',
            passwordFieldType: passwordField ? passwordField.type : 'not found',
            globalSettingsFound: !!window.globalSettings,
            globalSettingsComplete: window.globalSettings && 
                                  window.globalSettings.vsphere && 
                                  !!window.globalSettings.vsphere.server && 
                                  !!window.globalSettings.vsphere.user
        });

        // Return null if any required part is missing
        if (!server || !user || !vspherePassword) {
            console.log("Connection info incomplete:", { 
                server: !!server, 
                user: !!user, 
                password: !!vspherePassword,
                serverValue: server ? server.substring(0, 3) + '...' : 'empty',
                userValue: user ? user.substring(0, 3) + '...' : 'empty',
                passwordLength: vspherePassword ? vspherePassword.length : 0
            });
            return null;
        }

        return { server, user, password: vspherePassword };
    }

    // Function to update dropdowns based on available connection info
    function updateInfrastructureDropdowns() {
        console.log("Attempting to update infrastructure dropdowns...");
        
        // Ensure global settings are loaded before proceeding
        if (!window.globalSettings) {
            console.log("Global settings not yet loaded, waiting...");
            setTimeout(updateInfrastructureDropdowns, 500);
            return;
        }
        
        const vsphereSettings = getVSphereConnectionInfo();

        if (vsphereSettings) {
            console.log("Valid connection info found. Fetching real datacenter data...");
            
            // Find and enable password field using the same strategies as in getVSphereConnectionInfo
            let passwordField = document.getElementById('vsphere_password') || 
                              document.querySelector('input[id="vsphere_password"]') ||
                              document.querySelector('input[type="password"][name="vsphere_password"]') ||
                              document.querySelector('input[type="password"]');
                              
            if (passwordField) {
                passwordField.disabled = false;
                passwordField.placeholder = "Enter password for this operation";
            }

            // Use a retry mechanism for fetching datacenters in case of network issues
            const fetchWithRetry = (attempt = 1, maxAttempts = 3) => {
                console.log(`Attempting to fetch datacenters (attempt ${attempt}/${maxAttempts})...`);
                
                fetchInfrastructureComponent('datacenters', null, datacenterSelect, vsphereSettings)
                    .then(success => {
                        if (success) {
                            console.log("Successfully fetched real datacenter data.");
                            // If fetch worked, potentially load children based on workspace
                            if (window.currentWorkspace && window.currentWorkspace.config && window.currentWorkspace.config.datacenter) {
                                if (selectOptionByText(datacenterSelect, window.currentWorkspace.config.datacenter)) {
                                    console.log("Pre-selecting datacenter and loading clusters for workspace:", window.currentWorkspace.config.datacenter);
                                    loadClusters(datacenterSelect.options[datacenterSelect.selectedIndex].text); // Pass name
                                }
                            }
                        } else if (attempt < maxAttempts) {
                            // Retry after a delay
                            console.log(`Fetch attempt ${attempt} failed. Retrying in 1 second...`);
                            setTimeout(() => fetchWithRetry(attempt + 1, maxAttempts), 1000);
                        } else {
                            console.log("All fetch attempts failed for datacenters.");
                            // Reset dropdowns as a last resort
                            resetSelects(true);
                        }
                    })
                    .catch(error => {
                        console.error("Error fetching datacenters:", error);
                        if (attempt < maxAttempts) {
                            console.log(`Fetch attempt ${attempt} failed with error. Retrying in 1 second...`);
                            setTimeout(() => fetchWithRetry(attempt + 1, maxAttempts), 1000);
                        } else {
                            console.log("All fetch attempts failed for datacenters.");
                            resetSelects(true);
                        }
                    });
            };
            
            // Start the fetch with retry process
            fetchWithRetry();
            
        } else {
            // Connection info incomplete, reset and disable dropdowns
            console.log("Connection info incomplete. Resetting and disabling dropdowns.");
            resetSelects(true); // Reset all selects and show placeholder
            
            // Find password field using enhanced method
            let passwordField = document.getElementById('vsphere_password') || 
                              document.querySelector('input[id="vsphere_password"]') ||
                              document.querySelector('input[type="password"][name="vsphere_password"]') ||
                              document.querySelector('input[type="password"]');
            
            // Disable password input if server/user are missing from settings
            if (!window.globalSettings?.vsphere?.server || !window.globalSettings?.vsphere?.user) {
                if (passwordField) {
                    passwordField.disabled = true;
                    passwordField.placeholder = "Enter vSphere Server/User in Settings first";
                    console.log("Password field disabled - missing server/user settings");
                }
            } else {
                if (passwordField) {
                    passwordField.disabled = false;
                    passwordField.placeholder = "Enter password for this operation";
                    console.log("Password field enabled - server/user settings available");
                } else {
                    console.warn("Password field not found in the DOM, cannot update its state");
                }
            }
        }
    }

    // Reset select dropdowns
    function resetSelects(showPlaceholder = false) {
        const selects = [datacenterSelect, clusterSelect, datastoreClusterSelect, networkSelect];
        const placeholders = [
            "Connect to vSphere...",
            "Select Datacenter first",
            "Select Cluster first",
            "Select Cluster first"
        ];

        selects.forEach((select, index) => {
            select.innerHTML = `<option value="">${showPlaceholder ? placeholders[index] : `Select ${select.id.replace('_', ' ')}...`}</option>`;
            select.disabled = true; // Always disable initially
        });

         // Specifically enable datacenter select only if connection is possible
         if (getVSphereConnectionInfo()) {
             datacenterSelect.disabled = false;
             datacenterSelect.innerHTML = '<option value="">Select Datacenter...</option>';
         } else if (showPlaceholder) {
             datacenterSelect.innerHTML = `<option value="">${placeholders[0]}</option>`;
         }
    }


    // Helper function to fetch infrastructure components from API with datacenter context
    // Takes vsphereSettings directly to avoid calling getVSphereConnectionInfo multiple times
    async function fetchInfrastructureComponentWithDatacenter(component, parent, selectElement, vsphereSettings, datacenterContext) {
        // Guard clause: Ensure we have connection settings before proceeding
        if (!vsphereSettings) {
            console.error(`Cannot fetch ${component}: Missing vSphere connection settings.`);
            selectElement.innerHTML = '<option value="">Connection Error</option>';
            selectElement.disabled = true;
            return false; // Indicate failure
        }

        try {
            // Show loading state
            selectElement.innerHTML = '<option value="">Loading...</option>';
            selectElement.disabled = true; // Disable while loading

            console.log(`Fetching ${component} with parent: ${parent || 'none'}, datacenter context: ${datacenterContext || 'none'}`);

            // Make API call to fetch infrastructure components with a timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            const response = await fetch('/api/vsphere-infra/components', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    vsphereServer: vsphereSettings.server,
                    vsphereUser: vsphereSettings.user,
                    vspherePassword: vsphereSettings.password, // Send password for this specific request
                    component,
                    parent, // parent will be the name (e.g., datacenter name, cluster name)
                    datacenterContext // Add datacenter context for proper filtering
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            // Check if the response is ok (status code 200-299)
            if (!response.ok) {
                // Try to get error details from the response body
                let errorMsg = `HTTP error ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorData.error || errorMsg;
                } catch (e) { /* Ignore parsing error */ }
                console.error(`Error fetching ${component}: ${errorMsg}`);
                selectElement.innerHTML = `<option value="">API Error</option>`;
                selectElement.disabled = true;
                return false; // Indicate failure
            }

            const data = await response.json();

            if (data.success && data.data && data.data.length > 0) {
                console.log(`Successfully fetched ${data.data.length} ${component}.`);
                populateSelect(selectElement, data.data); // Populates and enables the select
                return true; // Indicate success
            } else if (data.success && data.data && data.data.length === 0) {
                 console.log(`Successfully fetched ${component}, but no items found.`);
                 selectElement.innerHTML = '<option value="">No items found</option>';
                 selectElement.disabled = true; // Disable if empty
                 return true; // Still a successful API call, just no data
            }
            else {
                // Handle cases where data.success is false or data.data is missing
                const errorDetail = data.message || 'Unknown API error structure';
                console.error(`API Error fetching ${component}: ${errorDetail}`);
                selectElement.innerHTML = `<option value="">API Error</option>`;
                selectElement.disabled = true;
                return false; // Indicate failure
            }
        } catch (error) {
            console.error(`Network or other error fetching ${component}:`, error);
            selectElement.innerHTML = '<option value="">Fetch Error</option>';
            selectElement.disabled = true;
            return false; // Indicate failure
        }
    }

    // Helper function to fetch infrastructure components from API
    // Takes vsphereSettings directly to avoid calling getVSphereConnectionInfo multiple times
    async function fetchInfrastructureComponent(component, parent, selectElement, vsphereSettings) {
        // Guard clause: Ensure we have connection settings before proceeding
        if (!vsphereSettings) {
            console.error(`Cannot fetch ${component}: Missing vSphere connection settings.`);
            selectElement.innerHTML = '<option value="">Connection Error</option>';
            selectElement.disabled = true;
            return false; // Indicate failure
        }

        try {
            // Show loading state
            selectElement.innerHTML = '<option value="">Loading...</option>';
            selectElement.disabled = true; // Disable while loading

            console.log(`Fetching ${component} with parent: ${parent || 'none'}`);

            // Make API call to fetch infrastructure components with a timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            const response = await fetch('/api/vsphere-infra/components', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    vsphereServer: vsphereSettings.server,
                    vsphereUser: vsphereSettings.user,
                    vspherePassword: vsphereSettings.password, // Send password for this specific request
                    component,
                    parent // parent will be the name (e.g., datacenter name, cluster name)
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            // Check if the response is ok (status code 200-299)
            if (!response.ok) {
                // Try to get error details from the response body
                let errorMsg = `HTTP error ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorData.error || errorMsg;
                } catch (e) { /* Ignore parsing error */ }
                console.error(`Error fetching ${component}: ${errorMsg}`);
                selectElement.innerHTML = `<option value="">API Error</option>`;
                selectElement.disabled = true;
                return false; // Indicate failure
            }

            const data = await response.json();

            if (data.success && data.data && data.data.length > 0) {
                console.log(`Successfully fetched ${data.data.length} ${component}.`);
                populateSelect(selectElement, data.data); // Populates and enables the select
                return true; // Indicate success
            } else if (data.success && data.data && data.data.length === 0) {
                 console.log(`Successfully fetched ${component}, but no items found.`);
                 selectElement.innerHTML = '<option value="">No items found</option>';
                 selectElement.disabled = true; // Disable if empty
                 return true; // Still a successful API call, just no data
            }
            else {
                // Handle cases where data.success is false or data.data is missing
                const errorDetail = data.message || 'Unknown API error structure';
                console.error(`API Error fetching ${component}: ${errorDetail}`);
                selectElement.innerHTML = `<option value="">API Error</option>`;
                selectElement.disabled = true;
                return false; // Indicate failure
            }
        } catch (error) {
            console.error(`Network or other error fetching ${component}:`, error);
            selectElement.innerHTML = '<option value="">Fetch Error</option>';
            selectElement.disabled = true;
            return false; // Indicate failure
        }
    }

    // Helper function to populate a select element with options
    function populateSelect(selectElement, data) {
        // Clear existing options
        selectElement.innerHTML = `<option value="">Select ${selectElement.id.replace('_', ' ')}...</option>`; // More specific placeholder

        // Add new options
        data.forEach(item => {
            const option = document.createElement('option');
            // Use the NAME as the value, as this is what the API expects for subsequent 'parent' filters
            option.value = item.name;
            option.textContent = item.name;
            option.dataset.id = item.id; // Store ID as data attribute if needed later
            selectElement.appendChild(option);
        });

        // Enable the select element ONLY if it has more than the placeholder option
        selectElement.disabled = selectElement.options.length <= 1;
        if (selectElement.options.length <=1) {
             selectElement.innerHTML = '<option value="">No items found</option>';
        }
    }

    // Remove demo data functions
    // function populateSelectWithDemoData(...) {} // REMOVED
    // function getDemoDataForComponent(...) {} // REMOVED


    // --- Initialization ---

    // 1. Initial setup on DOMContentLoaded: Reset selects to disabled/placeholder state
    console.log("Initial setup: Resetting dropdowns.");
    resetSelects(true); // Show "Connect to vSphere..." initially

    // 2. Add listener for settings loaded
    document.addEventListener('settingsLoaded', function() {
        console.log('Global settings loaded event received.');
        // Add small delay to ensure settings are fully loaded and available
        setTimeout(() => {
            console.log('Attempting dropdown update after settings loaded...');
            updateInfrastructureDropdowns(); // Attempt to load real data
        }, 100);
    });
    
    // Also try to initialize if global settings are already available
    if (window.globalSettings && window.globalSettings.vsphere) {
        console.log('Global settings already available, updating dropdowns...');
        updateInfrastructureDropdowns();
    }

    // 3. Add listener for password input change (required for API calls)
    const passwordInput = document.getElementById('vsphere_password');
    if (passwordInput) {
        // Use 'input' for immediate feedback, or 'change' if less frequent updates are okay
        passwordInput.addEventListener('input', function() {
            // Debounce this if necessary, but likely fine for password field
            console.log('Password input changed.');
            updateInfrastructureDropdowns(); // Re-evaluate connection and attempt fetch
        });
    }

    // 4. Set initialLoad flag after a delay
    setTimeout(() => {
        console.log("Initial load period finished.");
        initialLoad = false;
    }, 1500); // Delay to allow initial population/selection attempts


    // --- Event Listeners for Dropdown Changes ---

    // Event listener for datacenter selection
    datacenterSelect.addEventListener('change', function() {
        // Reset children selects first
        clusterSelect.innerHTML = '<option value="">Select Cluster...</option>'; clusterSelect.disabled = true;
        datastoreClusterSelect.innerHTML = '<option value="">Select Datastore Cluster...</option>'; datastoreClusterSelect.disabled = true;
        networkSelect.innerHTML = '<option value="">Select Network...</option>'; networkSelect.disabled = true;

        if (this.value) { // Check if a valid datacenter is selected (not the placeholder)
            const datacenterName = this.value; // Value is the name now
            console.log("Datacenter changed, loading clusters for:", datacenterName);
            loadClusters(datacenterName);
        }
        if (!initialLoad && typeof generateTfvars === 'function') {
            generateTfvars();
        }
    });

    // Event listener for cluster selection
    clusterSelect.addEventListener('change', function() {
        // Reset children selects
        datastoreClusterSelect.innerHTML = '<option value="">Select Datastore Cluster...</option>'; datastoreClusterSelect.disabled = true;
        networkSelect.innerHTML = '<option value="">Select Network...</option>'; networkSelect.disabled = true;

        if (this.value) { // Check if a valid cluster is selected
            const clusterName = this.value; // Value is the name
            console.log("Cluster changed, loading datastores and networks for:", clusterName);
            loadDatastoreClusters(clusterName);
            loadNetworks(clusterName);
        }
        if (!initialLoad && typeof generateTfvars === 'function') {
            generateTfvars();
        }
    });

     // Event listeners for remaining select changes (Datastore Cluster, Network)
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


    // --- Load Functions for Dependent Dropdowns ---

    // Load clusters for selected datacenter
    function loadClusters(datacenterName) {
        const vsphereSettings = getVSphereConnectionInfo();
        if (!vsphereSettings) return; // Don't proceed if connection is lost

        // No need to disable clusterSelect here, fetchInfrastructureComponent handles it
        fetchInfrastructureComponent('clusters', datacenterName, clusterSelect, vsphereSettings)
            .then(success => {
                if (success && window.currentWorkspace?.config?.cluster) {
                    if(selectOptionByText(clusterSelect, window.currentWorkspace.config.cluster)) {
                         console.log("Pre-selecting cluster and loading children for workspace:", window.currentWorkspace.config.cluster);
                         // If cluster is selected (either by user or pre-selection), load its children
                         if (clusterSelect.value) {
                             loadDatastoreClusters(clusterSelect.value); // Pass name
                             loadNetworks(clusterSelect.value);       // Pass name
                         }
                    }
                } else if (!success) {
                    // Reset children if cluster load failed
                    datastoreClusterSelect.innerHTML = '<option value="">Select Datastore Cluster...</option>'; datastoreClusterSelect.disabled = true;
                    networkSelect.innerHTML = '<option value="">Select Network...</option>'; networkSelect.disabled = true;
                }
            });
    }

    // Load datastore clusters for selected cluster
    function loadDatastoreClusters(clusterName) {
         const vsphereSettings = getVSphereConnectionInfo();
         if (!vsphereSettings) return;
         
         // Get the current datacenter context for proper filtering
         const datacenterName = datacenterSelect.value;
         fetchInfrastructureComponentWithDatacenter('datastoreClusters', clusterName, datastoreClusterSelect, vsphereSettings, datacenterName)
             .then(success => {
                 if (success && window.currentWorkspace?.config?.datastore_cluster) {
                     selectOptionByText(datastoreClusterSelect, window.currentWorkspace.config.datastore_cluster);
                 }
             });
    }

    // Load networks for selected cluster
    function loadNetworks(clusterName) {
         const vsphereSettings = getVSphereConnectionInfo();
         if (!vsphereSettings) return;
         
         // Get the current datacenter context for proper filtering
         const datacenterName = datacenterSelect.value;
         fetchInfrastructureComponentWithDatacenter('networks', clusterName, networkSelect, vsphereSettings, datacenterName)
             .then(success => {
                 if (success && window.currentWorkspace?.config?.network) {
                     selectOptionByText(networkSelect, window.currentWorkspace.config.network);
                 }
             });
    }

    // Helper function to select an option by text (value is now text/name)
    function selectOptionByText(selectElement, text) {
        for (let i = 0; i < selectElement.options.length; i++) {
            if (selectElement.options[i].value === text) { // Compare against value now
                selectElement.selectedIndex = i;
                // Manually trigger change event if needed for subsequent actions
                // selectElement.dispatchEvent(new Event('change'));
                return true;
            }
        }
        console.warn(`Could not find option with text/value "${text}" in select element ${selectElement.id}`);
        return false;
    }


}); // End DOMContentLoaded
