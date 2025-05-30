const http = require('http');

const data = JSON.stringify({
    vsphereServer: "virtualcenter.chrobinson.com",
    vsphereUser: "chr\\svcssbsansible",
    vspherePassword: "CaGZ@Lx@DQ9TK%&&ic2zgiQI))XMYY0@I&M",
    component: "networks",
    parent: "np-cl60-lin",
    datacenterContext: "EBDC NONPROD"
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/vsphere-infra/components',
    method: 'POST',
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
