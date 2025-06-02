// Helper module for executing govc commands from Node.js
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Path to the govc binary - use WSL for Windows environments
const GOVC_PATH = 'wsl /usr/local/bin/govc';

/**
 * Execute a govc command with the provided environment variables
 * @param {string} command - The govc command to execute (without the 'govc' prefix)
 * @param {object} env - Environment variables for govc (GOVC_URL, GOVC_USERNAME, GOVC_PASSWORD, etc.)
 * @returns {Promise<string>} - The command output on success
 */
function executeGovc(command, env = {}) {
    return new Promise((resolve, reject) => {
        // Build environment variable string for WSL - properly escape values
        const envVars = [];
        if (env.GOVC_URL) envVars.push(`GOVC_URL='${env.GOVC_URL}'`);
        if (env.GOVC_USERNAME) envVars.push(`GOVC_USERNAME='${env.GOVC_USERNAME}'`);
        if (env.GOVC_PASSWORD) envVars.push(`GOVC_PASSWORD='${env.GOVC_PASSWORD}'`);
        if (env.GOVC_INSECURE) envVars.push(`GOVC_INSECURE='${env.GOVC_INSECURE}'`);
        
        // Build the full command with environment variables for WSL
        const envString = envVars.join(' ');
        const fullCommand = `wsl bash -c "${envString} /usr/local/bin/govc ${command}"`;
        
        // Execute the command
        exec(fullCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`govc command error: ${error.message}`);
                console.error(`stderr: ${stderr}`);
                return reject(error);
            }
            
            if (stderr) {
                console.warn(`govc command warning: ${stderr}`);
            }
            
            resolve(stdout.trim());
        });
    });
}

/**
 * Parse govc list output into an array of objects with id and name
 * @param {string} output - The output from a govc command
 * @param {string} itemType - The type of item (datacenter, cluster, etc.)
 * @returns {Array<{id: string, name: string}>} - Parsed items
 */
function parseGovcOutput(output, itemType) {
    // Split output by lines and filter empty lines
    const lines = output.split('\n').filter(line => line.trim() !== '');
    
    // Map each line to an object with id and name
    return lines.map((line, index) => {
        // Extract the name from the path (last segment)
        const name = line.trim().split('/').pop();
        return {
            id: `${itemType}-${index + 1}`,
            name: name || line.trim() // Fallback to full line if name extraction fails
        };
    });
}

/**
 * Create standard environment variables for govc from connection details
 * @param {object} connectionDetails - Connection details (server, user, password)
 * @returns {object} - Environment variables for govc
 */
function createGovcEnv(connectionDetails) {
    // Handle domain usernames properly - ensure single backslash for domain\username format
    let username = connectionDetails.user;
    if (username.includes('\\\\')) {
        // Convert double backslash (from JSON) to single backslash for GOVC
        username = username.replace('\\\\', '\\');
    }
    
    // Build URL - try multiple formats based on what govc expects
    let server = connectionDetails.server;
    
    // Ensure https protocol
    if (!server.startsWith('https://') && !server.startsWith('http://')) {
        server = `https://${server}`;
    }
    
    // For govc, try the simple server URL first (without /sdk)
    let url = server;
    
    return {
        GOVC_URL: url,
        GOVC_USERNAME: username,
        GOVC_PASSWORD: connectionDetails.password,
        GOVC_INSECURE: '1' // Skip certificate verification
    };
}

/**
 * Get a list of datacenters
 * @param {object} connectionDetails - Connection details (server, user, password)
 * @returns {Promise<Array<{id: string, name: string}>>} - List of datacenters
 */
async function getDatacenters(connectionDetails) {
    // Try multiple URL and username formats including plain server names
    const formats = [
        // Format 1: Plain server name (no protocol)
        {
            protocol: '',
            urlSuffix: '',
            user: connectionDetails.user
        },
        // Format 2: Plain server name with /sdk
        {
            protocol: '',
            urlSuffix: '/sdk',
            user: connectionDetails.user
        },
        // Format 3: https with no /sdk
        {
            protocol: 'https://',
            urlSuffix: '',
            user: connectionDetails.user
        },
        // Format 4: https with /sdk
        {
            protocol: 'https://',
            urlSuffix: '/sdk',
            user: connectionDetails.user
        },
        // Format 5: Plain server + username without domain
        {
            protocol: '',
            urlSuffix: '',
            user: connectionDetails.user.split('\\').pop()
        },
        // Format 6: Plain server + /sdk + username without domain
        {
            protocol: '',
            urlSuffix: '/sdk',
            user: connectionDetails.user.split('\\').pop()
        },
        // Format 7: https + username without domain
        {
            protocol: 'https://',
            urlSuffix: '',
            user: connectionDetails.user.split('\\').pop()
        },
        // Format 8: https + /sdk + username without domain
        {
            protocol: 'https://',
            urlSuffix: '/sdk',
            user: connectionDetails.user.split('\\').pop()
        },
        // Format 9: Plain server + user@domain
        {
            protocol: '',
            urlSuffix: '',
            user: (() => {
                const parts = connectionDetails.user.split('\\');
                return parts.length === 2 ? `${parts[1]}@${parts[0]}` : connectionDetails.user;
            })()
        },
        // Format 10: https + user@domain
        {
            protocol: 'https://',
            urlSuffix: '',
            user: (() => {
                const parts = connectionDetails.user.split('\\');
                return parts.length === 2 ? `${parts[1]}@${parts[0]}` : connectionDetails.user;
            })()
        }
    ];

    for (let i = 0; i < formats.length; i++) {
        const format = formats[i];
        
        try {
            // Build URL with current format
            let server = connectionDetails.server;
            
            // Apply protocol if specified
            if (format.protocol) {
                if (!server.startsWith('https://') && !server.startsWith('http://')) {
                    server = format.protocol + server;
                }
            }
            
            // Add suffix
            server += format.urlSuffix;
            
            const env = {
                GOVC_URL: server,
                GOVC_USERNAME: format.user,
                GOVC_PASSWORD: connectionDetails.password,
                GOVC_INSECURE: '1'
            };
            
            const output = await executeGovc('ls', env);
            return parseGovcOutput(output, 'datacenter');
            
        } catch (error) {
            // If this is the last format, throw the error
            if (i === formats.length - 1) {
                throw error;
            }
        }
    }
}

/**
 * Get a list of clusters for a datacenter
 * @param {object} connectionDetails - Connection details (server, user, password)
 * @param {string} datacenter - Datacenter name
 * @returns {Promise<Array<{id: string, name: string}>>} - List of clusters
 */
async function getClusters(connectionDetails, datacenter) {
    try {
        if (!datacenter) {
            throw new Error('Datacenter name is required');
        }
        
        const env = createGovcEnv(connectionDetails);
        const output = await executeGovc(`find -type c -dc="${datacenter}"`, env);
        return parseGovcOutput(output, 'cluster');
    } catch (error) {
        console.error(`Error fetching clusters for datacenter ${datacenter}:`, error);
        throw error;
    }
}

/**
 * Get a list of datastore clusters for a cluster
 * @param {object} connectionDetails - Connection details (server, user, password)
 * @param {string} cluster - Cluster name
 * @param {string} datacenter - Datacenter name (required for vSphere 8.0.3+)
 * @returns {Promise<Array<{id: string, name: string}>>} - List of datastore clusters
 */
async function getDatastoreClusters(connectionDetails, cluster, datacenter = null) {
    try {
        if (!cluster) {
            throw new Error('Cluster name is required');
        }
        
        if (!datacenter) {
            throw new Error('Datacenter name is required for datastore cluster lookup in vSphere 8.0.3+');
        }
        
        const env = createGovcEnv(connectionDetails);
        
        // Use datastore.cluster.info command for vSphere 8.0.3+
        // The -type sp parameter is not supported in this version
        let command = 'datastore.cluster.info';
        if (datacenter) {
            command += ` -dc="${datacenter}"`;
        }
        
        const output = await executeGovc(command, env);
        
        // Parse the output to extract datastore cluster names
        // datastore.cluster.info format is different from find command
        let parsedOutput = [];
        if (output) {
            const lines = output.split('\n').filter(line => line.trim() !== '');
            let currentName = null;
            
            // Process the output format of datastore.cluster.info
            for (const line of lines) {
                // Look for the name line (in format "Name: cluster-name")
                if (line.trim().startsWith('Name:')) {
                    currentName = line.trim().substring(5).trim();
                    if (currentName) {
                        parsedOutput.push({
                            id: `datastore-cluster-${parsedOutput.length + 1}`,
                            name: currentName
                        });
                    }
                }
            }
        }
        
        return parsedOutput;
    } catch (error) {
        console.error(`Error fetching datastore clusters for cluster ${cluster} in datacenter ${datacenter}:`, error);
        throw error;
    }
}

/**
 * Get a list of distributed port groups with VLAN IDs
 * @param {object} connectionDetails - Connection details (server, user, password)
 * @param {string} cluster - Cluster name
 * @param {string} datacenter - Datacenter name (optional, will try to find if not provided)
 * @returns {Promise<Array<{id: string, name: string}>>} - List of distributed port groups with VLAN IDs
 */
async function getNetworks(connectionDetails, cluster, datacenter = null) {
    try {
        if (!cluster) {
            throw new Error('Cluster name is required');
        }
        
        const env = createGovcEnv(connectionDetails);
        
        // Use find -type n to get all networks, we'll parse them later
        let command = 'find -type n';
        if (datacenter) {
            command += ` -dc="${datacenter}"`;
        }
        
        const output = await executeGovc(command, env);
        
        // Parse all networks from find -type n output
        const networks = [];
        
        if (output) {
            const lines = output.split('\n').filter(line => line.trim() !== '');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const name = line.split('/').pop();
                
                if (name) {
                    // Check if name contains a pattern that might indicate a VLAN ID
                    const vlanMatch = name.match(/\-(\d{2,4})\-/);
                    const vlanId = vlanMatch ? vlanMatch[1] : '';
                    
                    // Format as "portgroup-name (VLAN: ID)" if VLAN ID found
                    const displayName = vlanId ? `${name} (VLAN: ${vlanId})` : name;
                    
                    networks.push({
                        id: `network-${i+1}`,
                        name: displayName,
                        rawName: name,
                        vlanId: vlanId
                    });
                }
            }
        }
        
        return networks;
    } catch (error) {
        console.error(`Error fetching networks for cluster ${cluster}:`, error);
        throw error;
    }
}

/**
 * Get VM templates efficiently - only searches for VMs marked as templates
 * @param {object} connectionDetails - Connection details (server, user, password)
 * @param {string} datacenter - Datacenter name (optional, will try to find if not provided)  
 * @returns {Promise<Array<{id: string, name: string, path: string, guestId: string, guestFullName: string}>>} - List of VM templates with guest OS information
 */
async function getVmTemplates(connectionDetails, datacenter = null) {
    try {
        const env = createGovcEnv(connectionDetails);
        const templates = [];
        
        // Method 1: Use find with template config filter - most efficient
        // This directly finds VMs where config.template = true
        try {
            let findCommand = 'find / -type m -config.template true';
            if (datacenter) {
                findCommand = `find /${datacenter} -type m -config.template true`;
            }
            
            const findOutput = await executeGovc(findCommand, env);
            
            if (findOutput && findOutput.trim()) {
                const templatePaths = findOutput.split('\n').filter(line => line.trim() !== '');
                
                // Get detailed information for each template including guest ID
                if (templatePaths.length > 0) {
                    // Process in batches to avoid command line length limits
                    const batchSize = 10;
                    for (let i = 0; i < templatePaths.length; i += batchSize) {
                        const batch = templatePaths.slice(i, i + batchSize);
                        try {
                            const infoCommand = `vm.info -json ${batch.map(p => `"${p}"`).join(' ')}`;
                            const infoOutput = await executeGovc(infoCommand, env);
                            
                            if (infoOutput && infoOutput.trim()) {
                                const vmData = JSON.parse(infoOutput);
                                const vmArray = Array.isArray(vmData.virtualMachines) ? vmData.virtualMachines : [vmData.virtualMachines].filter(Boolean);
                                
                                vmArray.forEach((vm, vmIndex) => {
                                    if (vm && vm.config) {
                                        const name = vm.config.name || batch[vmIndex].split('/').pop();
                                        const guestId = vm.config.guestId || 'otherGuest';
                                        const guestFullName = vm.config.guestFullName || 'Unknown Guest OS';
                                        
                                        templates.push({
                                            id: `template-${templates.length + 1}`,
                                            name: name,
                                            path: batch[vmIndex],
                                            guestId: guestId,
                                            guestFullName: guestFullName
                                        });
                                    }
                                });
                            }
                        } catch (error) {
                            console.warn(`Failed to get template details for batch starting at index ${i}: ${error.message}`);
                            // Fallback: add templates without guest ID info
                            batch.forEach((path, batchIndex) => {
                                const name = path.split('/').pop();
                                if (name && name.trim() !== '') {
                                    templates.push({
                                        id: `template-${templates.length + 1}`,
                                        name: name,
                                        path: path,
                                        guestId: 'otherGuest',
                                        guestFullName: 'Unknown Guest OS'
                                    });
                                }
                            });
                        }
                    }
                }
                
                if (templates.length > 0) {
                    return templates;
                }
            }
        } catch (error) {
            console.warn('Template search with config.template filter failed:', error.message);
        }
        
        // Method 2: Fallback - Use find for powered off VMs and batch check template property
        // This is less efficient but works with older govc versions
        try {
            let findCommand = 'find / -type m -runtime.powerState poweredOff';
            if (datacenter) {
                findCommand = `find /${datacenter} -type m -runtime.powerState poweredOff`;
            }
            
            const findOutput = await executeGovc(findCommand, env);
            
            if (findOutput && findOutput.trim()) {
                const vmPaths = findOutput.split('\n').filter(line => line.trim() !== '');
                
                if (vmPaths.length > 0) {
                    // Process in batches to avoid command line length limits
                    const batchSize = 10;
                    for (let i = 0; i < vmPaths.length; i += batchSize) {
                        const batch = vmPaths.slice(i, i + batchSize);
                        try {
                            const infoCommand = `vm.info -json ${batch.map(p => `"${p}"`).join(' ')}`;
                            const infoOutput = await executeGovc(infoCommand, env);
                            
                            if (infoOutput && infoOutput.trim()) {
                                const vmData = JSON.parse(infoOutput);
                                const vmArray = Array.isArray(vmData.virtualMachines) ? vmData.virtualMachines : [vmData.virtualMachines].filter(Boolean);
                                
                                vmArray.forEach((vm, vmIndex) => {
                                    if (vm && vm.config && vm.config.template === true) {
                                        const name = vm.config.name || batch[vmIndex].split('/').pop();
                                        const guestId = vm.config.guestId || 'otherGuest';
                                        const guestFullName = vm.config.guestFullName || 'Unknown Guest OS';
                                        
                                        templates.push({
                                            id: `template-${templates.length + 1}`,
                                            name: name,
                                            path: batch[vmIndex],
                                            guestId: guestId,
                                            guestFullName: guestFullName
                                        });
                                    }
                                });
                            }
                        } catch (error) {
                            console.warn(`Failed to check template batch starting at index ${i}: ${error.message}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Fallback template search failed:', error.message);
        }
        
        return templates;
        
    } catch (error) {
        console.error('Error fetching VM templates:', error.message);
        throw error;
    }
}

/**
 * Test connection to vSphere
 * @param {object} connectionDetails - Connection details (server, user, password)
 * @returns {Promise<boolean>} - True if connection is successful
 */
async function testConnection(connectionDetails) {
    try {
        const env = createGovcEnv(connectionDetails);
        await executeGovc('about', env);
        return true;
    } catch (error) {
        console.error('vSphere connection test failed:', error);
        return false;
    }
}

// Export the functions
module.exports = {
    executeGovc,
    parseGovcOutput,
    createGovcEnv,
    getDatacenters,
    getClusters,
    getDatastoreClusters,
    getNetworks,
    getVmTemplates,
    testConnection
};
