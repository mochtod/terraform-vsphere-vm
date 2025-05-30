// Post-Deployment CHR Registration and Ansible Automation
document.addEventListener('DOMContentLoaded', function() {
    
    // Create and manage post-deployment workflow
    class PostDeploymentManager {
        constructor() {
            this.currentWorkspace = null;
            this.registrationStatus = 'pending';
            this.vmHealthStatus = { status: 'unknown', ready: false };
            this.ansibleJobs = [];
            this.selectedJobs = new Set([1]); // Default to Basic Configuration
            this.jobResults = {};
            this.healthCheckInterval = null;
        }

        // Initialize post-deployment process
        async initPostDeployment(workspace) {
            this.currentWorkspace = workspace;
            
            // Only proceed if it's a Linux template
            const guestId = workspace.config?.vm_guest_id || '';
            if (!window.satelliteApi.isLinuxTemplate(guestId)) {
                console.log('Windows template detected, skipping CHR registration');
                return;
            }

            this.createPostDeploymentUI();
            await this.startRegistrationProcess();
        }

        // Create the post-deployment UI
        createPostDeploymentUI() {
            const existingContainer = document.getElementById('post-deployment-container');
            if (existingContainer) {
                existingContainer.remove();
            }

            const container = document.createElement('div');
            container.id = 'post-deployment-container';
            container.className = 'post-deployment-container';
            
            container.innerHTML = `
                <div class="post-deployment-section">
                    <h3><i class="fas fa-satellite-dish"></i> Post-Deployment Configuration</h3>
                    
                    <!-- CHR Registration Status -->
                    <div class="registration-section">
                        <h4>CHR Satellite Registration</h4>
                        <div id="registration-status" class="status-indicator">
                            <span class="status pending">
                                ⏳ Waiting for VM build completion...
                            </span>
                        </div>
                        <div id="registration-command" class="registration-command" style="display: none;">
                            <strong>Registration Command:</strong>
                            <pre id="registration-cmd-text"></pre>
                        </div>
                    </div>

                    <!-- VM Health Status -->
                    <div id="health-section" class="health-section" style="display: none;">
                        <h4>VM Health Status</h4>
                        <div id="health-status" class="status-indicator">
                            <span class="status checking">
                                🔄 Checking VM health...
                            </span>
                        </div>
                    </div>

                    <!-- Ansible Jobs -->
                    <div id="ansible-section" class="ansible-section" style="display: none;">
                        <h4>Available Ansible Automation</h4>
                        <div id="job-selection" class="job-selection">
                            <!-- Jobs will be populated here -->
                        </div>
                        <button id="run-jobs-btn" class="btn btn-primary" disabled>
                            Run Selected Jobs (0)
                        </button>
                    </div>
                </div>
            `;

            // Insert after the apply output section
            const applyOutputPanel = document.getElementById('apply-output');
            if (applyOutputPanel) {
                applyOutputPanel.insertAdjacentElement('afterend', container);
            }
        }

        // Start the CHR registration process
        async startRegistrationProcess() {
            const hostGroup = this.currentWorkspace.config?.vm_host_group;
            if (!hostGroup) {
                this.updateRegistrationStatus('error', 'No host group selected for Linux VM');
                return;
            }

            this.updateRegistrationStatus('registering', 'Registering with CHR Satellite...');

            // Generate registration command
            const registrationCommand = window.satelliteApi.generateCHRRegistrationCommand(hostGroup);
            document.getElementById('registration-cmd-text').textContent = registrationCommand;
            document.getElementById('registration-command').style.display = 'block';

            // Simulate registration process (in real implementation, this would be done by Terraform)
            setTimeout(() => {
                this.updateRegistrationStatus('completed', 'Registration completed successfully');
                this.startHealthMonitoring();
            }, 3000);
        }

        // Update registration status
        updateRegistrationStatus(status, message) {
            this.registrationStatus = status;
            const statusElement = document.getElementById('registration-status');
            if (statusElement) {
                statusElement.innerHTML = `<span class="status ${status}">${this.getStatusIcon(status)} ${message}</span>`;
            }
        }

        // Start VM health monitoring
        startHealthMonitoring() {
            document.getElementById('health-section').style.display = 'block';
            
            const vmName = this.currentWorkspace.config?.vm_name;
            if (!vmName) return;

            // Start health check interval
            this.healthCheckInterval = setInterval(async () => {
                const health = await window.satelliteApi.checkVMHealth(vmName);
                this.vmHealthStatus = health;
                
                this.updateHealthStatus(health);
                
                if (health.ready) {
                    clearInterval(this.healthCheckInterval);
                    await this.loadAnsibleJobs();
                }
            }, 10000); // Check every 10 seconds

            // Simulate health becoming ready after some time
            setTimeout(() => {
                this.vmHealthStatus = { status: 'healthy', ready: true };
                this.updateHealthStatus(this.vmHealthStatus);
                if (this.healthCheckInterval) {
                    clearInterval(this.healthCheckInterval);
                }
                this.loadAnsibleJobs();
            }, 15000);
        }

        // Update health status display
        updateHealthStatus(health) {
            const healthElement = document.getElementById('health-status');
            if (healthElement) {
                const message = health.ready ? 'VM is healthy and ready' : 'Checking VM health...';
                const status = health.ready ? 'healthy' : 'checking';
                healthElement.innerHTML = `<span class="status ${status}">${this.getStatusIcon(status)} ${message}</span>`;
            }
        }        // Load available Ansible jobs
        async loadAnsibleJobs() {
            try {
                this.ansibleJobs = await window.satelliteApi.getAvailableAnsibleJobs();
                this.displayAnsibleJobs();
                document.getElementById('ansible-section').style.display = 'block';
            } catch (error) {
                console.error('Error loading Ansible jobs:', error);
                this.showAnsibleJobsError(error.message);
            }
        }

        // Show Ansible jobs error
        showAnsibleJobsError(message) {
            const ansibleSection = document.getElementById('ansible-section');
            if (!ansibleSection) return;

            ansibleSection.style.display = 'block';
            const jobSelection = document.getElementById('job-selection');
            if (jobSelection) {
                jobSelection.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        Unable to load Ansible jobs: ${message}
                        <br><small>Please check CHR Satellite configuration and try again.</small>
                    </div>
                `;
            }
            
            // Disable the run button
            const runButton = document.getElementById('run-jobs-btn');
            if (runButton) {
                runButton.disabled = true;
                runButton.textContent = 'CHR Satellite Unavailable';
            }
        }

        // Display Ansible jobs for selection
        displayAnsibleJobs() {
            const jobSelection = document.getElementById('job-selection');
            if (!jobSelection) return;

            jobSelection.innerHTML = this.ansibleJobs.map(job => `
                <div class="job-item ${!job.approved ? 'disabled' : ''}">
                    <label>
                        <input
                            type="checkbox"
                            value="${job.id}"
                            ${this.selectedJobs.has(job.id) ? 'checked' : ''}
                            ${!job.approved ? 'disabled' : ''}
                            onchange="window.postDeploymentManager.handleJobSelection(${job.id}, this.checked)"
                        />
                        <span class="job-name">${job.name}</span>
                        ${!job.approved ? '<span class="approval-required">(Approval Required)</span>' : ''}
                    </label>
                    <p class="job-description">${job.description}</p>
                    
                    <div id="job-result-${job.id}" class="job-result" style="display: none;"></div>
                </div>
            `).join('');

            this.updateRunButton();
        }

        // Handle job selection
        handleJobSelection(jobId, checked) {
            if (checked) {
                this.selectedJobs.add(jobId);
            } else {
                this.selectedJobs.delete(jobId);
            }
            this.updateRunButton();
        }

        // Update the run jobs button
        updateRunButton() {
            const button = document.getElementById('run-jobs-btn');
            if (button) {
                button.textContent = `Run Selected Jobs (${this.selectedJobs.size})`;
                button.disabled = this.selectedJobs.size === 0;
            }
        }

        // Run selected Ansible jobs
        async runSelectedJobs() {
            const vmName = this.currentWorkspace.config?.vm_name;
            if (!vmName) return;

            for (const jobId of this.selectedJobs) {
                const resultElement = document.getElementById(`job-result-${jobId}`);
                if (resultElement) {
                    resultElement.style.display = 'block';
                    resultElement.innerHTML = '<span class="status running">🔄 Running...</span>';
                }

                try {
                    const result = await window.satelliteApi.runAnsibleJob(jobId, vmName);
                    
                    if (resultElement) {
                        resultElement.innerHTML = '<span class="status completed">✅ Completed</span>';
                    }
                } catch (error) {
                    if (resultElement) {
                        resultElement.innerHTML = `<span class="status error">❌ Error: ${error.message}</span>`;
                    }
                }
            }
        }

        // Get status icon for different states
        getStatusIcon(status) {
            const icons = {
                'pending': '⏳',
                'registering': '🔄',
                'completed': '✅',
                'error': '❌',
                'checking': '🔄',
                'healthy': '✅',
                'running': '🔄'
            };
            return icons[status] || '❓';
        }

        // Cleanup
        cleanup() {
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
            }
            const container = document.getElementById('post-deployment-container');
            if (container) {
                container.remove();
            }
        }
    }

    // Create global instance
    window.postDeploymentManager = new PostDeploymentManager();

    // Set up event listener for the run jobs button
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'run-jobs-btn') {
            window.postDeploymentManager.runSelectedJobs();
        }
    });

    // Listen for deployment completion
    document.addEventListener('deploymentCompleted', function(e) {
        if (e.detail && e.detail.workspace) {
            window.postDeploymentManager.initPostDeployment(e.detail.workspace);
        }
    });

    // Cleanup when workspace changes
    document.addEventListener('workspaceChanged', function(e) {
        window.postDeploymentManager.cleanup();
    });
});
