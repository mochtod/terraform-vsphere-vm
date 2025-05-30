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
        
        if (!vsphereSettings.server || !vsphereSettings.user || !vsphereSettings.password) {
            // If connection details aren't available, use demo values
            populateSelectWithDemoTemplates(templateSelect);
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
        })
        .then(data => {
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
            } else {
                // Fall back to demo data if API call fails or returns no data
                populateSelectWithDemoTemplates(templateSelect);
            }
        })
        .catch(error => {
            console.error('Error fetching VM templates:', error);
            populateSelectWithDemoTemplates(templateSelect);
        })
        .finally(() => {
            templateSelect.disabled = false;
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
    }
    
    // Function to populate with demo template data
    function populateSelectWithDemoTemplates(selectElement) {
        // Clear existing options
        selectElement.innerHTML = '<option value="">Select Template</option>';
        
        // Add demo template options
        const demoTemplates = [
            { name: 'rhel9-template0314', guestId: 'rhel9_64Guest', guestFullName: 'Red Hat Enterprise Linux 9 (64-bit)' },
            { name: 'rhel8-template0215', guestId: 'rhel8_64Guest', guestFullName: 'Red Hat Enterprise Linux 8 (64-bit)' },
            { name: 'win2022-template0420', guestId: 'windows2019srv_64Guest', guestFullName: 'Microsoft Windows Server 2022 (64-bit)' },
            { name: 'ubuntu22-template0401', guestId: 'ubuntu64Guest', guestFullName: 'Ubuntu Linux (64-bit)' }
        ];
        
        demoTemplates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.name;
            option.textContent = template.name;
            option.dataset.guestId = template.guestId;
            option.dataset.guestFullName = template.guestFullName;
            selectElement.appendChild(option);
        });
        
        // Enable the select element
        selectElement.disabled = false;
        
        // If we have a workspace config with a template, try to select it
        if (window.currentWorkspace && window.currentWorkspace.config && window.currentWorkspace.config.vm_template) {
            selectOptionByText(selectElement, window.currentWorkspace.config.vm_template);
        }
        
        return true;
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
            
            // Generate tfvars if not initial load
            if (!initialLoad && typeof generateTfvars === 'function') {
                generateTfvars();
            }
        }
    });
    
    // Initialize templates when the page loads
    function initializeTemplates() {
        // If a datacenter is already selected, load templates
        if (datacenterSelect.value) {
            loadTemplates();
        } else {
            // Otherwise use demo data
            populateSelectWithDemoTemplates(templateSelect);
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
    
    // Try to initialize right away if needed
    if (typeof window.globalSettings !== 'undefined') {
        initializeTemplates();
    } else {
        // Use demo data initially
        populateSelectWithDemoTemplates(templateSelect);
    }
});
