# System Patterns

## How the System is Built
The TerraSphere system is built with a client-server architecture:

1. **Backend (Node.js + Express)**
   - Provides RESTful API endpoints for frontend interactions
   - Manages workspace data and configuration files
   - Executes Terraform commands for infrastructure provisioning
   - Interfaces with external systems (vSphere, Netbox, AAP)

2. **Frontend (HTML + CSS + JavaScript)**
   - Web interface for user interactions
   - Form-based VM configuration
   - Dynamic infrastructure component selection
   - Tabbed interface for different operations (tfvars, plan, apply, etc.)

3. **Data Storage**
   - Local file system for workspace JSON files
   - Terraform configuration files
   - Global settings

## Key Technical Decisions
1. **Modular Terraform Approach**
   - Core VM module for vSphere VM provisioning
   - Netbox module for IP allocation
   - Separation of concerns between modules

2. **Workspace-Based Configuration Management**
   - Each VM configuration is stored as a separate workspace
   - Workspaces have unique IDs and persistent state
   - Enables tracking of VM lifecycle (created, planned, deployed)

3. **API Integration Strategy**
   - vSphere API for infrastructure components and VM operations
     - GOVC binary integration for reliable vSphere connectivity
     - Modular helper functions for standard vSphere operations
     - Fallback to sample data when API connections fail
   - Netbox API for IP address management
   - Ansible Automation Platform for post-deployment configuration

4. **Security Model**
   - Credentials stored in server-side configuration
   - Passwords for operations provided at runtime
   - Token-based authentication for external APIs

## Architecture Patterns
1. **Event-Driven UI**
   - DOM events for user interactions
   - Custom events for system notifications
   - Reactive dropdown population based on selection hierarchy

2. **Asynchronous Operation Handling**
   - Promises and async/await for API calls
   - Progress tracking for long-running operations
   - Status updates via polling

3. **Hierarchical Component Relationships**
   - Datacenter → Cluster → Datastore Cluster → Network selection flow
   - Parent-child relationship between infrastructure components
   - Conditional display and validation based on selection state
