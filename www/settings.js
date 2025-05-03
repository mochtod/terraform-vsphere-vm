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
  lastUpdated: new Date().toISOString()
};

// Validate vSphere settings before using them
function validateVSphereSettings(settings) {
  if (!settings.vsphere || !settings.vsphere.server || !settings.vsphere.user || !settings.vsphere.password) {
    throw new Error('vSphere settings are incomplete. Please configure the server, user, and password.');
  }
}

// Initialize settings file if it doesn't exist
function initializeSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE_PATH)) {
      console.log('Settings file not found. Creating a new one with default settings.');
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2));
      return;
    }

    const fileData = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
    let currentSettings;

    try {
      currentSettings = JSON.parse(fileData);
    } catch (parseError) {
      console.error('Settings file is invalid. Recreating with default settings.');
      currentSettings = DEFAULT_SETTINGS;
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2));
      return;
    }

    let needsUpdate = false;

    // Ensure all required fields are present
    for (const section in DEFAULT_SETTINGS) {
      if (!currentSettings[section]) {
        currentSettings[section] = DEFAULT_SETTINGS[section];
        needsUpdate = true;
        console.log(`Added missing section: ${section}`);
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

    // Validate vSphere settings
    validateVSphereSettings(currentSettings);
  } catch (error) {
    console.error('Error initializing settings file:', error.message);
    throw error;
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
