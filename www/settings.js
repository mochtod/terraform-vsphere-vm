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
  lastUpdated: new Date().toISOString()
};

// Initialize settings file if it doesn't exist
function initializeSettings() {
  if (!fs.existsSync(SETTINGS_FILE_PATH)) {
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    console.log('Settings file initialized with default values');
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
    const updatedSettings = {
      ...currentSettings,
      ...newSettings,
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(updatedSettings, null, 2));
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
