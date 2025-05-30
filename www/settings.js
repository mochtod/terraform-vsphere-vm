// Settings management for the TerraSphere application
const fs = require('fs');
const path = require('path');

// Path to the settings file
const SETTINGS_FILE_PATH = path.join(__dirname, 'global_settings.json');

// Default settings
const DEFAULT_SETTINGS = {
  vsphere: {
    user: "chr\\mochtodpa",
    server: "virtualcenter.chrobinson.com",
    // No default password for security reasons
  },
  netbox: {
    url: "https://netbox.chrobinson.com",
    token: "",
    prefix_id: "1292"
  },
  aap: {
    api_url: "https://ansibleaap.chrobinson.com",
    api_token: ""
  },
  satellite: {
    chr_api_server: "http://your-api-server:8000",
    url: "https://satellite.chrobinson.com",
    username: "",
    password: ""
  },
  lastUpdated: new Date().toISOString()
};

// Initialize settings file if it doesn't exist
function initializeSettings() {
  if (!fs.existsSync(SETTINGS_FILE_PATH)) {
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    console.log('Settings file initialized with default values');
  } else {
    // File exists, but ensure it has all required structure fields
    try {
      const currentSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE_PATH, 'utf8'));
      let needsUpdate = false;
        // Check for missing top-level sections and add them if needed
      for (const section of ['vsphere', 'netbox', 'aap', 'satellite']) {
        if (!currentSettings[section]) {
          currentSettings[section] = DEFAULT_SETTINGS[section];
          needsUpdate = true;
          console.log(`Added missing section '${section}' to settings`);
        }
      }
      
      // Ensure AAP section has all required fields
      if (currentSettings.aap) {
        if (!currentSettings.aap.api_url) {
          currentSettings.aap.api_url = DEFAULT_SETTINGS.aap.api_url;
          needsUpdate = true;
          console.log('Added missing AAP API URL to settings');
        }
        
        if (!currentSettings.aap.api_token) {
          currentSettings.aap.api_token = DEFAULT_SETTINGS.aap.api_token;
          needsUpdate = true;
          console.log('Added missing AAP API token to settings');
        }
      }
      
      // Update file if changes were made
      if (needsUpdate) {
        currentSettings.lastUpdated = new Date().toISOString();
        fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(currentSettings, null, 2));
        console.log('Updated settings file with missing fields');
      }
    } catch (error) {
      console.error('Error reading or updating settings file:', error);
      // Don't overwrite existing file in case of error
    }
  }
}

// Get current settings
function getSettings() {
  try {
    initializeSettings();
    const settingsData = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
    return JSON.parse(settingsData);
  } catch (error) {
    console.error('Error reading settings file:', error);
    return DEFAULT_SETTINGS;
  }
}

// Update settings
function updateSettings(newSettings) {
  try {
    const currentSettings = getSettings();
    let updatedSettings = {
      ...currentSettings,
      lastUpdated: new Date().toISOString()
    };
    
    // Deep merge for nested objects
    if (newSettings.vsphere) {
      updatedSettings.vsphere = { ...currentSettings.vsphere, ...newSettings.vsphere };
    }
    
    if (newSettings.netbox) {
      updatedSettings.netbox = { ...currentSettings.netbox, ...newSettings.netbox };
    }
    
    if (newSettings.aap) {
      updatedSettings.aap = { ...currentSettings.aap, ...newSettings.aap };
    }
    
    if (newSettings.satellite) {
      updatedSettings.satellite = { ...currentSettings.satellite, ...newSettings.satellite };
    }
    
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(updatedSettings, null, 2));
    console.log('Settings updated successfully');
    return updatedSettings;
  } catch (error) {
    console.error('Error updating settings file:', error);
    throw error;
  }
}

// Export functions
module.exports = {
  getSettings,
  updateSettings,
  initializeSettings
};
