// VM Templates dropdown functionality for vSphere VM Provisioning
document.addEventListener('DOMContentLoaded', function() {
    // Reference to the VM template select element
    const templateSelect = document.getElementById('vm_template');
    const datacenterSelect = document.getElementById('datacenter');
    const clusterSelect = document.getElementById('cluster');
    const guestIdInput = document.getElementById('vm_guest_id');
    
    // Initial flag to prevent multiple calls on first load
    let initialLoad = true;
      // Initialize templates when datacenter or cluster changes
    datacenterSelect.addEventListener('change', function() {
        if (this.value) {
            loadTemplates();
        }
    });
    
    clusterSelect.addEventListener('change', function() {
        if (this.value) {
            loadTemplates();
        }
    });
      // Function to load VM templates from vSphere
    function loadTemplates() {
        // Get vSphere connection info
        const vsphereSettings = getVSphereConnectionInfo();
        
        if (!vsphereSettings || !vsphereSettings.server || !vsphereSettings.user || !vsphereSettings.password) {
            // Show connection error - no fallback data
            templateSelect.innerHTML = '<option value="">Connection Error - Check vSphere credentials</option>';
            templateSelect.disabled = true;
            return;
        }
        
        // Show loading state
        templateSelect.innerHTML = '<option value="">Loading templates...</option>';
        templateSelect.disabled = true;
        
        // Get datacenter and cluster values
        const datacenter = datacenterSelect.value;
        
        // Call API to fetch templates
        fetch('/api/vsphere/templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                vsphereServer: vsphereSettings.server,
                vsphereUser: vsphereSettings.user,
                vspherePassword: vsphereSettings.password,
                datacenter: datacenter
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })        .then(data => {
            if (data.success && data.templates && data.templates.length > 0) {
                // Populate dropdown with fetched templates
                populateTemplateSelect(data.templates);
                
                // If we have a current workspace with a template selected, try to select it
                if (window.currentWorkspace && window.currentWorkspace.config && window.currentWorkspace.config.vm_template) {
                    selectOptionByText(templateSelect, window.currentWorkspace.config.vm_template);
                    
                    // Update guest ID based on template selection if we have a match
                    const selectedOption = templateSelect.options[templateSelect.selectedIndex];
                    const guestId = selectedOption.dataset.guestId;
                    if (guestId) {
                        guestIdInput.value = guestId;
                    }
                }
                
                // Trigger host group visibility update after template selection
                if (typeof window.updateHostGroupVisibility === 'function') {
                    window.updateHostGroupVisibility();
                }
            } else {
                // No templates found - show appropriate message
                templateSelect.innerHTML = '<option value="">No templates found</option>';
                templateSelect.disabled = true;
            }
        })
        .catch(error => {
            console.error('Error fetching VM templates:', error);
            // Show fetch error - no fallback data
            let errorMessage = 'Fetch Error';
            if (error.message.includes('401') || error.message.includes('403')) {
                errorMessage = 'Authentication Error - Check credentials';
            } else if (error.message.includes('Network')) {
                errorMessage = 'Network Error - Check vSphere server';
            }
            templateSelect.innerHTML = `<option value="">${errorMessage}</option>`;
            templateSelect.disabled = true;
        });
    }
      // Function to populate the template select with options
    function populateTemplateSelect(templates) {
        // Clear existing options
        templateSelect.innerHTML = '<option value="">Select Template</option>';
        
        // Sort templates alphabetically by name
        templates.sort((a, b) => a.name.localeCompare(b.name));
        
        // Add new options
        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.name;
            option.textContent = template.name;
            option.dataset.path = template.path;
            option.dataset.guestId = template.guestId;
            option.dataset.guestFullName = template.guestFullName;
            templateSelect.appendChild(option);
        });
        
        // Enable the select
        templateSelect.disabled = false;
    }
    
    // Helper function to get vSphere connection information (reused from infrastructure-dropdowns.js)
    function getVSphereConnectionInfo() {
        // Get credentials from global settings (consistent with infrastructure dropdowns)
        if (window.globalSettings && window.globalSettings.vsphere) {
            const server = window.globalSettings.vsphere.server || '';
            const user = window.globalSettings.vsphere.user || '';
            const password = window.globalSettings.vsphere.password || '';
            
            // Return null if any required part is missing
            if (!server || !user || !password) {
                console.log("VM Templates - Connection info incomplete in global settings");
                return null;
            }
            
            return { server, user, password };
        }
        
        console.log("VM Templates - No global settings found");
        return null;
    }
    
    // Helper function to select an option by text (reused from infrastructure-dropdowns.js)
    function selectOptionByText(selectElement, text) {
        for (let i = 0; i < selectElement.options.length; i++) {
            if (selectElement.options[i].text === text) {
                selectElement.selectedIndex = i;
                return true;
            }
        }
        return false;
    }
      // Add event listener for template selection change
    templateSelect.addEventListener('change', function() {
        // When a template is selected, update the guest ID field if available
        if (this.value) {
            const selectedOption = this.options[this.selectedIndex];
            const guestId = selectedOption.dataset.guestId;
            if (guestId) {
                guestIdInput.value = guestId;
            }
            
            // Trigger host group visibility update
            if (typeof window.updateHostGroupVisibility === 'function') {
                window.updateHostGroupVisibility();
            }
            
            // Generate tfvars if not initial load
            if (!initialLoad && typeof generateTfvars === 'function') {
                generateTfvars();
            }
        }
    });      // Initialize templates when the page loads
    function initializeTemplates() {
        console.log('Initializing VM templates...');
        
        if (typeof window.globalSettings !== 'undefined' && window.globalSettings.vsphere) {
            console.log('Global settings available, checking if we can load templates...');
            
            // Check if we have a datacenter selected (minimum requirement for templates)
            if (datacenterSelect.value) {
                console.log('Datacenter selected, loading templates...');
                loadTemplates();
            } else {
                console.log('No datacenter selected yet, showing ready state...');
                templateSelect.innerHTML = '<option value="">Select datacenter first</option>';
                templateSelect.disabled = true;
            }
        } else {
            console.log('Global settings not available yet, showing placeholder...');
            templateSelect.innerHTML = '<option value="">Connect to vSphere...</option>';
            templateSelect.disabled = true;
        }
        
        // Set initial load to false after a delay
        setTimeout(() => {
            initialLoad = false;
        }, 1000);
    }
      // Initialize templates when global settings are loaded
    document.addEventListener('settingsLoaded', function() {
        initializeTemplates();
    });
    
    // Refresh templates when settings are updated
    document.addEventListener('settingsUpdated', function() {
        console.log('Settings updated, refreshing templates...');
        setTimeout(() => {
            initializeTemplates();
        }, 500);
    });
      // Listen for infrastructure dropdowns being populated (when datacenter gets selected/populated)
    document.addEventListener('infrastructureUpdated', function() {
        console.log('Infrastructure updated, checking if templates should be loaded...');
        setTimeout(() => {
            if (datacenterSelect.value && window.globalSettings?.vsphere) {
                console.log('Datacenter available after infrastructure update, loading templates...');
                loadTemplates();
            }
        }, 500);
    });
    
    // Listen for workspace changes to restore template selection
    document.addEventListener('workspaceLoaded', function() {
        console.log('Workspace loaded, checking if template should be restored...');
        setTimeout(() => {
            if (window.currentWorkspace?.config?.vm_template && templateSelect.options.length > 1) {
                console.log('Restoring template selection for workspace:', window.currentWorkspace.config.vm_template);
                if (selectOptionByText(templateSelect, window.currentWorkspace.config.vm_template)) {
                    // Update guest ID based on template selection
                    const selectedOption = templateSelect.options[templateSelect.selectedIndex];
                    const guestId = selectedOption.dataset.guestId;
                    if (guestId) {
                        guestIdInput.value = guestId;
                    }
                    
                    // Trigger host group visibility update
                    if (typeof window.updateHostGroupVisibility === 'function') {
                        window.updateHostGroupVisibility();
                    }
                }
            }
        }, 500);
    });
    
    // Try to initialize right away if needed
    if (typeof window.globalSettings !== 'undefined') {
        initializeTemplates();
    } else {
        // Show placeholder initially
        templateSelect.innerHTML = '<option value="">Connect to vSphere...</option>';
        templateSelect.disabled = true;
    }
});
