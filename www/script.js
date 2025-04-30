// Main JavaScript for Terraform vSphere VM Provisioning Web App

document.addEventListener('DOMContentLoaded', function() {
    // Tab switching functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons and panels
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            // Add active class to clicked button and corresponding panel
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`${tabId}-output`).classList.add('active');
        });
    });

    // Generate tfvars file from form input
    function generateTfvars() {
        const form = document.getElementById('vm-form');
        const formData = new FormData(form);
        
        let tfvarsContent = `# Generated Terraform variables file\n`;
        tfvarsContent += `# ${new Date().toISOString().split('T')[0]}\n\n`;
        
        // Add all form fields except password
        for (const [key, value] of formData.entries()) {
            if (key !== 'vsphere_password') {
                tfvarsContent += `${key} = "${value}"\n`;
            }
        }
        
        // Add password comment
        tfvarsContent += `# vsphere_password should be set as an environment variable TF_VAR_vsphere_password for security\n`;
        
        // Display in the output area
        document.getElementById('tfvars-code').textContent = tfvarsContent;
        
        return tfvarsContent;
    }

    // Update tfvars display when any form field changes
    const formInputs = document.querySelectorAll('#vm-form input, #vm-form select');
    formInputs.forEach(input => {
        input.addEventListener('change', generateTfvars);
    });

    // Generate tfvars on page load
    generateTfvars();

    // Handle the Plan button click
    document.getElementById('plan-button').addEventListener('click', function() {
        const planOutput = document.getElementById('plan-code');
        
        // Show loading state
        planOutput.textContent = "Running terraform plan...\nThis would normally connect to your Terraform backend and execute the plan command.\n\nFor demonstration purposes, here's what would happen:\n";
        
        // Show the plan tab
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        document.querySelector('[data-tab="plan"]').classList.add('active');
        document.getElementById('plan-output').classList.add('active');
        
        // Simulate a plan operation
        setTimeout(() => {
            const vmName = document.getElementById('vm_name').value;
            const cpuCount = document.getElementById('vm_cpu').value;
            const memoryMB = document.getElementById('vm_memory').value;
            const diskGB = document.getElementById('vm_disk_size').value;
            
            planOutput.textContent += `
Terraform used the selected providers to generate the following execution plan:

# vsphere_virtual_machine.vm will be created
+ resource "vsphere_virtual_machine" "vm" {
    + name             = "${vmName}"
    + guest_id         = "${document.getElementById('vm_guest_id').value}"
    + num_cpus         = ${cpuCount}
    + memory           = ${memoryMB}
    + datastore_id     = (known after apply)
    + folder           = (known after apply)
    + resource_pool_id = (known after apply)

    + disk {
        + label            = "disk0"
        + size             = ${diskGB}
        + thin_provisioned = true
      }

    + network_interface {
        + network_id   = (known after apply)
        + adapter_type = "${document.getElementById('vm_network_adapter_type').value}"
      }
}

Plan: 1 to add, 0 to change, 0 to destroy.

Note: This is a simulated plan. To see a real plan, you would need to:
1. Save the generated tfvars file (see tfvars tab)
2. Set the vsphere_password as an environment variable
3. Run terraform plan against your Terraform configuration
`;
        }, 1500);
    });

    // Handle the Apply button click
    document.getElementById('apply-button').addEventListener('click', function() {
        const applyOutput = document.getElementById('apply-code');
        
        // Show loading state
        applyOutput.textContent = "Running terraform apply...\nThis would normally connect to your Terraform backend and execute the apply command.\n\nFor demonstration purposes, here's what would happen:\n";
        
        // Show the apply tab
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        document.querySelector('[data-tab="apply"]').classList.add('active');
        document.getElementById('apply-output').classList.add('active');
        
        // Simulate an apply operation
        setTimeout(() => {
            const vmName = document.getElementById('vm_name').value;
            const cpuCount = document.getElementById('vm_cpu').value;
            const memoryMB = document.getElementById('vm_memory').value;
            const diskGB = document.getElementById('vm_disk_size').value;
            
            applyOutput.textContent += `
Terraform used the selected providers to generate the following execution plan:

# vsphere_virtual_machine.vm will be created
+ resource "vsphere_virtual_machine" "vm" {
    + name             = "${vmName}"
    + guest_id         = "${document.getElementById('vm_guest_id').value}"
    + num_cpus         = ${cpuCount}
    + memory           = ${memoryMB}
    + datastore_id     = "datastore-123456"
    + folder           = "/EBDC NONPROD/vm"
    + resource_pool_id = "resgroup-789012"

    + disk {
        + label            = "disk0"
        + size             = ${diskGB}
        + thin_provisioned = true
      }

    + network_interface {
        + network_id   = "network-345678"
        + adapter_type = "${document.getElementById('vm_network_adapter_type').value}"
      }
}

Plan: 1 to add, 0 to change, 0 to destroy.

vsphere_virtual_machine.vm: Creating...
vsphere_virtual_machine.vm: Creation complete after 2m10s [id=vm-901234]

Apply complete! Resources: 1 added, 0 changed, 0 destroyed.

Outputs:

vm_name = "${vmName}"
vm_ip_address = "10.x.x.x"
vm_status = "powered on"

Note: This is a simulated apply. To perform a real apply, you would need to:
1. Save the generated tfvars file (see tfvars tab)
2. Set the vsphere_password as an environment variable
3. Run terraform apply against your Terraform configuration
`;
        }, 2000);
    });

    // Handle the Download button click
    document.getElementById('download-tfvars').addEventListener('click', function() {
        const tfvarsContent = generateTfvars();
        const vmName = document.getElementById('vm_name').value;
        const fileName = `${vmName}.tfvars`;
        
        // Create a blob and download link
        const blob = new Blob([tfvarsContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    });
});
