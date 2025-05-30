// Host Group Management for Satellite Integration
document.addEventListener('DOMContentLoaded', function() {
    const templateSelect = document.getElementById('vm_template');
    const guestIdInput = document.getElementById('vm_guest_id');
    const hostGroupSection = document.getElementById('host-group-section');
    const hostGroupSelect = document.getElementById('vm_host_group');
    
    let hostGroups = [];
    let hostGroupsLoaded = false;    // Load host groups from Satellite API
    async function loadHostGroups() {
        if (hostGroupsLoaded) return;
        
        try {
            if (window.satelliteApi) {
                hostGroups = await window.satelliteApi.getHostGroups();
                populateHostGroupSelect();
                hostGroupsLoaded = true;
                clearHostGroupError();
            }
        } catch (error) {
            console.error('Error loading host groups:', error);
            showHostGroupError(error.message);
            // Clear the dropdown and disable it
            hostGroupSelect.innerHTML = '<option value="">Error loading host groups</option>';
            hostGroupSelect.disabled = true;
        }
    }

    // Show error message for host group loading
    function showHostGroupError(message) {
        let errorDiv = document.getElementById('host-group-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'host-group-error';
            errorDiv.className = 'error-message';
            hostGroupSection.appendChild(errorDiv);
        }
        errorDiv.textContent = `CHR Satellite Error: ${message}`;
        errorDiv.style.color = '#ff6b6b';
        errorDiv.style.fontSize = '12px';
        errorDiv.style.marginTop = '5px';
    }

    // Clear error message
    function clearHostGroupError() {
        const errorDiv = document.getElementById('host-group-error');
        if (errorDiv) {
            errorDiv.remove();
        }
        hostGroupSelect.disabled = false;
    }

    // Populate host group select dropdown
    function populateHostGroupSelect() {
        hostGroupSelect.innerHTML = '<option value="">Select Host Group</option>';
        
        hostGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.name;
            option.textContent = group.name;
            hostGroupSelect.appendChild(option);
        });
    }

    // Check if template is Linux based
    function isLinuxTemplate(guestId) {
        if (!guestId) return false;
        
        const linuxIndicators = ['rhel', 'centos', 'ubuntu', 'suse', 'debian', 'linux'];
        return linuxIndicators.some(indicator => 
            guestId.toLowerCase().includes(indicator)
        );
    }

    // Show/hide host group section based on template selection
    function updateHostGroupVisibility() {
        const selectedTemplate = templateSelect.options[templateSelect.selectedIndex];
        const guestId = selectedTemplate?.dataset?.guestId || guestIdInput.value;
        
        if (isLinuxTemplate(guestId)) {
            hostGroupSection.style.display = 'block';
            hostGroupSelect.required = true;
            
            // Load host groups if not already loaded
            if (!hostGroupsLoaded) {
                loadHostGroups();
            }
        } else {
            hostGroupSection.style.display = 'none';
            hostGroupSelect.required = false;
            hostGroupSelect.value = '';
        }
    }

    // Event listeners
    templateSelect.addEventListener('change', function() {
        updateHostGroupVisibility();
        
        // Update guest ID if template has it
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption.dataset.guestId) {
            guestIdInput.value = selectedOption.dataset.guestId;
        }
    });

    guestIdInput.addEventListener('input', function() {
        updateHostGroupVisibility();
    });

    // Initialize host group visibility on page load
    setTimeout(() => {
        updateHostGroupVisibility();
    }, 500);

    // Load host groups when settings are updated
    document.addEventListener('settingsLoaded', function() {
        hostGroupsLoaded = false;
        loadHostGroups();
    });
});
