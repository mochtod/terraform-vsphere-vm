// Connection Status Management for vSphere VM Provisioning
document.addEventListener('DOMContentLoaded', function() {
    // Status indicator elements
    const vsphereStatusEl = document.getElementById('vsphere-status');
    const templatesStatusEl = document.getElementById('templates-status');
    const infrastructureStatusEl = document.getElementById('infrastructure-status');
    const testConnectionBtn = document.getElementById('test-vsphere-connection');
    
    // Status tracking
    let connectionStatus = {
        vsphere: 'unknown',
        templates: 'unknown',
        infrastructure: 'unknown'
    };
    
    // Update status indicator display
    function updateStatusIndicator(element, status, text = null) {
        if (!element) return;
        
        const icon = element.querySelector('i');
        const span = element.querySelector('span');
        
        // Remove all status classes
        icon.classList.remove('status-connected', 'status-error', 'status-testing', 'status-unknown');
        element.classList.remove('status-connected', 'status-error', 'status-testing', 'status-unknown');
        
        // Add new status class
        icon.classList.add(`status-${status}`);
        element.classList.add(`status-${status}`);
        
        // Update text if provided
        if (text && span) {
            span.textContent = text;
        }
    }
    
    // Test vSphere connection
    async function testVSphereConnection() {
        console.log('Testing vSphere connection...');
        
        // Check if credentials are available
        const connectionInfo = getVSphereConnectionInfo();
        if (!connectionInfo) {
            updateStatusIndicator(vsphereStatusEl, 'error', 'vSphere (No Credentials)');
            updateStatusIndicator(templatesStatusEl, 'error', 'Templates (No Connection)');
            updateStatusIndicator(infrastructureStatusEl, 'error', 'Infrastructure (No Connection)');
            return false;
        }
        
        // Disable test button and show testing status
        testConnectionBtn.disabled = true;
        testConnectionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
        
        updateStatusIndicator(vsphereStatusEl, 'testing', 'vSphere (Testing...)');
        updateStatusIndicator(templatesStatusEl, 'testing', 'Templates (Testing...)');
        updateStatusIndicator(infrastructureStatusEl, 'testing', 'Infrastructure (Testing...)');
        
        let allTestsPassed = true;
        
        try {
            // Test 1: Basic vSphere connection (test datacenters)
            console.log('Testing basic vSphere connection...');
            try {
                const response = await fetch('/api/vsphere-infra/components', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        vsphereServer: connectionInfo.server,
                        vsphereUser: connectionInfo.user,
                        vspherePassword: connectionInfo.password,
                        component: 'datacenters'
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        updateStatusIndicator(vsphereStatusEl, 'connected', 'vSphere (Connected)');
                        updateStatusIndicator(infrastructureStatusEl, 'connected', 'Infrastructure (Available)');
                        connectionStatus.vsphere = 'connected';
                        connectionStatus.infrastructure = 'connected';
                    } else {
                        throw new Error(data.error || 'Unknown API error');
                    }
                } else {
                    let errorMsg = `HTTP ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorData.message || errorMsg;
                    } catch (e) { /* Ignore parsing error */ }
                    throw new Error(errorMsg);
                }
            } catch (error) {
                console.error('vSphere connection test failed:', error);
                updateStatusIndicator(vsphereStatusEl, 'error', 'vSphere (Connection Failed)');
                updateStatusIndicator(infrastructureStatusEl, 'error', 'Infrastructure (Unavailable)');
                connectionStatus.vsphere = 'error';
                connectionStatus.infrastructure = 'error';
                allTestsPassed = false;
            }
            
            // Test 2: Templates availability
            console.log('Testing VM templates availability...');
            try {
                const response = await fetch('/api/vsphere/templates', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        vsphereServer: connectionInfo.server,
                        vsphereUser: connectionInfo.user,
                        vspherePassword: connectionInfo.password
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.templates && data.templates.length > 0) {
                        updateStatusIndicator(templatesStatusEl, 'connected', `Templates (${data.templates.length} found)`);
                        connectionStatus.templates = 'connected';
                    } else {
                        updateStatusIndicator(templatesStatusEl, 'error', 'Templates (None found)');
                        connectionStatus.templates = 'error';
                        allTestsPassed = false;
                    }
                } else {
                    let errorMsg = `HTTP ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorData.message || errorMsg;
                    } catch (e) { /* Ignore parsing error */ }
                    throw new Error(errorMsg);
                }
            } catch (error) {
                console.error('Templates test failed:', error);
                updateStatusIndicator(templatesStatusEl, 'error', 'Templates (Failed)');
                connectionStatus.templates = 'error';
                allTestsPassed = false;
            }
            
        } catch (error) {
            console.error('Connection test error:', error);
            allTestsPassed = false;
        }
        
        // Re-enable test button
        testConnectionBtn.disabled = false;
        testConnectionBtn.innerHTML = '<i class="fas fa-plug"></i> Test vSphere Connection';
        
        // Show test results
        if (allTestsPassed) {
            console.log('All connection tests passed');
            showNotification('Connection test successful - All services are available', 'success');
        } else {
            console.log('Some connection tests failed');
            showNotification('Connection test completed with errors - Check status indicators', 'warning');
        }
        
        return allTestsPassed;
    }
    
    // Helper function to get vSphere connection info
    function getVSphereConnectionInfo() {
        if (window.globalSettings && window.globalSettings.vsphere) {
            const { server, user, password } = window.globalSettings.vsphere;
            if (server && user && password) {
                return { server, user, password };
            }
        }
        return null;
    }
    
    // Show notification message
    function showNotification(message, type = 'info') {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('connection-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'connection-notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 6px;
                color: white;
                font-weight: 500;
                z-index: 1000;
                max-width: 400px;
                transition: all 0.3s ease;
                opacity: 0;
                transform: translateX(100%);
            `;
            document.body.appendChild(notification);
        }
        
        // Set notification style based on type
        switch (type) {
            case 'success':
                notification.style.backgroundColor = 'var(--success-color)';
                break;
            case 'warning':
                notification.style.backgroundColor = 'var(--warning-color)';
                notification.style.color = '#333';
                break;
            case 'error':
                notification.style.backgroundColor = 'var(--danger-color)';
                break;
            default:
                notification.style.backgroundColor = 'var(--primary-color)';
        }
        
        // Set message and show
        notification.textContent = message;
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
        }, 5000);
    }
    
    // Update status when settings change
    function onSettingsChanged() {
        console.log('Settings changed, updating connection status...');
        
        const connectionInfo = getVSphereConnectionInfo();
        if (connectionInfo) {
            // Reset to unknown and test automatically
            updateStatusIndicator(vsphereStatusEl, 'unknown', 'vSphere');
            updateStatusIndicator(templatesStatusEl, 'unknown', 'Templates');
            updateStatusIndicator(infrastructureStatusEl, 'unknown', 'Infrastructure');
            
            // Auto-test connection after a short delay
            setTimeout(() => {
                testVSphereConnection();
            }, 1000);
        } else {
            // No credentials available
            updateStatusIndicator(vsphereStatusEl, 'error', 'vSphere (No Credentials)');
            updateStatusIndicator(templatesStatusEl, 'error', 'Templates (No Connection)');
            updateStatusIndicator(infrastructureStatusEl, 'error', 'Infrastructure (No Connection)');
        }
    }
    
    // Event listeners
    if (testConnectionBtn) {
        testConnectionBtn.addEventListener('click', testVSphereConnection);
    }
    
    // Listen for settings changes
    document.addEventListener('settingsLoaded', onSettingsChanged);
    document.addEventListener('settingsUpdated', onSettingsChanged);
    
    // Initial status check
    setTimeout(() => {
        const connectionInfo = getVSphereConnectionInfo();
        if (connectionInfo) {
            // Test connection automatically on page load if credentials are available
            testVSphereConnection();
        } else {
            onSettingsChanged(); // This will show "No Credentials" status
        }
    }, 2000); // Wait for other components to initialize
    
    // Export functions for other scripts to use
    window.connectionStatusManager = {
        testConnection: testVSphereConnection,
        updateStatus: updateStatusIndicator,
        getStatus: () => connectionStatus
    };
});
