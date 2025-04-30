// Main JavaScript for Terraform vSphere VM Provisioning Web App

document.addEventListener('DOMContentLoaded', function() {
    // Global variables to track current workspace
    window.currentWorkspace = null;
    window.workspaces = [];

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
        const vmName = prompt('Enter a name for the new VM workspace:');
        
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
    }    // Function to load workspace data into the form
    function loadWorkspaceData(workspace) {
        if (!workspace.config) return;
        
        // Fill form fields with workspace data
        for (const [key, value] of Object.entries(workspace.config)) {
            const field = document.getElementById(key);
            if (field) {
                field.value = value;
            }
        }
        
        // Generate tfvars display
        generateTfvars();
        
        // Update tab content with workspace data
        
        // Update tfvars tab
        document.getElementById('tfvars-code').textContent = generateTfvars();
        
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
    }

    // Function to save current form data to the workspace
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
        
        // Save to the server
        fetch(`/api/workspaces/${window.currentWorkspace.id}/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ config })
        })
        .then(response => {
            if (!response.ok) {
                console.error('Error saving workspace config:', response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log('Workspace config saved successfully');
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
    generateTfvars();    // Handle the Plan button click
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
        let vspherePassword = document.getElementById('vsphere_password').value;
        
        console.log('Password found:', vspherePassword ? 'Yes (not shown for security)' : 'No');
        
        if (!vspherePassword) {
            planOutput.textContent = "Error: vSphere password is required to generate a plan.";
            showNotification("vSphere password is required", "error");
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
    });    // Function to update workspace plan data
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
        
        // Get vSphere password
        const vspherePassword = document.getElementById('vsphere_password').value;
        if (!vspherePassword) {
            applyOutput.textContent = "Error: vSphere password is required.";
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
        })
        .then(data => {
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
                
                // Save apply details to workspace
                updateWorkspaceApplyData(window.currentWorkspace.id, data);
                
                // Add a link to check VM status
                addDeploymentStatusTracking(window.currentWorkspace.runDir);
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
                <div class="panel-header">
                    <h2><i class="fas fa-server"></i> VM Deployments</h2>
                    <button id="refresh-deployments" class="btn btn-secondary">
                        <i class="fas fa-sync"></i> Refresh
                    </button>
                </div>
                <div class="deployments-container">
                    <div id="deployments-list" class="deployments-list">
                        <p>Loading deployments...</p>
                    </div>
                    <div id="deployment-details" class="deployment-details">
                        <p>Select a deployment to view details</p>
                    </div>
                </div>
            `;
            
            // Add the panel to the container
            const panelsContainer = document.querySelector('.tab-panels');
            if (panelsContainer) {
                panelsContainer.appendChild(deploymentPanel);
                tabPanels = document.querySelectorAll('.tab-panel'); // Update panels reference
            }
            
            // Add event listener for refresh button
            setTimeout(() => {
                const refreshBtn = document.getElementById('refresh-deployments');
                if (refreshBtn) {
                    refreshBtn.addEventListener('click', listDeployments);
                }
            }, 100);
        }
        
        // Switch to the deployments tab and refresh
        document.querySelector('[data-tab="deployments"]').click();
        
        // Start polling for status updates
        pollDeploymentStatus(runDir);
    }
    
    // Function to poll for status updates
    function pollDeploymentStatus(runDir) {
        if (!runDir) return;
        
        const runDirName = runDir.split('/').pop();
        let pollingInterval;
        
        const checkStatus = () => {
            fetch(`/api/terraform/status/${runDirName}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Update deployment details if selected
                    updateDeploymentDetails(runDirName, data);
                    
                    // If status is completed or failed, stop polling
                    if (data.status === 'completed' || data.status === 'failed' || 
                        data.status === 'destroyed' || data.status === 'destroy_failed') {
                        clearInterval(pollingInterval);
                    }
                })
                .catch(error => {
                    console.error('Error checking deployment status:', error);
                    clearInterval(pollingInterval);
                });
        };
        
        // Check immediately and then set up interval
        checkStatus();
        pollingInterval = setInterval(checkStatus, 5000); // Poll every 5 seconds
    }
    
    // Function to list all deployments
    function listDeployments() {
        const deploymentsList = document.getElementById('deployments-list');
        if (!deploymentsList) return;
        
        deploymentsList.innerHTML = '<p>Loading deployments...</p>';
        
        fetch('/api/terraform/deployments')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(deployments => {
                if (deployments.length === 0) {
                    deploymentsList.innerHTML = '<p>No deployments found.</p>';
                    return;
                }
                
                let html = '<ul class="deployments">';
                deployments.forEach(deployment => {
                    const statusClass = getStatusClass(deployment.status);
                    const date = new Date(deployment.startTime).toLocaleString();
                    
                    html += `
                        <li class="deployment-item" data-id="${deployment.id}">
                            <div class="deployment-info">
                                <span class="deployment-name">${deployment.name}</span>
                                <span class="deployment-status ${statusClass}">${deployment.status}</span>
                                <span class="deployment-time">${date}</span>
                            </div>
                        </li>
                    `;
                });
                html += '</ul>';
                
                deploymentsList.innerHTML = html;
                
                // Add click event listeners to deployment items
                document.querySelectorAll('.deployment-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const deploymentId = item.getAttribute('data-id');
                        getDeploymentDetails(deploymentId);
                        
                        // Highlight selected deployment
                        document.querySelectorAll('.deployment-item').forEach(i => {
                            i.classList.remove('selected');
                        });
                        item.classList.add('selected');
                    });
                });
                
                // Select the first deployment by default
                if (deployments.length > 0) {
                    const firstItem = document.querySelector('.deployment-item');
                    if (firstItem) {
                        firstItem.click();
                    }
                }
            })
            .catch(error => {
                deploymentsList.innerHTML = `<p>Error loading deployments: ${error.message}</p>`;
            });
    }
    
    // Function to get deployment details
    function getDeploymentDetails(deploymentId) {
        if (!deploymentId) return;
        
        const detailsContainer = document.getElementById('deployment-details');
        if (!detailsContainer) return;
        
        detailsContainer.innerHTML = '<p>Loading deployment details...</p>';
        
        fetch(`/api/terraform/status/${deploymentId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                updateDeploymentDetails(deploymentId, data);
            })
            .catch(error => {
                detailsContainer.innerHTML = `<p>Error loading deployment details: ${error.message}</p>`;
            });
    }
    
    // Function to update deployment details
    function updateDeploymentDetails(deploymentId, data) {
        const detailsContainer = document.getElementById('deployment-details');
        if (!detailsContainer) return;
        
        const statusClass = getStatusClass(data.status);
        const startTime = new Date(data.startTime).toLocaleString();
        const endTime = data.endTime ? new Date(data.endTime).toLocaleString() : 'In progress...';
        
        let html = `
            <div class="deployment-header">
                <h3>Deployment: ${deploymentId}</h3>
                <span class="status ${statusClass}">${data.status}</span>
            </div>
            <div class="deployment-time-info">
                <div>Started: ${startTime}</div>
                <div>Completed: ${endTime}</div>
            </div>
        `;
        
        // Add logs section
        html += '<div class="deployment-logs"><h4>Logs</h4><ul>';
        if (data.logs && data.logs.length > 0) {
            data.logs.forEach(log => {
                const logTime = new Date(log.time).toLocaleString();
                html += `
                    <li class="log-entry">
                        <span class="log-time">${logTime}</span>
                        <span class="log-message">${log.message}</span>
                        ${log.error ? `<span class="log-error">${log.error}</span>` : ''}
                    </li>
                `;
            });
        } else {
            html += '<li>No logs available</li>';
        }
        html += '</ul></div>';
        
        // Add output section if available
        if (data.output) {
            html += `
                <div class="deployment-output">
                    <h4>Output</h4>
                    <pre>${data.output}</pre>
                </div>
            `;
        }
        
        // Add action buttons based on status
        html += '<div class="deployment-actions">';
        
        if (data.status === 'completed') {
            html += `
                <button class="btn btn-danger destroy-vm" data-id="${deploymentId}">
                    <i class="fas fa-trash"></i> Destroy VM
                </button>
            `;
        } else if (data.status === 'failed') {
            html += `
                <button class="btn btn-primary retry-deployment" data-id="${deploymentId}">
                    <i class="fas fa-redo"></i> Retry Deployment
                </button>
            `;
        }
        
        html += '</div>';
        
        detailsContainer.innerHTML = html;
        
        // Add event listeners to action buttons
        setTimeout(() => {
            const destroyBtn = detailsContainer.querySelector('.destroy-vm');
            if (destroyBtn) {
                destroyBtn.addEventListener('click', () => {
                    if (confirm('Are you sure you want to destroy this VM? This action cannot be undone.')) {
                        destroyVM(deploymentId);
                    }
                });
            }
            
            const retryBtn = detailsContainer.querySelector('.retry-deployment');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    retryDeployment(deploymentId);
                });
            }
        }, 100);
    }
    
    // Function to destroy a VM
    function destroyVM(deploymentId) {
        if (!deploymentId) return;
        
        const detailsContainer = document.getElementById('deployment-details');
        if (!detailsContainer) return;
        
        // Show destroying status
        detailsContainer.innerHTML = '<p>Destroying VM... This may take several minutes.</p>';
        
        // Get vSphere password
        const vspherePassword = document.getElementById('vsphere_password').value;
        if (!vspherePassword) {
            detailsContainer.innerHTML = '<p>Error: vSphere password is required to destroy the VM.</p>';
            return;
        }
        
        // Call API to destroy VM
        fetch('/api/terraform/destroy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                runDir: deploymentId,
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
                detailsContainer.innerHTML = '<p>VM destroy operation started. Refreshing status...</p>';
                
                // Start polling for status updates
                pollDeploymentStatus(deploymentId);
                
                // Refresh deployments list after a short delay
                setTimeout(listDeployments, 2000);
            } else {
                detailsContainer.innerHTML = `<p>Error destroying VM: ${data.message}</p>`;
            }
        })
        .catch(error => {
            detailsContainer.innerHTML = `<p>Error: ${error.message}</p>`;
        });
    }
    
    // Function to retry a failed deployment
    function retryDeployment(deploymentId) {
        // Implementation would depend on how you want to handle retries
        // This could involve re-running the plan with the same parameters
        alert('Retry functionality not implemented yet');
    }
    
    // Helper function to get CSS class based on status
    function getStatusClass(status) {
        switch (status) {
            case 'running':
            case 'destroying':
                return 'status-running';
            case 'completed':
                return 'status-success';
            case 'destroyed':
                return 'status-destroyed';
            case 'failed':
            case 'destroy_failed':
                return 'status-error';
            default:
                return '';
        }
    }
    
    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    const themeIcon = themeToggle.querySelector('i');
    
    // Check for saved theme preference or use system preference
    const getCurrentTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        
        if (savedTheme) {
            return savedTheme;
        }
        
        // Use system preference as fallback
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };
    
    // Apply theme based on current setting
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            html.removeAttribute('data-theme');
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    };
    
    // Initialize theme
    applyTheme(getCurrentTheme());
    
    // Handle theme toggle click
    themeToggle.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        
        // Save preference
        localStorage.setItem('theme', currentTheme);
        
        // Apply theme
        applyTheme(currentTheme);
    });
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // Only apply if user hasn't set a preference
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
    
    // Add a tab for deployed VMs
    function addDeployedVMsTab() {
        // Check if the tab already exists
        if (document.getElementById('deployed-vms-output')) {
            return;
        }
        
        // Create tab button
        const deployedVMsTabBtn = document.createElement('button');
        deployedVMsTabBtn.className = 'tab-btn';
        deployedVMsTabBtn.setAttribute('data-tab', 'deployed-vms');
        deployedVMsTabBtn.innerHTML = '<i class="fas fa-server"></i> Deployed VMs';
        
        // Add the button to the tabs
        const tabsContainer = document.querySelector('.tabs');
        if (tabsContainer) {
            tabsContainer.appendChild(deployedVMsTabBtn);
        }
        
        // Create tab panel
        const deployedVMsPanel = document.createElement('div');
        deployedVMsPanel.id = 'deployed-vms-output';
        deployedVMsPanel.className = 'tab-panel';
        
        deployedVMsPanel.innerHTML = `
            <div class="panel-header">
                <h3>Currently Deployed VMs</h3>
                <button id="refresh-vms" class="btn btn-small">
                    <i class="fas fa-sync"></i> Refresh
                </button>
            </div>
            <div id="deployed-vms-list" class="deployed-vms-list">
                <p>Loading deployed VMs...</p>
            </div>
        `;
        
        // Add the panel to the tab content
        const tabContent = document.querySelector('.tab-content');
        if (tabContent) {
            tabContent.appendChild(deployedVMsPanel);
        }
        
        // Add click handler for the tab button
        deployedVMsTabBtn.addEventListener('click', () => {
            // Remove active class from all buttons and panels
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            
            // Add active class to this button and panel
            deployedVMsTabBtn.classList.add('active');
            deployedVMsPanel.classList.add('active');
            
            // Load the deployed VMs
            loadDeployedVMs();
        });
        
        // Add click handler for refresh button
        setTimeout(() => {
            const refreshBtn = document.getElementById('refresh-vms');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', loadDeployedVMs);
            }
        }, 100);
    }
    
    // Function to load and display all deployed VMs
    function loadDeployedVMs() {
        const deployedVMsList = document.getElementById('deployed-vms-list');
        if (!deployedVMsList) return;
        
        deployedVMsList.innerHTML = '<p>Loading deployed VMs...</p>';
        
        fetch('/api/deployed-vms')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.deployedVMs && data.deployedVMs.length > 0) {
                    const vmItems = data.deployedVMs.map(vm => `
                        <div class="vm-item" data-id="${vm.id}">
                            <div class="vm-info">
                                <div class="vm-name">${vm.vmName}</div>
                                <div class="vm-details">
                                    Workspace: ${vm.name} | 
                                    CPU: ${vm.config.cpu} cores | 
                                    Memory: ${vm.config.memory} MB | 
                                    Disk: ${vm.config.diskSize} GB
                                </div>
                                <div class="vm-deployed">
                                    Deployed: ${new Date(vm.deployedAt).toLocaleString()}
                                </div>
                            </div>
                            <div class="vm-actions">
                                <button class="select-workspace btn btn-secondary" data-id="${vm.id}">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="destroy-vm btn btn-danger" data-id="${vm.id}">
                                    <i class="fas fa-trash"></i> Destroy
                                </button>
                            </div>
                        </div>
                    `).join('');
                    
                    deployedVMsList.innerHTML = vmItems;
                    
                    // Add event listeners to buttons
                    document.querySelectorAll('.select-workspace').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const workspaceId = e.target.closest('.select-workspace').getAttribute('data-id');
                            selectWorkspace(workspaceId);
                        });
                    });
                    
                    document.querySelectorAll('.destroy-vm').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const workspaceId = e.target.closest('.destroy-vm').getAttribute('data-id');
                            destroyVM(workspaceId);
                        });
                    });
                } else {
                    deployedVMsList.innerHTML = '<p>No VMs currently deployed.</p>';
                }
            })
            .catch(error => {
                deployedVMsList.innerHTML = `<p class="error-message">Error loading VMs: ${error.message}</p>`;
            });
    }
    
    // Function to destroy a VM but keep its workspace
    function destroyVM(workspaceId) {
        if (!confirm('Are you sure you want to destroy this VM? This action cannot be undone.')) {
            return;
        }
        
        // We need the password for vSphere
        const vspherePassword = document.getElementById('vsphere_password').value;
        if (!vspherePassword) {
            alert('Please enter the vSphere password to destroy the VM.');
            return;
        }
        
        // Show loading notification
        showNotification('Destroying VM, please wait...', 'warning');
        
        fetch('/api/terraform/destroy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                workspaceId,
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
                showNotification('VM destroyed successfully', 'success');
                
                // Reload deployed VMs list
                loadDeployedVMs();
                
                // If this is the current workspace, update the UI
                if (window.currentWorkspace && window.currentWorkspace.id === workspaceId) {
                    window.currentWorkspace.status = 'destroyed';
                    
                    // Add a note to the apply output
                    const applyOutput = document.getElementById('apply-code');
                    if (applyOutput) {
                        applyOutput.textContent += '\n\n// VM has been destroyed';
                    }
                }
            } else {
                showNotification(`Error destroying VM: ${data.error}`, 'error');
            }
        })
        .catch(error => {
            showNotification(`Error destroying VM: ${error.message}`, 'error');
        });
    }
    
    // Initialize deployed VMs tab
    addDeployedVMsTab();
});
