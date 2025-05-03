// vSphere API endpoints for the TerraSphere application
const express = require('express');
const router = express.Router();
const vsphereRest = require('./vsphere-rest-client');

// Endpoint to fetch VM templates from vSphere
router.post('/templates', async (req, res) => {
    try {
        const { vsphereServer, vsphereUser, vspherePassword, datacenter } = req.body;
        if (!vsphereServer || !vsphereUser || !vspherePassword) {
            return res.status(400).json({ success: false, error: 'Missing vSphere connection details' });
        }
        if (!datacenter) {
            return res.status(400).json({ success: false, error: 'Missing datacenter for template search' });
        }
        let cookie;
        try {
            cookie = await vsphereRest.loginVSphere(vsphereServer, vsphereUser, vspherePassword);
        } catch (err) {
            return res.status(500).json({ success: false, error: 'vSphere login failed: ' + err.message });
        }
        try {
            const templates = await vsphereRest.getVMTemplates(vsphereServer, cookie, datacenter);
            // Map to frontend format
            const result = templates.map(t => ({
                name: t.name,
                id: t.vm,
                guestId: t.guest_OS,
                guestFullName: t.guest_OS || ''
            }));
            return res.json({ success: true, templates: result });
        } catch (err) {
            return res.status(500).json({ success: false, error: 'Failed to fetch templates: ' + err.message });
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: `Server error: ${error.message}` });
    }
});

// Endpoint to connect to vSphere and get VMs information
router.post('/vms', async (req, res) => {
    try {
        const { vsphereServer, vsphereUser, vspherePassword, datacenter } = req.body;
        if (!vsphereServer || !vsphereUser || !vspherePassword) {
            return res.status(400).json({ success: false, error: 'Missing vSphere connection details' });
        }
        if (!datacenter) {
            return res.status(400).json({ success: false, error: 'Missing datacenter for VM search' });
        }
        let cookie;
        try {
            cookie = await vsphereRest.loginVSphere(vsphereServer, vsphereUser, vspherePassword);
        } catch (err) {
            return res.status(500).json({ success: false, error: 'vSphere login failed: ' + err.message });
        }
        try {
            const vms = await vsphereRest.getVMs(vsphereServer, cookie, datacenter);
            // Map to frontend format
            const result = vms.map(vm => ({
                Name: vm.name,
                Id: vm.vm,
                PowerState: vm.power_state,
                GuestId: vm.guest_OS,
                GuestFullName: vm.guest_OS || '',
                NumCpu: vm.cpu_count,
                MemoryMB: vm.memory_size_MiB,
                GuestIPAddress: vm.guest_IP || ''
            }));
            return res.json({ success: true, vms: result });
        } catch (err) {
            return res.status(500).json({ success: false, error: 'Failed to fetch VMs: ' + err.message });
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: `Server error: ${error.message}` });
    }
});

module.exports = router;
