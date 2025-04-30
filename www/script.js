// Main JavaScript for Terraform vSphere VM Provisioning Web App

document.addEventListener('DOMContentLoaded', function() {
    // Tab switching functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons and panels
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            // Add active class to clicked button and corresponding panel
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`${tabId}-output`).classList.add('active');
        });
    });

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
        
        return tfvarsContent;
    }

    // Update tfvars display when any form field changes
    const formInputs = document.querySelectorAll('#vm-form input, #vm-form select');
    formInputs.forEach(input => {
        input.addEventListener('change', generateTfvars);
    });

    // Generate tfvars on page load
    generateTfvars();    // Handle the Plan button click
    document.getElementById('plan-button').addEventListener('click', function() {
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
        let vspherePassword = '';
        
        for (const [key, value] of formData.entries()) {
            if (key === 'vsphere_password') {
                vspherePassword = value;
            } else {
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
                // Store the plan path and run directory for later use
                window.currentPlanPath = data.planPath;
                window.currentRunDir = data.runDir;
                
                // Display the plan output
                planOutput.textContent = data.planOutput;
                
                // Add a note about applying the plan
                planOutput.textContent += "\n\nPlan generated successfully!\nClick 'Apply Changes' to provision this VM.";
            } else {
                planOutput.textContent = "Error generating plan:\n\n" + data.error;
            }
        })
        .catch(error => {
            planOutput.textContent = "Error connecting to backend:\n\n" + error.message;
        });
    });    // Handle the Apply button click
    document.getElementById('apply-button').addEventListener('click', function() {
        const applyOutput = document.getElementById('apply-code');
        
        // Show loading state
        applyOutput.textContent = "Running terraform apply...\nConnecting to backend and executing apply command...\n";
        
        // Show the apply tab
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        document.querySelector('[data-tab="apply"]').classList.add('active');
        document.getElementById('apply-output').classList.add('active');
        
        // Check if we have a plan path from the previous plan operation
        if (!window.currentPlanPath) {
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
                planPath: window.currentPlanPath,
                runDir: window.currentRunDir,
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
                // Display the apply output
                applyOutput.textContent = data.applyOutput;
                
                // Add information about the VM
                applyOutput.textContent += "\n\nVM provisioned successfully!";
                if (data.vmId) {
                    applyOutput.textContent += `\nVM ID: ${data.vmId}`;
                }
                
                // Add a link to check VM status
                addDeploymentStatusTracking(window.currentRunDir);
            } else {
                applyOutput.textContent = "Error applying terraform:\n\n" + data.error;
            }
        })
        .catch(error => {
            applyOutput.textContent = "Error connecting to backend:\n\n" + error.message;
        });
    });

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
});
