// VM Customization functionality for Terraform vSphere VM Provisioning Web App

document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const aapJobTemplateSelect = document.getElementById('aap-job-template');
    const launchAapJobBtn = document.getElementById('launch-aap-job');
    const vmCustomizationDetails = document.getElementById('vm-customization-details');
    const aapJobResults = document.getElementById('aap-job-results');

    // Global variables
    let currentWorkspaceVM = null;
    let jobTemplates = [];

    // Initialize the VM customization tab when clicked
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === 'vm-customization') {
            btn.addEventListener('click', initVMCustomizationTab);
        }
    });

    // Initialize the VM customization tab
    function initVMCustomizationTab() {
        // Load job templates
        loadAapJobTemplates();
        
        // Check if there's a current workspace
        if (window.currentWorkspace && window.currentWorkspace.id) {
            loadWorkspaceDetails(window.currentWorkspace.id);
        } else {
            vmCustomizationDetails.innerHTML = `<p class="info-message">Please select a VM workspace first</p>`;
            disableJobControls();
        }
    }

    // Set up default job template
    function loadAapJobTemplates() {
        // Define the default template directly
        const defaultTemplate = {
            id: 72,
            name: "Basic Configure",
            description: "CHR basic RHEL with security"
        };
        
        jobTemplates = [defaultTemplate];
        populateJobTemplatesDropdown(jobTemplates);
    }

    // Populate job templates dropdown
    function populateJobTemplatesDropdown(templates) {
        // Clear existing options
        aapJobTemplateSelect.innerHTML = '';
        
        // Add templates to dropdown
        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            option.title = template.description || '';
            aapJobTemplateSelect.appendChild(option);
        });
        
        // Select the first/default template
        if (aapJobTemplateSelect.options.length > 0) {
            aapJobTemplateSelect.selectedIndex = 0;
        }
    }

    // Load workspace details
    function loadWorkspaceDetails(workspaceId) {
        fetch(`/api/workspaces/${workspaceId}`)
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load workspace');
                }
                
                const workspace = data.workspace;
                currentWorkspaceVM = workspace;
                
                // Check if VM is deployed
                if (workspace.status !== 'deployed' || !workspace.config || !workspace.config.vm_name) {
                    vmCustomizationDetails.innerHTML = `
                        <p class="warning-message">This VM has not been deployed yet. Please complete the deployment process first.</p>
                    `;
                    disableJobControls();
                    return;
                }
                
                // Display VM details
                const vmName = workspace.config.vm_name;
                const vmCpu = workspace.config.vm_cpu || 'unknown';
                const vmMemory = workspace.config.vm_memory ? `${Math.round((workspace.config.vm_memory / 1024) * 10) / 10} GB` : 'unknown';
                const vmDeployedAt = workspace.lastDeployed ? new Date(workspace.lastDeployed).toLocaleString() : 'unknown';
                
                // Get VM IP address from workspace.applyOutput if available
                let vmIpMatch = null;
                let vmIp = 'not available';
                
                if (workspace.applyOutput) {
                    vmIpMatch = workspace.applyOutput.match(/vm_ip\s*=\s*"([^"]+)"/);
                    if (vmIpMatch && vmIpMatch[1]) {
                        vmIp = vmIpMatch[1];
                    }
                }
                
                vmCustomizationDetails.innerHTML = `
                    <div class="vm-info-card">
                        <div class="vm-info-row">
                            <span class="vm-info-label">VM Name:</span>
                            <span class="vm-info-value">${vmName}</span>
                        </div>
                        <div class="vm-info-row">
                            <span class="vm-info-label">IP Address:</span>
                            <span class="vm-info-value">${vmIp}</span>
                        </div>
                        <div class="vm-info-row">
                            <span class="vm-info-label">CPU Cores:</span>
                            <span class="vm-info-value">${vmCpu}</span>
                        </div>
                        <div class="vm-info-row">
                            <span class="vm-info-label">Memory:</span>
                            <span class="vm-info-value">${vmMemory}</span>
                        </div>
                        <div class="vm-info-row">
                            <span class="vm-info-label">Deployed At:</span>
                            <span class="vm-info-value">${vmDeployedAt}</span>
                        </div>
                        <div class="vm-info-row">
                            <span class="vm-info-label">Status:</span>
                            <span class="vm-info-value vm-status-deployed">Deployed</span>
                        </div>
                    </div>
                `;
                
                // Check for previous AAP jobs
                if (workspace.aapJob) {
                    try {
                        const jobId = workspace.aapJob.job && workspace.aapJob.job.id ? workspace.aapJob.job.id : 'N/A';
                        const jobStatus = workspace.aapJob.status || 'unknown';
                        const jobTime = workspace.aapJob.time ? new Date(workspace.aapJob.time).toLocaleString() : 'unknown';
                        
                        aapJobResults.innerHTML = `
                            <div class="previous-job-info">
                                <h4>Previous AAP Job</h4>
                                <div class="job-info-row">
                                    <span class="job-info-label">Job ID:</span>
                                    <span class="job-info-value">${jobId}</span>
                                </div>
                                <div class="job-info-row">
                                    <span class="job-info-label">Status:</span>
                                    <span class="job-info-value">${jobStatus}</span>
                                </div>
                                <div class="job-info-row">
                                    <span class="job-info-label">Launched:</span>
                                    <span class="job-info-value">${jobTime}</span>
                                </div>
                            </div>
                        `;
                    } catch (error) {
                        console.error('Error displaying previous AAP job:', error);
                        aapJobResults.innerHTML = '';
                    }
                } else {
                    aapJobResults.innerHTML = '';
                }
                
                // Enable job controls
                enableJobControls();
            })
            .catch(error => {
                console.error('Error loading workspace details:', error);
                vmCustomizationDetails.innerHTML = `
                    <p class="error-message">Error loading workspace details: ${error.message}</p>
                `;
                disableJobControls();
            });
    }

    // Enable job control buttons
    function enableJobControls() {
        launchAapJobBtn.disabled = false;
    }

    // Disable job control buttons
    function disableJobControls() {
        launchAapJobBtn.disabled = true;
    }

    // Handle AAP job launch
    launchAapJobBtn.addEventListener('click', function() {
        if (!currentWorkspaceVM || !currentWorkspaceVM.id || !currentWorkspaceVM.config || !currentWorkspaceVM.config.vm_name) {
            showJobError('No valid VM selected. Please select a deployed VM first.');
            return;
        }
        
        const templateId = aapJobTemplateSelect.value;
        if (!templateId) {
            showJobError('Please select a job template first.');
            return;
        }
        
        // Get VM target (name or IP)
        let target = currentWorkspaceVM.config.vm_name;
        
        // Try to get IP if available
        if (currentWorkspaceVM.applyOutput) {
            const ipMatch = currentWorkspaceVM.applyOutput.match(/vm_ip\s*=\s*"([^"]+)"/);
            if (ipMatch && ipMatch[1]) {
                target = ipMatch[1];
            }
        }
        
        // Show loading state
        aapJobResults.innerHTML = `
            <div class="job-loading">
                <p><i class="fas fa-spinner fa-spin"></i> Launching AAP job...</p>
            </div>
        `;
        
        // First, fetch current settings to check if AAP is properly configured
        fetch('/api/settings')
            .then(response => response.json())
            .then(settingsData => {
                // Check if AAP settings are properly configured
                if (!settingsData.success || 
                    !settingsData.settings || 
                    !settingsData.settings.aap || 
                    !settingsData.settings.aap.api_url || 
                    !settingsData.settings.aap.api_token) {
                    
                    throw new Error('AAP API credentials are not properly configured in settings. Please configure the API URL and token.');
                }
                
                // If settings are properly configured, launch the job
                return fetch('/api/aap/launch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        target: target,
                        templateId: templateId,
                        workspaceId: currentWorkspaceVM.id
                    })
                });
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    let errorMsg = data.error || 'Failed to launch AAP job';
                    if (errorMsg.includes('API credentials not configured')) {
                        errorMsg = 'AAP API credentials are not properly configured. Please check settings.';
                    }
                    throw new Error(errorMsg);
                }
            
            // Display job results
            const jobId = data.job.id || 'N/A';
            const statusLight = '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#28a745;margin-right:6px;"></span>';
            
            aapJobResults.innerHTML = `
                <div class="job-success">
                    <div class="job-header">
                        ${statusLight} AAP Job Launched Successfully
                    </div>
                    <div class="job-details">
                        <div class="job-detail-row">
                            <span class="job-detail-label">Job ID:</span>
                            <span class="job-detail-value">${jobId}</span>
                        </div>
                        <div class="job-detail-row">
                            <span class="job-detail-label">Status:</span>
                            <span class="job-detail-value">Launched</span>
                        </div>
                        <div class="job-detail-row">
                            <span class="job-detail-label">Target:</span>
                            <span class="job-detail-value">${target}</span>
                        </div>
                        <div class="job-detail-row">
                            <span class="job-detail-label">Template ID:</span>
                            <span class="job-detail-value">${templateId}</span>
                        </div>
                    </div>
                    <div class="job-advice">
                        <p>The AAP job has been launched. You can check its status in the AAP dashboard.</p>
                    </div>
                </div>
            `;
        })
        .catch(error => {
            console.error('Error launching AAP job:', error);
            showJobError(`Failed to launch AAP job: ${error.message}`);
        });
    });

    // Show job error
    function showJobError(message) {
        aapJobResults.innerHTML = `
            <div class="job-error">
                <div class="job-error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="job-error-message">
                    ${message}
                </div>
            </div>
        `;
    }

    // Check for workspace changes (from script.js)
    document.addEventListener('workspaceChanged', function(e) {
        if (e.detail && e.detail.workspace && e.detail.workspace.id) {
            // Update to the new workspace
            currentWorkspaceVM = e.detail.workspace;
            loadWorkspaceDetails(e.detail.workspace.id);
        } else {
            // Reset the UI if workspace is invalid
            currentWorkspaceVM = null;
            vmCustomizationDetails.innerHTML = `<p class="info-message">Please select a valid VM workspace</p>`;
            aapJobResults.innerHTML = '';
            disableJobControls();
        }
    });
    
    // Initialize on page load if we have a current workspace
    if (window.currentWorkspace && window.currentWorkspace.id) {
        // Wait for DOM to be fully ready
        setTimeout(() => {
            loadAapJobTemplates();
            loadWorkspaceDetails(window.currentWorkspace.id);
        }, 500);
    }
});
