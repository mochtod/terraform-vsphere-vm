const http = require('http');

const testTfvars = {
    datacenter: "EBDC NONPROD",
    cluster: "np-cl60-lin", 
    datastore_cluster: "np-cl60-pod",
    network: "np-lin-vds-989-linux"
};

const data = JSON.stringify({
    datacenter: "EBDC NONPROD",
    vm_name: "lin2dv2terraform-100",
    vm_template: "rhel9-template0314",
    vm_host_group: "",
    vm_guest_id: "rhel9_64Guest",
    vm_cpu: "4",
    vm_memory: "32768",
    vm_disk_size: "100",
    vm_network_adapter_type: "vmxnet3",
    savedTfvars: testTfvars
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/workspaces/82ae7cbd-6903-4ebb-87a8-7a8ecc5441d5/config',
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`statusCode: ${res.statusCode}`);
    console.log(`headers:`, res.headers);

    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
