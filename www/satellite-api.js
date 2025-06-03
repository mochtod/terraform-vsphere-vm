// Satellite API client for CHR registration and Ansible automation
class SatelliteApi {
  constructor() {
    this.getChrApiServer = () => {
      if (window.globalSettings && window.globalSettings.satellite) {
        return window.globalSettings.satellite.url || 'https://satellite.chrobinson.com';
      }
      return 'https://satellite.chrobinson.com';
    };
    
    this.getSatelliteUrl = () => {
      if (window.globalSettings && window.globalSettings.satellite) {
        return window.globalSettings.satellite.url || 'https://satellite.chrobinson.com';
      }
      return 'https://satellite.chrobinson.com';
    };
    
    this.getApiUrl = () => {
      return this.getSatelliteUrl() + '/api/v2';
    };
    
    this.getCredentials = () => {
      if (window.globalSettings && window.globalSettings.satellite) {
        return {
          username: window.globalSettings.satellite.username || '',
          password: window.globalSettings.satellite.password || ''
        };
      }
      return { username: '', password: '' };
    };
  }

  /**
   * Fetch available host groups from CHR Satellite
   * Throws error if CHR Satellite API is unavailable or misconfigured
   */
  async getHostGroups() {
    try {
      const response = await fetch('/api/satellite/host-groups');
      const data = await response.json();
      
      if (data.success) {
        return data.hostGroups;
      } else {
        throw new Error(data.error || 'Failed to fetch host groups from CHR Satellite');
      }
    } catch (error) {
      console.error('Error fetching host groups:', error);
      throw error; // Re-throw to let calling code handle the error
    }
  }  /**
   * Generate CHR registration command using server endpoint
   */
  async generateCHRRegistrationCommand(hostGroup, hostname) {
    try {
      const response = await fetch('/api/satellite/registration-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hostGroup: hostGroup,
          hostname: hostname
        })
      });

      const data = await response.json();
      
      if (data.success) {
        return data.command;
      } else {
        throw new Error(data.error || 'Failed to generate CHR registration command');
      }
    } catch (error) {
      console.error('Error generating CHR registration command:', error);
      throw error;
    }
  }

  /**
   * Check VM health status via CHR Satellite API
   * Returns error status if not implemented
   */
  async checkVMHealth(hostname) {
    try {
      const response = await fetch('/api/satellite/vm-health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vmName: hostname
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        return data.health;
      } else {
        throw new Error(data.error || 'VM health check failed');
      }
    } catch (error) {
      console.error('Error checking VM health:', error);
      throw error;
    }
  }  /**
   * Fetch available Ansible job templates from CHR Satellite
   * Throws error if not implemented or unavailable
   */
  async getAvailableAnsibleJobs() {
    try {
      const response = await fetch('/api/satellite/ansible-jobs');
      const data = await response.json();
      
      if (data.success) {
        return data.jobs;
      } else {
        throw new Error(data.error || 'Failed to fetch Ansible jobs from CHR Satellite');
      }
    } catch (error) {
      console.error('Error fetching Ansible jobs:', error);
      throw error;
    }
  }  /**
   * Execute an Ansible job via CHR Satellite
   */
  async runAnsibleJob(jobId, hostname) {
    try {
      const response = await fetch(`/api/satellite/ansible-job/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vmName: hostname
        })
      });

      const data = await response.json();
      
      if (data.success) {
        return data.result;
      } else {
        throw new Error(data.error || 'Failed to run Ansible job');
      }
    } catch (error) {
      console.error('Error running Ansible job:', error);
      throw error;
    }
  }

  /**
   * Register VM with CHR Satellite
   */
  async registerVM(hostname, hostGroup) {
    try {
      const response = await fetch('/api/satellite/register-vm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hostname: hostname,
          hostGroup: hostGroup
        })
      });

      const data = await response.json();
      
      if (data.success) {
        return data;
      } else {
        throw new Error(data.error || 'Failed to register VM with CHR Satellite');
      }
    } catch (error) {
      console.error('Error registering VM:', error);
      throw error;
    }
  }

  /**
   * Notify CHR API of deployment completion
   */
  async notifyDeploymentComplete(hostname, hostGroup) {
    try {
      const apiUrl = this.getApiUrl();
      const response = await fetch(`${apiUrl}/chr/notify-deployment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hostname: hostname,
          hostgroup: hostGroup,
          status: 'ready'
        })
      });

      if (!response.ok) {
        console.warn('Failed to notify CHR API of deployment completion');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error notifying deployment completion:', error);
      return false;
    }
  }

  /**
   * Template detection utilities
   */
  isLinuxTemplate(guestId) {
    if (!guestId) return false;
    const linuxIndicators = ['rhel', 'centos', 'ubuntu', 'suse', 'debian', 'linux'];
    return linuxIndicators.some(indicator => 
      guestId.toLowerCase().includes(indicator)
    );
  }

  isWindowsTemplate(guestId) {
    if (!guestId) return false;
    return guestId.toLowerCase().includes('windows');
  }
}

// Create a single instance to be used across the application
window.satelliteApi = new SatelliteApi();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SatelliteApi;
}
