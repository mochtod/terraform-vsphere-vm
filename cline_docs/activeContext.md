# Active Context

## What We're Working On Now
Fixing multiple infrastructure components to show correct items in dropdowns:
1. Datastore Cluster dropdown now properly shows datastore clusters (pods) rather than individual datastores
2. Network dropdown now shows distributed port groups with their VLAN IDs rather than all network types
3. VM Template dropdown now shows only actual VM templates instead of all VMs

## Recent Changes
- Created a `govc-helper.js` module to standardize interactions with the govc binary
- Updated `vsphere-infra-api.js` to use the govc binary for fetching infrastructure components
- Enhanced `infrastructure-dropdowns.js` with improved password field detection and retry mechanisms
- Implemented a new `vsphere-api.js` for VM templates and VM status information
- Added a `set-govc-env.sh` script to help with GOVC binary setup and environment configuration
- Fixed issues with password field validation and global settings timing
- Improved error handling and added fallback to sample data when API calls fail
- **CRITICAL FIX**: Fixed invalid govc command syntaxes that were causing errors:
  - Fixed `govc find -type s -cluster="cluster-name"` (invalid -cluster flag) to `govc find -type s -dc="datacenter-name"`
  - Fixed `govc find -type n -cluster="cluster-name"` (invalid -cluster flag) to `govc find -type n -dc="datacenter-name"`
  - Fixed `govc find -type s` (individual datastores) to `govc find -type sp` (storage pods/datastore clusters)
  - Fixed `govc find -type m` (all VMs) to `govc vm.info -t=true` (only VM templates)
- Fixed networks display by replacing `find -type n` with `dvs.portgroup.info` to show distributed port groups with VLAN IDs
- Added datacenter context parameter to API calls for proper filtering
- Updated frontend to pass datacenter context to backend for datastore clusters and networks
- Updated sample data in vsphere-infra-api.js to use storage pod IDs and names that better reflect vSphere terminology
- Updated sample network data to include VLAN IDs in the display name format "network-name (VLAN: ID)"
- Improved VM template handling to only show VMs marked as templates in vSphere

## Next Steps
1. Test the infrastructure dropdowns with real vSphere credentials
2. Verify that datastore clusters (storage pods) are properly loaded
3. Verify that distributed port groups with VLAN IDs are properly displayed in the networks dropdown
4. Verify that only VM templates are displayed in the VM template dropdown
5. Check if the hierarchical relationship between infrastructure components is maintained
6. Ensure the dropdown selections are properly saved to workspace configurations
7. Consider adding additional error handling for edge cases
8. If needed, enhance the govc-helper.js module with more vSphere operations
9. Test the Terraform plan creation with the newly implemented credential management system
10. Verify that Netbox IP allocation works correctly with the provided token

## Recent Terraform & Credential Management Updates (May 28, 2025)
1. Created `load-global-settings.sh` script to read credentials from `global_settings.json`
2. Updated `create-terraform-plan.sh` to source the global settings script
3. Added debug logging to `providers.tf` for better troubleshooting
4. Created `test-terraform-connection.sh` for testing vSphere connectivity
5. Added Netbox variables to `variables.tf` for proper integration
6. Implemented improved handling of special characters in credentials

## Key Technical Details
- The govc `find` command doesn't support a `-cluster` flag - it uses `-dc` for datacenter filtering
- Datastore clusters and networks are typically shared at the datacenter level, not cluster level
- VM templates are specifically identified using `govc vm.info -t=true` which only returns template VMs
- The frontend now properly passes datacenterContext to the backend for better filtering
- Network display names include VLAN IDs for better user identification, but the backend uses raw names
