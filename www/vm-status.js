// VM Health functionality for Terraform vSphere VM Provisioning Web App

document.addEventListener('DOMContentLoaded', function() {
    // Add event listener to the VM Health check button
    const refreshVMsBtn = document.getElementById('refresh-vms-btn');
    if (refreshVMsBtn) {
        refreshVMsBtn.addEventListener('click', async function() {
            // Get the current workspace VM name
            if (!window.currentWorkspace) {
                showVMHealthError("Please select a VM workspace first");
                return;
            }

            const vmName = window.currentWorkspace.name;
            const vmHealthStatus = document.getElementById('vm-health-status');
            const vmHealthMetrics = document.getElementById('vm-health-metrics');
            
            // Show loading indicator
            vmHealthStatus.innerHTML = `<p class="loading">Checking health status for VM: ${vmName}...</p>`;
            vmHealthMetrics.innerHTML = '';
            
            // Get vSphere connection details from the form
            const vsphereServer = document.getElementById('vsphere_server').value;
            const vsphereUser = document.getElementById('vsphere_user').value;
            const vspherePassword = document.getElementById('vsphere_password').value;
            
            if (!vsphereServer || !vsphereUser || !vspherePassword) {
                showVMHealthError("Please fill in all vSphere connection details in the form above.");
                return;
            }
            
            try {
                // Call the API to get VM health information
                const response = await fetch('/api/vsphere/vms', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        vsphereServer,
                        vsphereUser,
                        vspherePassword
                    })
                });
                const data = await response.json();
                if (!data.success) {
                    showVMHealthError(`Error connecting to vSphere: ${data.error}`);
                    return;
                }
                if (!data.vms || data.vms.length === 0) {
                    showVMHealthError("No virtual machines found in the vSphere environment.");
                    return;
                }
                // Find the specific VM that matches our current workspace
                const result = findVMByNameOrIp(data.vms, vmName);
                let vmToCheck = null;
                if (result.exactMatch) {
                    vmToCheck = result.exactMatch;
                } else if (result.possibleMatches && result.possibleMatches.length > 0) {
                    vmToCheck = result.possibleMatches[0];
                }
                if (!vmToCheck) {
                    showVMHealthError(`VM "${vmName}" not found in vSphere. It may not be deployed yet.`);
                    displayManualSearchOption(data.vms);
                    return;
                }
                // Display vSphere health info
                displayVMHealth(vmToCheck);
                // Call backend to launch AAP job and get output
                vmHealthMetrics.innerHTML += '<div class="vm-metrics-title">Ansible AAP Job Launch</div><div id="aap-job-output">Launching job...</div>';
                try {
                    const aapResp = await fetch('/api/aap/launch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ target: vmToCheck.GuestIPAddress || vmToCheck.Name })
                    });
                    const aapData = await aapResp.json();
                    const outputDiv = document.getElementById('aap-job-output');
                    let statusLight = '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ffc107;margin-right:6px;vertical-align:middle;" title="Launching"></span>';
                    if (aapData.success) {
                        // Show only job ID, status, and launch info with light
                        const jobId = aapData.job.id || aapData.job.job || 'N/A';
                        const status = aapData.job.status || 'launched';
                        if (status === 'successful' || status === 'launched') {
                            statusLight = '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#28a745;margin-right:6px;vertical-align:middle;" title="Success"></span>';
                        } else if (status === 'failed' || status === 'error') {
                            statusLight = '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#dc3545;margin-right:6px;vertical-align:middle;" title="Failure"></span>';
                        }
                        outputDiv.innerHTML = `${statusLight}<b>Job Launched:</b> Job ID: <code>${jobId}</code> Status: <code>${status}</code>`;
                    } else {
                        statusLight = '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#dc3545;margin-right:6px;vertical-align:middle;" title="Failure"></span>';
                        outputDiv.innerHTML = `${statusLight}<span class="error-message">AAP Error: ${aapData.error || 'Unknown error'}</span>`;
                    }
                } catch (aapErr) {
                    const outputDiv = document.getElementById('aap-job-output');
                    const statusLight = '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#dc3545;margin-right:6px;vertical-align:middle;" title="Failure"></span>';
                    outputDiv.innerHTML = `${statusLight}<span class="error-message">AAP Error: ${aapErr.message}</span>`;
                }
            } catch (error) {
                console.error('Error fetching VM data:', error);
                showVMHealthError(`Error fetching VM data: ${error.message}`);
            }
        });
    }
      // Helper function to show error in VM health panel
    function showVMHealthError(message) {
        const vmHealthStatus = document.getElementById('vm-health-status');
        const vmHealthMetrics = document.getElementById('vm-health-metrics');
        
        vmHealthStatus.innerHTML = `<p class="error-message">${message}</p>`;
        vmHealthMetrics.innerHTML = '';
    }    // Advanced function to find a VM by name or IP address with improved matching
    function findVMByNameOrIp(vms, searchQuery) {
        console.log(`Searching for VM "${searchQuery}" among ${vms.length} VMs...`);
        
        const searchName = searchQuery.toLowerCase();
        const result = {
            exactMatch: null,
            possibleMatches: []
        };
        
        // Check if searchQuery might be an IP address
        const isIpAddress = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(searchQuery);
        
        // First try exact match by name
        const exactNameMatch = vms.find(vm => vm.Name && vm.Name.toLowerCase() === searchName);
        if (exactNameMatch) {
            console.log(`Found exact name match: ${exactNameMatch.Name}`);
            result.exactMatch = exactNameMatch;
            return result;
        }
        
        // Try IP address match if we have an IP
        if (isIpAddress) {
            const ipMatch = vms.find(vm => 
                (vm.GuestIPAddress && vm.GuestIPAddress === searchQuery) || 
                (vm.IpAddresses && Array.isArray(vm.IpAddresses) && vm.IpAddresses.includes(searchQuery))
            );
            
            if (ipMatch) {
                console.log(`Found match by IP address: ${ipMatch.Name}`);
                result.exactMatch = ipMatch;
                return result;
            }
        }
        
        // Advanced matching - tokenize names and look for word matches
        const searchTokens = searchName.split(/[-_\s.]+/);
        
        // Collect all partial matches based on name
        vms.forEach(vm => {
            if (!vm.Name) return; // Skip if VM has no name
            
            const vmNameLower = vm.Name.toLowerCase();
            const vmTokens = vmNameLower.split(/[-_\s.]+/);
            
            // Check for partial matches
            if (vmNameLower.includes(searchName) || searchName.includes(vmNameLower)) {
                result.possibleMatches.push(vm);
            } 
            // Try normalized match (removing hyphens and underscores)
            else {
                const normalizedVmName = vmNameLower.replace(/[-_\s.]/g, '');
                const normalizedSearchName = searchName.replace(/[-_\s.]/g, '');
                
                if (normalizedVmName.includes(normalizedSearchName) || 
                    normalizedSearchName.includes(normalizedVmName)) {
                    result.possibleMatches.push(vm);
                }
                // Try token matching
                else {
                    const hasMatchingTokens = searchTokens.some(token => 
                        token.length > 2 && vmTokens.some(vmToken => 
                            vmToken.includes(token) || token.includes(vmToken)
                        )
                    );
                    
                    if (hasMatchingTokens) {
                        result.possibleMatches.push(vm);
                    }
                }
            }
        });
        
        // Log all VM names for debugging
        console.log('Available VMs:');
        vms.forEach(vm => {
            if (vm.Name) {
                console.log(`- ${vm.Name} (${vm.GuestIPAddress || 'No IP'})`);
            }
        });
        
        return result;
    }
    
    // Function to display possible VM matches for selection
    function displayPossibleMatches(matches, originalName) {
        const vmHealthStatus = document.getElementById('vm-health-status');
        const vmHealthMetrics = document.getElementById('vm-health-metrics');
        
        vmHealthStatus.innerHTML = `
            <div class="possible-matches">
                <h3>VM "${originalName}" not found exactly, but found these possible matches:</h3>
                <div class="match-list">
                    ${matches.map((vm, index) => `
                        <div class="match-item">
                            <button class="select-vm-btn" data-index="${index}">Select</button>
                            <span class="vm-name">${vm.Name}</span>
                            ${vm.GuestIPAddress ? `<span class="vm-ip">(IP: ${vm.GuestIPAddress})</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        vmHealthMetrics.innerHTML = '';
        
        // Add event listeners to the select buttons
        const selectButtons = document.querySelectorAll('.select-vm-btn');
        selectButtons.forEach(button => {
            button.addEventListener('click', () => {
                const index = parseInt(button.getAttribute('data-index'));
                displayVMHealth(matches[index]);
            });
        });
    }
    
    // Function to display a manual search option when no matches are found
    function displayManualSearchOption(allVMs) {
        const vmHealthMetrics = document.getElementById('vm-health-metrics');
        
        vmHealthMetrics.innerHTML = `
            <div class="manual-search">
                <h3>Select from available VMs:</h3>
                <input type="text" id="vm-search-input" placeholder="Type to filter VMs...">
                <div class="all-vms-list">
                    ${allVMs.map((vm, index) => `
                        <div class="vm-list-item" data-vm-name="${vm.Name.toLowerCase()}">
                            <button class="select-vm-btn" data-index="${index}">Select</button>
                            <span class="vm-name">${vm.Name}</span>
                            ${vm.GuestIPAddress ? `<span class="vm-ip">(IP: ${vm.GuestIPAddress})</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Add event listeners to the select buttons
        const selectButtons = document.querySelectorAll('.all-vms-list .select-vm-btn');
        selectButtons.forEach(button => {
            button.addEventListener('click', () => {
                const index = parseInt(button.getAttribute('data-index'));
                displayVMHealth(allVMs[index]);
            });
        });
        
        // Add filtering functionality to the search input
        const searchInput = document.getElementById('vm-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const filterValue = searchInput.value.toLowerCase();
                const vmItems = document.querySelectorAll('.vm-list-item');
                
                vmItems.forEach(item => {
                    const vmName = item.getAttribute('data-vm-name');
                    if (vmName.includes(filterValue)) {
                        item.style.display = 'flex';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
        }
    }
    
    // Function to display the VM health information
    function displayVMHealth(vm) {
        const vmHealthStatus = document.getElementById('vm-health-status');
        const vmHealthMetrics = document.getElementById('vm-health-metrics');
        
        // Determine status class
        let statusClass = 'unknown';
        let statusText = 'Unknown';
        
        if (vm.PowerState === 'poweredOn') {
            statusClass = 'healthy';
            statusText = 'Healthy';
        } else if (vm.PowerState === 'poweredOff') {
            statusClass = 'offline';
            statusText = 'Offline';
        } else if (vm.PowerState === 'suspended') {
            statusClass = 'suspended';
            statusText = 'Suspended';
        }
        
        // Convert memory from MB to GB for display
        const memoryGB = Math.round((vm.MemoryMB / 1024) * 10) / 10;
        
        // Display VM health status
        vmHealthStatus.innerHTML = `
            <div class="vm-health-card">
                <div class="vm-health-name">${vm.Name}</div>
                <div class="vm-health-badge ${statusClass}">${statusText}</div>
                <div class="vm-health-state">Power State: ${vm.PowerState}</div>
                <div class="vm-guest-os">Guest OS: ${vm.GuestFullName || 'Unknown'}</div>
            </div>
        `;
        
        // Generate synthetic health metrics for demonstration
        // In a real environment, these would come from the vSphere API
        const cpuUsage = statusClass === 'healthy' ? getRandomMetric(15, 40) : 0;
        const memoryUsage = statusClass === 'healthy' ? getRandomMetric(30, 70) : 0;
        const diskUsage = statusClass === 'healthy' ? getRandomMetric(20, 60) : 0;
        const networkTx = statusClass === 'healthy' ? getRandomMetric(5, 20) : 0;
        const networkRx = statusClass === 'healthy' ? getRandomMetric(10, 30) : 0;
        
        // Display VM health metrics
        vmHealthMetrics.innerHTML = `
            <div class="vm-metrics-title">VM Health Metrics</div>
            <div class="vm-metrics-grid">
                <div class="vm-metric">
                    <div class="vm-metric-title">CPU</div>
                    <div class="vm-metric-value">${vm.NumCpu} cores</div>
                    ${statusClass === 'healthy' ? `<div class="vm-metric-usage">
                        <div class="usage-bar">
                            <div class="usage-fill" style="width: ${cpuUsage}%"></div>
                        </div>
                        <div class="usage-text">${cpuUsage}% utilization</div>
                    </div>` : ''}
                </div>
                
                <div class="vm-metric">
                    <div class="vm-metric-title">Memory</div>
                    <div class="vm-metric-value">${memoryGB} GB</div>
                    ${statusClass === 'healthy' ? `<div class="vm-metric-usage">
                        <div class="usage-bar">
                            <div class="usage-fill" style="width: ${memoryUsage}%"></div>
                        </div>
                        <div class="usage-text">${memoryUsage}% utilized</div>
                    </div>` : ''}
                </div>
                
                <div class="vm-metric">
                    <div class="vm-metric-title">Disk</div>
                    <div class="vm-metric-value">System Disk</div>
                    ${statusClass === 'healthy' ? `<div class="vm-metric-usage">
                        <div class="usage-bar">
                            <div class="usage-fill" style="width: ${diskUsage}%"></div>
                        </div>
                        <div class="usage-text">${diskUsage}% full</div>
                    </div>` : ''}
                </div>
                
                <div class="vm-metric">
                    <div class="vm-metric-title">Network</div>
                    <div class="vm-metric-value">Primary NIC</div>
                    ${statusClass === 'healthy' ? `<div class="vm-metric-usage">
                        <div class="usage-text">TX: ${networkTx} MB/s</div>
                        <div class="usage-text">RX: ${networkRx} MB/s</div>
                    </div>` : ''}
                </div>
            </div>
            
            <div class="vm-uptime">
                ${statusClass === 'healthy' ? 'Uptime: 3 days, 5 hours, 27 minutes' : 'VM is not running'}
            </div>
            
            ${statusClass === 'healthy' ? `<div class="vm-events">
                <div class="vm-events-title">Recent Events</div>
                <div class="vm-event">
                    <span class="vm-event-time">Today, 09:15 AM</span>
                    <span class="vm-event-desc">Normal system operation</span>
                </div>
                <div class="vm-event">
                    <span class="vm-event-time">Yesterday, 10:30 PM</span>
                    <span class="vm-event-desc">VM resource allocation adjusted</span>
                </div>
                <div class="vm-event">
                    <span class="vm-event-time">April 28, 2025, 3:12 PM</span>
                    <span class="vm-event-desc">VM powered on after maintenance</span>
                </div>
            </div>` : ''}
        `;
    }
    
    // Helper function to generate random metric values
    function getRandomMetric(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
});
