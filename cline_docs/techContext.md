# Technical Context

## Technologies Used

### Backend
- **Node.js** - Server runtime environment
- **Express** - Web application framework
- **Terraform** - Infrastructure as Code tool for VM provisioning
- **Child Process** - For executing Terraform commands
- **UUID** - For generating unique workspace IDs
- **File System (fs)** - For file operations and persistence

### Frontend
- **HTML/CSS** - Basic structure and styling
- **JavaScript** - Client-side logic and user interactions
- **Fetch API** - For AJAX requests to the backend
- **DOM API** - For dynamic content manipulation
- **Custom Events** - For component communication

### External Systems
- **vSphere API** - For VM provisioning and infrastructure data
  - **GOVC CLI** - Command-line utility for vSphere operations
- **Netbox API** - For IP address management
- **Ansible Automation Platform (AAP)** - For post-deployment configuration

## Development Setup
- **Server**: Node.js Express server running on port 3000
- **Client**: Browser-based web interface
- **Data**: Local file system for workspace data and Terraform files
- **Terraform**: Locally installed Terraform CLI for execution
- **API Endpoints**:
  - `/api/vsphere-infra/components` - For infrastructure data
  - `/api/workspaces` - For workspace management
  - `/api/terraform/plan` - For generating Terraform plans
  - `/api/terraform/apply` - For applying Terraform plans
  - `/api/settings` - For global settings management
  - `/api/aap/launch` - For launching Ansible jobs

## Technical Constraints
1. **vSphere Connectivity**:
   - Requires valid vSphere server, username, and password
   - Password must be provided at runtime for security
   - Connection must be established before infrastructure data can be fetched
   - GOVC binary must be installed at /usr/local/bin/govc
   - GOVC environment variables are set during operations

2. **Terraform Execution**:
   - Requires local Terraform installation
   - Operations are executed in isolated workspace directories
   - Plan files must be generated before apply operations

3. **Browser Limitations**:
   - Limited to browser security constraints
   - Password fields have special handling requirements
   - UI must handle asynchronous operations gracefully

4. **External API Dependencies**:
   - vSphere API for infrastructure data
   - Netbox API for IP allocation
   - AAP API for configuration management
   - All require valid credentials and tokens
