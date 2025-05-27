// Helper module for executing govc commands from Node.js
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Path to the govc binary
const GOVC_PATH = '/usr/local/bin/govc';

/**
 * Execute a govc command with the provided environment variables
 * @param {string} command - The govc command to execute (without the 'govc' prefix)
 * @param {object} env - Environment variables for govc (GOVC_URL, GOVC_USERNAME, GOVC_PASSWORD, etc.)
 * @returns {Promise<string>} - The command output on success
 */
function executeGovc(command, env = {}) {
    return new Promise((resolve, reject) => {
        // Check if govc binary exists
        if (!fs.existsSync(GOVC_PATH)) {
            return reject(new Error(`govc binary not found at ${GOVC_PATH}`));
        }

        // Build the full command
        const fullCommand = `${GOVC_PATH} ${command}`;
        
        console.log(`Executing govc command: ${fullCommand}`);
        console.log(`GOVC_URL: ${env.GOVC_URL}`);
        console.log(`GOVC_USERNAME: ${env.GOVC_USERNAME}`);
        console.log(`GOVC_INSECURE: ${env.GOVC_INSECURE}`);
        
        // Execute the command with environment variables
        exec(fullCommand, { env: { ...process.env, ...env } }, (error, stdout, stderr) => {
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
    
    console.log(`Setting GOVC environment - URL: ${url}, Username: ${username}`);
    
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
        console.log(`Trying format ${i + 1}: Protocol="${format.protocol}", URL suffix="${format.urlSuffix}", Username="${format.user}"`);
        
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
            
            console.log(`Testing with URL: ${server}, Username: ${format.user}`);
            const output = await executeGovc('ls', env);
            console.log(`Success with format ${i + 1}!`);
            return parseGovcOutput(output, 'datacenter');
            
        } catch (error) {
            console.error(`Format ${i + 1} failed:`, error.message);
            
            // If this is the last format, throw the error
            if (i === formats.length - 1) {
                console.error('All authentication formats failed');
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
 * @param {string} datacenter - Datacenter name (optional, will try to find if not provided)
 * @returns {Promise<Array<{id: string, name: string}>>} - List of datastore clusters
 */
async function getDatastoreClusters(connectionDetails, cluster, datacenter = null) {
    try {
        if (!cluster) {
            throw new Error('Cluster name is required');
        }
        
        const env = createGovcEnv(connectionDetails);
        
        // First try to find all datastore clusters, then filter by cluster if needed
        let command = 'find -type s';
        if (datacenter) {
            command += ` -dc="${datacenter}"`;
        }
        
        const output = await executeGovc(command, env);
        
        // If we have a specific cluster, filter the results
        // Datastore clusters in vSphere are typically named with cluster association
        let filteredOutput = output;
        if (cluster && output) {
            const lines = output.split('\n').filter(line => line.trim() !== '');
            // For now, return all datastore clusters - in real vSphere environments,
            // datastore clusters can be shared across multiple compute clusters
            filteredOutput = lines.join('\n');
        }
        
        return parseGovcOutput(filteredOutput, 'datastore-cluster');
    } catch (error) {
        console.error(`Error fetching datastore clusters for cluster ${cluster}:`, error);
        throw error;
    }
}

/**
 * Get a list of networks for a cluster
 * @param {object} connectionDetails - Connection details (server, user, password)
 * @param {string} cluster - Cluster name
 * @param {string} datacenter - Datacenter name (optional, will try to find if not provided)
 * @returns {Promise<Array<{id: string, name: string}>>} - List of networks
 */
async function getNetworks(connectionDetails, cluster, datacenter = null) {
    try {
        if (!cluster) {
            throw new Error('Cluster name is required');
        }
        
        const env = createGovcEnv(connectionDetails);
        
        // Find all networks, optionally filtering by datacenter
        let command = 'find -type n';
        if (datacenter) {
            command += ` -dc="${datacenter}"`;
        }
        
        const output = await executeGovc(command, env);
        
        // Networks in vSphere are typically available across clusters within a datacenter
        // For now, return all networks - filtering by cluster association would require
        // additional logic to check which networks are actually available to the cluster
        return parseGovcOutput(output, 'network');
    } catch (error) {
        console.error(`Error fetching networks for cluster ${cluster}:`, error);
        throw error;
    }
}

/**
 * Get VM templates
 * @param {object} connectionDetails - Connection details (server, user, password)
 * @param {string} datacenter - Datacenter name (optional, will try to find if not provided)
 * @returns {Promise<Array<{id: string, name: string}>>} - List of VM templates
 */
async function getVmTemplates(connectionDetails, datacenter = null) {
    try {
        const env = createGovcEnv(connectionDetails);
        
        // Find all VMs, then we'll need to identify which ones are templates
        let command = 'find -type m';
        if (datacenter) {
            command += ` -dc="${datacenter}"`;
        }
        
        const output = await executeGovc(command, env);
        
        if (!output) {
            return [];
        }
        
        // Parse all VMs
        const allVms = parseGovcOutput(output, 'template');
        
        // For now, return all VMs as potential templates
        // In a real implementation, we'd need to check each VM's config to see if it's marked as a template
        // This could be done with additional govc vm.info calls for each VM
        // For now, we'll assume VMs in certain folders (like /Templates) are templates
        const templates = allVms.filter(vm => {
            const vmPath = output.split('\n')[allVms.indexOf(vm)];
            return vmPath && (
                vmPath.toLowerCase().includes('template') ||
                vmPath.toLowerCase().includes('/vm/') // Common template folder
            );
        });
        
        return templates.length > 0 ? templates : allVms; // Fallback to all VMs if no obvious templates
    } catch (error) {
        console.error('Error fetching VM templates:', error);
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
