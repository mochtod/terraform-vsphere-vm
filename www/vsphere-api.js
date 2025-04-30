// vSphere API endpoints for the TerraSphere application
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Directory for storing temporary files
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Endpoint to connect to vSphere and get VMs information using govc
router.post('/vms', async (req, res) => {
    try {
        const { vsphereServer, vsphereUser, vspherePassword } = req.body;
        
        if (!vsphereServer || !vsphereUser || !vspherePassword) {
            return res.status(400).json({
                success: false,
                error: 'Missing vSphere connection details'
            });
        }
        
        // Create a temporary script to run govc commands
        const scriptPath = path.join(TEMP_DIR, `get_vms_${Date.now()}.sh`);
        
        // Create bash script to actually connect to vSphere and get real VM information
        const bashScript = `#!/bin/bash
# Script to connect to vSphere and retrieve VM data

# Set vSphere connection environment variables
export GOVC_URL="https://${vsphereServer}/sdk"
export GOVC_USERNAME="${vsphereUser}"
export GOVC_PASSWORD="${vspherePassword}"
export GOVC_INSECURE=true  # Skip SSL verification

# Check if govc is installed
if ! command -v govc &> /dev/null; then
    echo '{"success": false, "error": "govc tool is not installed on the server"}' >&2
    exit 1
fi

# Get all virtual machines
echo "["
first=true
govc find . -type m | while read -r vm_path; do
    vm_name=$(basename "$vm_path")
    
    if [ "$first" = true ]; then
        first=false
    else
        echo ","
    fi
    
    # Get VM properties
    vm_info=$(govc vm.info -json "$vm_path" 2>/dev/null)
    if [ $? -ne 0 ]; then
        continue  # Skip if we can't get info for this VM
    fi
    
    # Extract VM properties
    power_state=$(echo "$vm_info" | jq -r '.VirtualMachines[0].Runtime.PowerState' 2>/dev/null || echo "unknown")
    guest_id=$(echo "$vm_info" | jq -r '.VirtualMachines[0].Config.GuestId' 2>/dev/null || echo "unknown")
    guest_full_name=$(echo "$vm_info" | jq -r '.VirtualMachines[0].Config.GuestFullName' 2>/dev/null || echo "unknown")
    num_cpu=$(echo "$vm_info" | jq -r '.VirtualMachines[0].Config.Hardware.NumCPU' 2>/dev/null || echo 0)
    memory_mb=$(echo "$vm_info" | jq -r '.VirtualMachines[0].Config.Hardware.MemoryMB' 2>/dev/null || echo 0)
    guest_ip=$(echo "$vm_info" | jq -r '.VirtualMachines[0].Guest.IpAddress' 2>/dev/null || echo "")
    
    # Construct the VM JSON object
    cat << EOF
    {
      "Name": "$(echo "$vm_name" | sed 's/"/\\"/g')",
      "Path": "$(echo "$vm_path" | sed 's/"/\\"/g')",
      "NumCpu": $num_cpu,
      "MemoryMB": $memory_mb,
      "PowerState": "$(echo "$power_state" | sed 's/"/\\"/g')",
      "GuestId": "$(echo "$guest_id" | sed 's/"/\\"/g')",
      "GuestFullName": "$(echo "$guest_full_name" | sed 's/"/\\"/g')",
      "GuestIPAddress": "$(echo "$guest_ip" | sed 's/"/\\"/g')"
    }
EOF
done
echo "]"
`;

        fs.writeFileSync(scriptPath, bashScript);
        fs.chmodSync(scriptPath, '755'); // Set executable permission
        
        console.log(`Created bash script at ${scriptPath}`);
        
        // Execute the bash script
        exec(`bash "${scriptPath}"`, (error, stdout, stderr) => {
            // Delete the temporary script
            try {
                fs.unlinkSync(scriptPath);
                console.log(`Cleaned up bash script: ${scriptPath}`);
            } catch (unlinkError) {
                console.error(`Error cleaning up script: ${unlinkError.message}`);
            }
            
            if (error) {
                console.error(`Error connecting to vSphere: ${error.message}`);
                console.error(`stderr: ${stderr}`);
                
                return res.status(500).json({
                    success: false,
                    error: `Error connecting to vSphere: ${error.message}`
                });
            }
            
            try {
                // Check if the output starts with "Error:"
                if (stdout.includes('"error":')) {
                    const errorMatch = stdout.match(/"error":\s*"([^"]*)"/);
                    const errorMessage = errorMatch ? errorMatch[1] : 'Unknown error';
                    
                    return res.status(500).json({
                        success: false,
                        error: `Error from vSphere: ${errorMessage}`
                    });
                }
                
                // Parse the JSON output from bash script
                const vms = JSON.parse(stdout);
                
                return res.json({
                    success: true,
                    vms: Array.isArray(vms) ? vms : [vms]
                });
            } catch (parseError) {
                console.error(`Error parsing vSphere response: ${parseError.message}`);
                console.error(`Raw output: ${stdout}`);
                
                return res.status(500).json({
                    success: false,
                    error: `Error parsing vSphere response: ${parseError.message}`
                });
            }
        });
    } catch (error) {
        console.error(`Error in /api/vsphere/vms endpoint: ${error.message}`);
        
        return res.status(500).json({
            success: false,
            error: `Server error: ${error.message}`
        });
    }
});

module.exports = router;
