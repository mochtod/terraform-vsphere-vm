/**
 * VSphere SOAP Client Patch for SSL/TLS Certificate Validation Issues
 * 
 * This file patches the node-vsphere-soap module to accept self-signed certificates.
 * It should be loaded before any other imports that use the vSphere SOAP client.
 */

// Set global Node.js TLS settings to ignore certificate validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Attempt to monkey patch the request module used by soap
try {
  // Try to load the request module used by soap
  const request = require('request');
  const originalRequest = request.Request.prototype.init;
  
  // Override the init method to modify SSL settings
  request.Request.prototype.init = function(...args) {
    // Call original init
    const result = originalRequest.apply(this, args);
    
    // Modify request options to ignore SSL certificate errors
    if (this.options) {
      this.options.rejectUnauthorized = false;
      this.options.strictSSL = false;
      
      if (this.options.agentOptions) {
        this.options.agentOptions.rejectUnauthorized = false;
      } else {
        this.options.agentOptions = { rejectUnauthorized: false };
      }
    }
    
    return result;
  };
  
  console.log('[SSL] Successfully patched request module for SOAP client');
} catch (err) {
  console.warn('[SSL] Could not patch request module:', err.message);
}

// Patch https module
try {
  const https = require('https');
  const http = require('http');
  
  // Set globalAgent to ignore certificate validation
  https.globalAgent.options.rejectUnauthorized = false;
  
  console.log('[SSL] Successfully patched Node.js HTTPS module');
} catch (err) {
  console.warn('[SSL] Could not patch HTTPS module:', err.message);
}

// Attempt to intercept any other TLS/SSL connections
try {
  const tls = require('tls');
  const originalConnect = tls.connect;
  
  // Override TLS connect to disable certificate validation
  tls.connect = function(...args) {
    let options = args[0];
    
    // If options is not an object (e.g., it's a port number), convert to options object
    if (typeof options !== 'object') {
      options = args[1] || {};
      args[1] = options;
    } else {
      // Ensure we modify the original options object
      options = args[0];
    }
    
    // Disable certificate validation
    options.rejectUnauthorized = false;
    
    return originalConnect.apply(this, args);
  };
  
  console.log('[SSL] Successfully patched Node.js TLS module');
} catch (err) {
  console.warn('[SSL] Could not patch TLS module:', err.message);
}

console.log('[SSL] VSphere SOAP SSL certificate patch loaded');
