# Active Context

## What We're Working On Now
Fixed critical govc command syntax issues that were preventing proper data retrieval from vSphere. The infrastructure dropdowns should now work correctly with real vSphere environments.

## Recent Changes
- Created a `govc-helper.js` module to standardize interactions with the govc binary
- Updated `vsphere-infra-api.js` to use the govc binary for fetching infrastructure components
- Enhanced `infrastructure-dropdowns.js` with improved password field detection and retry mechanisms
- Implemented a new `vsphere-api.js` for VM templates and VM status information
- Added a `set-govc-env.sh` script to help with GOVC binary setup and environment configuration
- Fixed issues with password field validation and global settings timing
- Improved error handling and added fallback to sample data when API calls fail
- **CRITICAL FIX**: Fixed invalid govc command syntaxes that were causing errors:
  - Fixed `govc vm.info -t=true` (missing VM path) to `govc find -type m` for finding VMs/templates
  - Fixed `govc find -type s -cluster="cluster-name"` (invalid -cluster flag) to `govc find -type s -dc="datacenter-name"`
  - Fixed `govc find -type n -cluster="cluster-name"` (invalid -cluster flag) to `govc find -type n -dc="datacenter-name"`
- Added datacenter context parameter to API calls for proper filtering
- Updated frontend to pass datacenter context to backend for datastore clusters and networks

## Next Steps
1. Test the infrastructure dropdowns with real vSphere credentials
2. Verify that VM templates are properly loaded
3. Check if the hierarchical relationship between infrastructure components is maintained
4. Ensure the dropdown selections are properly saved to workspace configurations
5. Consider adding additional error handling for edge cases
6. If needed, enhance the govc-helper.js module with more vSphere operations

## Key Technical Details
- The govc `find` command doesn't support a `-cluster` flag - it uses `-dc` for datacenter filtering
- Datastore clusters and networks are typically shared at the datacenter level, not cluster level
- VM templates need to be found using `govc find -type m` and then filtered based on template properties
- The frontend now properly passes datacenterContext to the backend for better filtering
