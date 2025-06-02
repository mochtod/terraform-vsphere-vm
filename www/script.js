// Main JavaScript for Terraform vSphere VM Provisioning Web App

document.addEventListener('DOMContentLoaded', function() {
    // Global variables to track current workspace
    window.currentWorkspace = null;
    window.workspaces = [];
    window.globalSettings = null;
    
    // Check if dark mode is enabled in localStorage
    const darkModeEnabled = localStorage.getItem('darkMode') === 'enabled';
    if (darkModeEnabled) {
        document.body.setAttribute('data-theme', 'dark');
        // Update moon icon to sun when in dark mode
        const themeIcon = document.querySelector('#theme-toggle i');
        if (themeIcon) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
    }
    
    // Load global settings on page load
    function loadGlobalSettings() {
        fetch('/api/settings')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success && data.settings) {
                    window.globalSettings = data.settings;
                    console.log('Global settings loaded:', window.globalSettings);
                    
                    // Dispatch event to notify components that settings are loaded
                    document.dispatchEvent(new Event('settingsLoaded'));
                    
                    // Populate the settings modal with current values if it exists
                    populateSettingsModal();
                } else {
                    console.error('Failed to load global settings:', data.error || 'Unknown error');
                }
            })
            .catch(error => {
                console.error('Error loading global settings:', error);
            });
    }
    
    // Load settings when page loads
    loadGlobalSettings();
    
    // Dark mode toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            // Check current theme
            const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
            
            if (isDarkMode) {
                // Switch to light mode
                document.body.removeAttribute('data-theme');
                localStorage.setItem('darkMode', 'disabled');
            } else {
                // Switch to dark mode
                document.body.setAttribute('data-theme', 'dark');
                localStorage.setItem('darkMode', 'enabled');
            }
            
            // Update icon
            const themeIcon = themeToggle.querySelector('i');
            if (!isDarkMode) {
                // Switching to dark mode - show sun
                themeIcon.classList.remove('fa-moon');
                themeIcon.classList.add('fa-sun');
            } else {
                // Switching to light mode - show moon
                themeIcon.classList.remove('fa-sun');
                themeIcon.classList.add('fa-moon');
            }
            
            console.log('Theme toggled:', document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
        });
    }
    
    // Settings Modal Functionality
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsModalBtn = document.getElementById('close-settings-modal');
    const saveSettingsBtn = document.getElementById('save-settings');
    const testConnectionsBtn = document.getElementById('test-connections');
    const openSettingsLink = document.getElementById('open-settings-link');
    
    // Open the settings modal
    function openSettingsModal() {
        settingsModal.style.display = 'block';
        populateSettingsModal();
    }
    
    // Close the settings modal
    function closeSettingsModal() {
        settingsModal.style.display = 'none';
    }
      // Populate the settings modal with current values
    function populateSettingsModal() {
        if (!window.globalSettings) return;
        
        // Populate vSphere settings
        if (window.globalSettings.vsphere) {
            document.getElementById('settings_vsphere_user').value = window.globalSettings.vsphere.user || '';
            document.getElementById('settings_vsphere_server').value = window.globalSettings.vsphere.server || '';
            // Set password field if available (for editing existing credentials)
            if (window.globalSettings.vsphere.password) {
                document.getElementById('settings_vsphere_password').value = window.globalSettings.vsphere.password;
            }
        }
        
        // Populate Netbox settings
        if (window.globalSettings.netbox) {
            document.getElementById('settings_netbox_url').value = window.globalSettings.netbox.url || '';
            document.getElementById('settings_netbox_token').value = window.globalSettings.netbox.token || '';
            document.getElementById('settings_netbox_prefix_id').value = window.globalSettings.netbox.prefix_id || '';
        }
          // Populate AAP settings
        if (window.globalSettings.aap) {
            document.getElementById('settings_aap_api_url').value = window.globalSettings.aap.api_url || '';
            document.getElementById('settings_aap_api_token').value = window.globalSettings.aap.api_token || '';
        }
          // Populate Satellite settings
        if (window.globalSettings.satellite) {
            document.getElementById('settings_satellite_chr_api_server').value = window.globalSettings.satellite.chr_api_server || '';
            document.getElementById('settings_satellite_url').value = window.globalSettings.satellite.url || '';
            document.getElementById('settings_satellite_username').value = window.globalSettings.satellite.username || '';
            // Set password field if available (for editing existing credentials)
            if (window.globalSettings.satellite.password) {
                document.getElementById('settings_satellite_password').value = window.globalSettings.satellite.password;
            }
        }
    }
    
    // Save settings to server
    function saveSettings() {
        // Get values from form
        const vsphereSettings = {
            user: document.getElementById('settings_vsphere_user').value,
            server: document.getElementById('settings_vsphere_server').value,
            password: document.getElementById('settings_vsphere_password').value
        };
        
        const netboxSettings = {
            url: document.getElementById('settings_netbox_url').value,
            token: document.getElementById('settings_netbox_token').value,
            prefix_id: document.getElementById('settings_netbox_prefix_id').value
        };
          const aapSettings = {
            api_url: document.getElementById('settings_aap_api_url').value,
            api_token: document.getElementById('settings_aap_api_token').value
        };
        
        const satelliteSettings = {
            chr_api_server: document.getElementById('settings_satellite_chr_api_server').value,
            url: document.getElementById('settings_satellite_url').value,
            username: document.getElementById('settings_satellite_username').value,
            password: document.getElementById('settings_satellite_password').value
        };
          // Only include non-empty password in the request, but preserve existing if empty
        if (!vsphereSettings.password && window.globalSettings?.vsphere?.password) {
            // If no new password provided, preserve existing password
            vsphereSettings.password = window.globalSettings.vsphere.password;
        } else if (!vsphereSettings.password) {
            // If no password at all, remove the field
            delete vsphereSettings.password;
        }
        
        if (!satelliteSettings.password && window.globalSettings?.satellite?.password) {
            // If no new password provided, preserve existing password
            satelliteSettings.password = window.globalSettings.satellite.password;
        } else if (!satelliteSettings.password) {
            // If no password at all, remove the field
            delete satelliteSettings.password;
        }
        
        // Make API call to save settings
        fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },            body: JSON.stringify({
                vsphere: vsphereSettings,
                netbox: netboxSettings,
                aap: aapSettings,
                satellite: satelliteSettings
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {                // Update global settings
                window.globalSettings = data.settings;
                
                // Notify components that settings are updated
                document.dispatchEvent(new Event('settingsLoaded'));
                document.dispatchEvent(new Event('settingsUpdated'));
                  // Show success message
                showNotification('Settings saved successfully', 'success');
                
                // Clear password fields only if they were actually updated
                if (document.getElementById('settings_vsphere_password').value.trim()) {
                    document.getElementById('settings_vsphere_password').value = '';
                }
                if (document.getElementById('settings_netbox_token').value.trim()) {
                    document.getElementById('settings_netbox_token').value = '';
                }
                if (document.getElementById('settings_aap_api_token').value.trim()) {
                    document.getElementById('settings_aap_api_token').value = '';
                }
                if (document.getElementById('settings_satellite_password').value.trim()) {
                    document.getElementById('settings_satellite_password').value = '';
                }
                
                // Close modal
                closeSettingsModal();
            } else {
                showNotification(`Error saving settings: ${data.error || 'Unknown error'}`, 'error');
            }
        })
        .catch(error => {
            showNotification(`Error saving settings: ${error.message}`, 'error');
        });
    }
    
    // Test connections
    function testConnections() {
        // Show testing notification
        showNotification('Testing connections...', 'default');
        
        // Make API call to test connections
        fetch('/api/vsphere-infra/test-connection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                vsphereServer: document.getElementById('settings_vsphere_server').value,
                vsphereUser: document.getElementById('settings_vsphere_user').value,
                vspherePassword: document.getElementById('settings_vsphere_password').value || 
                                 (window.globalSettings?.vsphere?.password || '')
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Connection test successful!', 'success');
            } else {
                showNotification(`Connection test failed: ${data.error || 'Unknown error'}`, 'error');
            }
        })
        .catch(error => {
            showNotification(`Connection test error: ${error.message}`, 'error');
        });
    }
    
    // Event listeners for settings modal
    if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
    if (closeSettingsModalBtn) closeSettingsModalBtn.addEventListener('click', closeSettingsModal);
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);
    if (testConnectionsBtn) testConnectionsBtn.addEventListener('click', testConnections);
    if (openSettingsLink) openSettingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        openSettingsModal();
    });
    
    // Close modal if clicked outside
    window.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            closeSettingsModal();
        }
    });

    // Tab switching functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    // Add tab switching functionality
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Remove active class from all buttons and panels
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked button and corresponding panel
            btn.classList.add('active');
            document.getElementById(`${tabId}-output`).classList.add('active');
            
            // If the tab is the plan or apply tab, make sure they show updated content
            if (tabId === 'plan' && window.currentWorkspace && window.currentWorkspace.planOutput) {
                document.getElementById('plan-code').textContent = window.currentWorkspace.planOutput;
            }
            
            if (tabId === 'apply' && window.currentWorkspace && window.currentWorkspace.applyOutput) {
                document.getElementById('apply-code').textContent = window.currentWorkspace.applyOutput;
            }
        });
    });

    // VM Workspace Management Modal
    const manageVMsBtn = document.getElementById('manage-vms-btn');
    const vmWorkspaceModal = document.getElementById('vm-workspace-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const newWorkspaceBtn = document.getElementById('new-workspace-btn');
    const workspaceSearch = document.getElementById('workspace-search');
    const workspacesList = document.getElementById('workspaces-list');
    
    // Load saved workspace from localStorage if available
    const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
    if (savedWorkspaceId) {
        console.log('Found saved workspace ID:', savedWorkspaceId);
        // Try to load the workspace
        selectWorkspace(savedWorkspaceId);
    } else {
        console.log('No saved workspace found');
    }

    // Open the workspace modal
    manageVMsBtn.addEventListener('click', () => {
        vmWorkspaceModal.style.display = 'block';
        loadWorkspaces();
    });

    // Close the workspace modal
    closeModalBtn.addEventListener('click', () => {
        vmWorkspaceModal.style.display = 'none';
    });

    // Close modal if clicked outside
    window.addEventListener('click', (event) => {
        if (event.target === vmWorkspaceModal) {
            vmWorkspaceModal.style.display = 'none';
        }
    });

    // Create new workspace
    newWorkspaceBtn.addEventListener('click', createNewWorkspace);

    // Filter workspaces when searching
    workspaceSearch.addEventListener('input', filterWorkspaces);

    // Function to load all VM workspaces
    function loadWorkspaces() {
        workspacesList.innerHTML = '<p>Loading workspaces...</p>';
        
        fetch('/api/workspaces')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                window.workspaces = data.workspaces;
                displayWorkspaces(window.workspaces);
            })
            .catch(error => {
                workspacesList.innerHTML = `<p class="error-message">Error loading workspaces: ${error.message}</p>`;
            });
    }

    // Function to display workspaces in the list
    function displayWorkspaces(workspaces) {
        if (!workspaces || workspaces.length === 0) {
            workspacesList.innerHTML = '<p>No workspaces found. Create a new one to get started.</p>';
            return;
        }

        const workspaceItems = workspaces.map(workspace => {
            const isActive = window.currentWorkspace && window.currentWorkspace.id === workspace.id;
            
            return `
                <div class="workspace-item ${isActive ? 'active' : ''}" data-id="${workspace.id}">
                    <div class="workspace-info">
                        <div class="workspace-name">${workspace.name}</div>
                        <div class="workspace-created">Created: ${new Date(workspace.createdAt).toLocaleString()}</div>
                    </div>
                    <div class="workspace-actions">
                        <button class="select-workspace btn btn-secondary" data-id="${workspace.id}">
                            <i class="fas fa-check-circle"></i> Select
                        </button>
                        <button class="delete-workspace btn btn-danger" data-id="${workspace.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        workspacesList.innerHTML = workspaceItems.join('');

        // Add event listeners to the workspace items
        document.querySelectorAll('.select-workspace').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const workspaceId = e.target.closest('.select-workspace').getAttribute('data-id');
                selectWorkspace(workspaceId);
            });
        });

        document.querySelectorAll('.delete-workspace').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const workspaceId = e.target.closest('.delete-workspace').getAttribute('data-id');
                deleteWorkspace(workspaceId);
            });
        });
    }

    // Function to filter workspaces by search term
    function filterWorkspaces() {
        const searchTerm = workspaceSearch.value.toLowerCase();
        
        const filteredWorkspaces = window.workspaces.filter(workspace => 
            workspace.name.toLowerCase().includes(searchTerm) || 
            workspace.id.toLowerCase().includes(searchTerm)
        );
        
        displayWorkspaces(filteredWorkspaces);
    }    
    
    // Function to create a new workspace
    function createNewWorkspace() {
        const vmName = prompt('Enter a name for the new VM:');
        
        if (!vmName) return;
        
        fetch('/api/workspaces/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: vmName })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Add the new workspace to the list and select it
                loadWorkspaces();
                selectWorkspace(data.workspace.id);
                
                // Set the VM name in the form to match the workspace name
                document.getElementById('vm_name').value = vmName;
                
                // Save the initial config with the VM name
                saveWorkspaceConfig();
                
                // Show success message
                showNotification(`Created new VM workspace: ${vmName}`, 'success');
            } else {
                alert(`Error creating workspace: ${data.error}`);
            }
        })
        .catch(error => {
            alert(`Error creating workspace: ${error.message}`);
        });
    }

    // Function to select a workspace
    function selectWorkspace(workspaceId) {
        fetch(`/api/workspaces/${workspaceId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Store workspace data in a global variable
                    window.currentWorkspace = data.workspace;
                    
                    // Save workspace ID to local storage for persistence between page loads
                    localStorage.setItem('currentWorkspaceId', workspaceId);
                    
                    // Close the modal
                    vmWorkspaceModal.style.display = 'none';
                    
                    // Update form with workspace data
                    loadWorkspaceData(data.workspace);
                    
                    // Update the page title to show the workspace name
                    document.title = `VM Provisioning - ${data.workspace.name}`;
                    
                    // Show a notification
                    showNotification(`Switched to workspace: ${data.workspace.name}`, 'success');
                    
                    console.log('Current workspace set to:', workspaceId);
                } else {
                    showNotification(`Error selecting workspace: ${data.error}`, 'error');
                }
            })
            .catch(error => {
                showNotification(`Error selecting workspace: ${error.message}`, 'error');
            });
    }

    // Function to delete a workspace
    function deleteWorkspace(workspaceId) {
        if (!confirm('Are you sure you want to delete this workspace? This will not destroy the VM if it has been created.')) {
            return;
        }
        
        fetch(`/api/workspaces/${workspaceId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // If the deleted workspace was the current one, reset the UI
                if (window.currentWorkspace && window.currentWorkspace.id === workspaceId) {
                    window.currentWorkspace = null;
                    resetForm();
                    document.title = 'Terraform vSphere VM Provisioning';
                }
                
                // Reload the workspaces list
                loadWorkspaces();
                
                // Show a notification
                showNotification('Workspace deleted successfully');
            } else {
                alert(`Error deleting workspace: ${data.error}`);
            }
        })
        .catch(error => {
            alert(`Error deleting workspace: ${error.message}`);
        });
    }    
      // Function to load workspace data into the form
    function loadWorkspaceData(workspace) {
        if (!workspace.config) return;
        
        // Fill form fields with workspace data
        for (const [key, value] of Object.entries(workspace.config)) {
            const field = document.getElementById(key);
            if (field) {
                field.value = value;
            }
        }
        
        // Auto-populate VM name with workspace name
        const vmNameField = document.getElementById('vm_name');
        if (vmNameField && workspace.name) {
            vmNameField.value = workspace.name;
            
            // If we have a config object but no vm_name set yet, add it
            if (workspace.config && !workspace.config.vm_name) {
                workspace.config.vm_name = workspace.name;
            }
        }
        
        // Generate tfvars display with workspace data
        generateTfvars();
        
        // Load saved tfvars if available
        if (workspace.savedTfvars) {
            document.getElementById('tfvars-code').textContent = workspace.savedTfvars;
            console.log('Loaded saved tfvars from workspace');
        } else {
            // Generate fresh tfvars from current form data
            document.getElementById('tfvars-code').textContent = generateTfvars();
            console.log('Generated fresh tfvars for workspace');
        }
        
        // Update plan tab if workspace has plan output
        if (workspace.planOutput) {
            document.getElementById('plan-code').textContent = workspace.planOutput;
            
            // Enable the plan tab
            document.querySelector('[data-tab="plan"]').classList.remove('disabled');
        } else {
            document.getElementById('plan-code').textContent = '// No plan has been generated for this workspace yet.\n// Click "Generate Plan" to create a plan.';
        }
        
        // Update apply tab if workspace has apply output
        if (workspace.applyOutput) {
            document.getElementById('apply-code').textContent = workspace.applyOutput;
            
            // Enable the apply tab
            document.querySelector('[data-tab="apply"]').classList.remove('disabled');
        } else {
            document.getElementById('apply-code').textContent = '// No apply has been executed for this workspace yet.\n// Generate a plan first, then click "Apply Changes" to provision the VM.';
        }
        
        // Update status in the UI
        updateWorkspaceStatus(workspace);
        
        console.log('Workspace data loaded successfully');
    }
    
    // Function to update the workspace status in the UI
    function updateWorkspaceStatus(workspace) {
        // Add a status indicator next to the workspace name in the header
        const headerTitle = document.querySelector('header h1');
        
        // Remove any existing status indicator
        const existingStatus = document.getElementById('workspace-status-indicator');
        if (existingStatus) {
            existingStatus.remove();
        }
        
        if (workspace && workspace.status) {
            // Create status indicator
            const statusIndicator = document.createElement('span');
            statusIndicator.id = 'workspace-status-indicator';
            statusIndicator.className = `status-badge status-${workspace.status.toLowerCase()}`;
            statusIndicator.textContent = workspace.status;
            
            // Add it after the header title
            headerTitle.parentNode.insertBefore(statusIndicator, headerTitle.nextSibling);
        }
    }

    // Function to reset the form to default values
    function resetForm() {
        document.getElementById('vm-form').reset();
        document.getElementById('tfvars-code').textContent = '// Generated tfvars will appear here';
        document.getElementById('plan-code').textContent = '// Terraform plan output will appear here';
        document.getElementById('apply-code').textContent = '// Terraform apply output will appear here';
    }

    // Function to show a notification
    function showNotification(message, type = 'default') {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = 'notification';
            document.body.appendChild(notification);
        }
        
        // Remove any existing notification type classes
        notification.classList.remove('success', 'warning', 'error');
        
        // Add the appropriate type class if specified
        if (type !== 'default' && ['success', 'warning', 'error'].includes(type)) {
            notification.classList.add(type);
        }
        
        // Set message and show notification
        notification.textContent = message;
        notification.classList.add('show');
        
        // Hide notification after a few seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
        
        // Also log to console for debugging
        console.log(`Notification (${type}):`, message);
    }

    // Generate tfvars file from form input
    function generateTfvars() {
        const form = document.getElementById('vm-form');
        const formData = new FormData(form);
        
        let tfvarsContent = `# Generated Terraform variables file\n`;
        tfvarsContent += `# ${new Date().toISOString().split('T')[0]}\n\n`;
        
        // Add all form fields except password
        for (const [key, value] of formData.entries()) {
            if (key !== 'vsphere_password') {
                tfvarsContent += `${key} = "${value}"\n`;
            }
        }
        
        // Add password comment
        tfvarsContent += `# vsphere_password should be set as an environment variable TF_VAR_vsphere_password for security\n`;
        
        // Display in the output area
        document.getElementById('tfvars-code').textContent = tfvarsContent;
        
        // If we have a current workspace, save the form data
        if (window.currentWorkspace) {
            saveWorkspaceConfig();
        }
        
        return tfvarsContent;
    }    // Function to save current form data to the workspace
    function saveWorkspaceConfig() {
        if (!window.currentWorkspace) return;
        
        const form = document.getElementById('vm-form');
        const formData = new FormData(form);
        const config = {};
        
        // Convert form data to object (excluding password)
        for (const [key, value] of formData.entries()) {
            if (key !== 'vsphere_password') {
                config[key] = value;
            }
        }
        
        // Generate and save current tfvars
        const currentTfvars = generateTfvars();
        
        // Save to the server with both config and tfvars
        fetch(`/api/workspaces/${window.currentWorkspace.id}/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                config,
                savedTfvars: currentTfvars
            })
        })
        .then(response => {
            if (!response.ok) {
                console.error('Error saving workspace config:', response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Update the current workspace with the saved data
                window.currentWorkspace.config = config;
                window.currentWorkspace.savedTfvars = currentTfvars;
                console.log('Workspace config and tfvars saved successfully');
            } else {
                console.error('Error saving workspace config:', data.error);
            }
        })
        .catch(error => {
            console.error('Error saving workspace config:', error);
        });
    }

    // Update tfvars display when any form field changes
    const formInputs = document.querySelectorAll('#vm-form input, #vm-form select');
    formInputs.forEach(input => {
        input.addEventListener('change', generateTfvars);
    });

    // Generate tfvars on page load
    generateTfvars();
    
    // Handle the "Refresh VM Status" button click
    document.getElementById('refresh-vms-btn').addEventListener('click', function() {
        const deployedVmsList = document.getElementById('deployed-vms-list');
        
        // Show loading state
        deployedVmsList.innerHTML = '<p>Loading deployed VMs from vSphere...</p>';
        
        // Get vSphere credentials from global settings
        if (!window.globalSettings || !window.globalSettings.vsphere) {
            deployedVmsList.innerHTML = '<p class="error-message">vSphere connection settings not found. Please check global settings.</p>';
            return;
        }
        
        const vsphereServer = window.globalSettings.vsphere.server;
        const vsphereUser = window.globalSettings.vsphere.user;
        const vspherePassword = window.globalSettings.vsphere.password;
        
        if (!vsphereServer || !vsphereUser || !vspherePassword) {
            deployedVmsList.innerHTML = '<p class="error-message">Incomplete vSphere credentials in global settings. Please update settings.</p>';
            return;
        }
        
        // Call the backend API to get VM status
        fetch('/api/vsphere/vms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                vsphereServer,
                vsphereUser,
                vspherePassword
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                displayVMsList(data.vms);
            } else {
                deployedVmsList.innerHTML = `<p class="error-message">Error fetching VMs: ${data.error}</p>`;
            }
        })
        .catch(error => {
            deployedVmsList.innerHTML = `<p class="error-message">Error connecting to backend: ${error.message}</p>`;
        });
    });
    
    // Function to display the VMs list
    function displayVMsList(vms) {
        const deployedVmsList = document.getElementById('deployed-vms-list');
        
        if (!vms || vms.length === 0) {
            deployedVmsList.innerHTML = '<p>No VMs found in vSphere.</p>';
            return;
        }
        
        const vmItems = vms.map(vm => {
            return `
                <div class="vm-item">
                    <div class="vm-info">
                        <div class="vm-name">${vm.name}</div>
                        <div class="vm-details">
                            <span>CPU: ${vm.numCpu} cores</span>
                            <span>Memory: ${Math.round(vm.memorySizeMB / 1024)} GB</span>
                            <span>Guest OS: ${vm.guestFullName || 'Unknown'}</span>
                        </div>
                    </div>
                    <div class="vm-status ${vm.powerState.toLowerCase()}">${vm.powerState}</div>
                </div>
            `;
        });
        
        deployedVmsList.innerHTML = vmItems.join('');
    }
    
    // Handle the Plan button click
    document.getElementById('plan-button').addEventListener('click', function() {
        // Check if a workspace is selected
        if (!window.currentWorkspace) {
            alert('Please select or create a VM workspace first');
            return;
        }

        const planOutput = document.getElementById('plan-code');
        
        // Show loading state
        planOutput.textContent = "Running terraform plan...\nConnecting to backend and executing plan command...\n";
        
        // Show the plan tab
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        document.querySelector('[data-tab="plan"]').classList.add('active');
        document.getElementById('plan-output').classList.add('active');
        
        // Get form data
        const form = document.getElementById('vm-form');
        const formData = new FormData(form);
        const vmVars = {};
        
        // Get vSphere password from global settings
        let vspherePassword = '';
        if (window.globalSettings && window.globalSettings.vsphere) {
            vspherePassword = window.globalSettings.vsphere.password || '';
        }
        
        console.log('Password found:', vspherePassword ? 'Yes (not shown for security)' : 'No');
        
        if (!vspherePassword) {
            planOutput.textContent = "Error: vSphere password is not set in global settings. Please update settings.";
            showNotification("vSphere password is required in global settings", "error");
            return;
        }
        
        for (const [key, value] of formData.entries()) {
            if (key !== 'vsphere_password') {
                vmVars[key] = value;
            }
        }
        
        // Call the backend API to generate plan
        fetch('/api/terraform/plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                vmVars,
                vspherePassword,
                workspaceId: window.currentWorkspace.id
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Store the plan path and run directory for later use
                window.currentWorkspace.planPath = data.planPath;
                window.currentWorkspace.runDir = data.runDir;
                
                // Display the plan output
                planOutput.textContent = data.planOutput;
                
                // Add a note about applying the plan
                planOutput.textContent += "\n\nPlan generated successfully!\nClick 'Apply Changes' to provision this VM.";
                
                // Store the plan output in the workspace
                window.currentWorkspace.planOutput = data.planOutput;
                
                // Save plan details to workspace
                updateWorkspacePlanData(window.currentWorkspace.id, data);
            } else {
                planOutput.textContent = "Error generating plan:\n\n" + data.error;
            }
        })
        .catch(error => {
            planOutput.textContent = "Error connecting to backend:\n\n" + error.message;
        });
    });    
    
    // Function to update workspace plan data
    function updateWorkspacePlanData(workspaceId, planData) {
        fetch(`/api/workspaces/${workspaceId}/plan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                planPath: planData.planPath,
                runDir: planData.runDir,
                planOutput: planData.planOutput
            })
        })
        .then(response => {
            if (!response.ok) {
                console.error('Error saving plan data:', response.statusText);
            }
        })
        .catch(error => {
            console.error('Error saving plan data:', error);
        });
    }

    // Handle the Apply button click
    document.getElementById('apply-button').addEventListener('click', function() {
        // Check if a workspace is selected
        if (!window.currentWorkspace) {
            alert('Please select or create a VM workspace first');
            return;
        }
        
        const applyOutput = document.getElementById('apply-code');
        
        // Show loading state
        applyOutput.textContent = "Running terraform apply...\nConnecting to backend and executing apply command...\n";
        
        // Show the apply tab
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        document.querySelector('[data-tab="apply"]').classList.add('active');
        document.getElementById('apply-output').classList.add('active');
        
        // Check if we have a plan path from the previous plan operation
        if (!window.currentWorkspace.planPath) {
            applyOutput.textContent = "Error: No terraform plan found. Please generate a plan first.";
            return;
        }
        
        // Get vSphere password from global settings
        let vspherePassword = '';
        if (window.globalSettings && window.globalSettings.vsphere) {
            vspherePassword = window.globalSettings.vsphere.password || '';
        }
        
        if (!vspherePassword) {
            applyOutput.textContent = "Error: vSphere password is not set in global settings. Please update settings.";
            return;
        }
        
        // Call the backend API to apply plan
        fetch('/api/terraform/apply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                planPath: window.currentWorkspace.planPath,
                runDir: window.currentWorkspace.runDir,
                vspherePassword,
                workspaceId: window.currentWorkspace.id
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })        .then(data => {
            if (data.success) {
                // Display the apply output
                applyOutput.textContent = data.applyOutput;
                
                // Add information about the VM
                applyOutput.textContent += "\n\nVM provisioned successfully!";
                if (data.vmId) {
                    applyOutput.textContent += `\nVM ID: ${data.vmId}`;
                }
                
                // Store the apply output in the workspace
                window.currentWorkspace.applyOutput = data.applyOutput;
                window.currentWorkspace.vmId = data.vmId;
                window.currentWorkspace.status = 'deployed';
                
                // Save apply details to workspace
                updateWorkspaceApplyData(window.currentWorkspace.id, data);
                
                // Add a link to check VM status
                addDeploymentStatusTracking(window.currentWorkspace.runDir);
                
                // Trigger post-deployment workflow for CHR Satellite integration
                const deploymentEvent = new CustomEvent('deploymentCompleted', {
                    detail: { 
                        workspace: window.currentWorkspace,
                        vmId: data.vmId,
                        deploymentTime: new Date().toISOString()
                    }
                });
                document.dispatchEvent(deploymentEvent);
                
                // Show VM Customization tab after successful deployment
                setTimeout(() => {
                    document.querySelector('[data-tab="vm-customization"]').classList.add('active');
                    document.getElementById('vm-customization-output').classList.add('active');
                    // Remove active class from apply tab
                    document.querySelector('[data-tab="apply"]').classList.remove('active');
                    document.getElementById('apply-output').classList.remove('active');
                }, 2000);
            } else {
                applyOutput.textContent = "Error applying terraform:\n\n" + data.error;
            }
        })
        .catch(error => {
            applyOutput.textContent = "Error connecting to backend:\n\n" + error.message;
        });
    });

    // Function to update workspace apply data
    function updateWorkspaceApplyData(workspaceId, applyData) {
        fetch(`/api/workspaces/${workspaceId}/apply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                applyOutput: applyData.applyOutput,
                vmId: applyData.vmId,
                status: 'deployed'
            })
        })
        .then(response => {
            if (!response.ok) {
                console.error('Error saving apply data:', response.statusText);
            }
        })
        .catch(error => {
            console.error('Error saving apply data:', error);
        });
    }

    // Handle the Download button click
    document.getElementById('download-tfvars').addEventListener('click', function() {
        const tfvarsContent = generateTfvars();
        const vmName = document.getElementById('vm_name').value;
        const fileName = `${vmName}.tfvars`;
        
        // Create a blob and download link
        const blob = new Blob([tfvarsContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    });

    // Function to track deployment status and add deployment management UI
    function addDeploymentStatusTracking(runDir) {
        if (!runDir) return;
        
        // Create a new tab for deployments if it doesn't exist
        if (!document.getElementById('deployments-output')) {
            // Create tab button
            const deploymentTabBtn = document.createElement('button');
            deploymentTabBtn.className = 'tab-btn';
            deploymentTabBtn.setAttribute('data-tab', 'deployments');
            deploymentTabBtn.innerHTML = '<i class="fas fa-server"></i> Deployments';
            
            // Add click handler to the button
            deploymentTabBtn.addEventListener('click', () => {
                // Remove active class from all buttons and panels
                tabBtns.forEach(b => b.classList.remove('active'));
                tabPanels.forEach(p => p.classList.remove('active'));
                
                // Add active class to deployments button and panel
                deploymentTabBtn.classList.add('active');
                document.getElementById('deployments-output').classList.add('active');
                
                // Refresh deployments list
                listDeployments();
            });
            
            // Add the button to the tabs
            const tabsContainer = document.querySelector('.tab-btn-container');
            if (tabsContainer) {
                tabsContainer.appendChild(deploymentTabBtn);
                tabBtns = document.querySelectorAll('.tab-btn'); // Update tabs reference
            }
            
            // Create tab panel
            const deploymentPanel = document.createElement('div');
            deploymentPanel.className = 'tab-panel';
            deploymentPanel.id = 'deployments-output';
            
            deploymentPanel.innerHTML = `
                <div class="code-container">
                    <div class="code-output">
                        <h3>Deployment Status</h3>
                        <div id="deployment-status-list">
                            <p>Loading deployments...</p>
                        </div>
                    </div>
                </div>
            `;
            
            // Add panel to tab content
            const tabContent = document.querySelector('.tab-content');
            if (tabContent) {
                tabContent.appendChild(deploymentPanel);
                tabPanels = document.querySelectorAll('.tab-panel'); // Update panels reference
            }
        }
        
        // Reload deployments list
        listDeployments();
    }
    
    // Function to list deployments
    function listDeployments() {
        const deploymentStatusList = document.getElementById('deployment-status-list');
        if (!deploymentStatusList) return;
        
        deploymentStatusList.innerHTML = '<p>Loading deployments...</p>';
        
        fetch('/api/terraform/deployments')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(deployments => {
                if (!deployments || deployments.length === 0) {
                    deploymentStatusList.innerHTML = '<p>No deployments found.</p>';
                    return;
                }
                
                // Sort deployments by start time, newest first
                deployments.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
                
                const deploymentItems = deployments.map(deployment => {
                    const date = new Date(deployment.startTime);
                    return `
                        <div class="deployment-item status-${deployment.status}">
                            <div class="deployment-info">
                                <div class="deployment-name">${deployment.name}</div>
                                <div class="deployment-time">${date.toLocaleString()}</div>
                            </div>
                            <div class="deployment-status">${deployment.status}</div>
                        </div>
                    `;
                });
                
                deploymentStatusList.innerHTML = deploymentItems.join('');
            })
            .catch(error => {
                deploymentStatusList.innerHTML = `<p class="error-message">Error loading deployments: ${error.message}</p>`;
            });
    }
});
