// AAP Job Templates Management

document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const jobTemplatesList = document.getElementById('job-templates-list');
    const addJobTemplateBtn = document.getElementById('add-job-template-btn');
    const settingsAapDefaultTemplate = document.getElementById('settings_aap_default_template');
    
    // Initialize event listeners
    if (addJobTemplateBtn) {
        addJobTemplateBtn.addEventListener('click', addNewJobTemplate);
    }
    
    // Load job templates from settings when settings are loaded
    document.addEventListener('settingsLoaded', function(e) {
        if (e.detail && e.detail.settings && e.detail.settings.aap) {
            updateJobTemplatesUI(e.detail.settings.aap.job_templates || []);
            
            // Set default template ID if available
            if (e.detail.settings.aap.default_template_id && settingsAapDefaultTemplate) {
                settingsAapDefaultTemplate.value = e.detail.settings.aap.default_template_id;
            }
        }
    });
    
    // Function to add a new job template entry
    function addNewJobTemplate() {
        const templateEntry = document.createElement('div');
        templateEntry.className = 'job-template-entry';
        templateEntry.innerHTML = `
            <input type="number" class="job-template-id" placeholder="Template ID" min="1">
            <input type="text" class="job-template-name" placeholder="Template Name">
            <input type="text" class="job-template-desc" placeholder="Description">
            <button type="button" class="remove-template-btn btn-small"><i class="fas fa-trash"></i></button>
        `;
        
        // Add to the list
        jobTemplatesList.appendChild(templateEntry);
        
        // Add event listener to the remove button
        templateEntry.querySelector('.remove-template-btn').addEventListener('click', function() {
            templateEntry.remove();
        });
    }
    
    // Function to update the job templates UI with data
    function updateJobTemplatesUI(templates) {
        if (!jobTemplatesList) return;
        
        // Clear existing entries
        jobTemplatesList.innerHTML = '';
        
        // Add entries for each template
        if (templates && templates.length > 0) {
            templates.forEach(template => {
                const templateEntry = document.createElement('div');
                templateEntry.className = 'job-template-entry';
                templateEntry.innerHTML = `
                    <input type="number" class="job-template-id" placeholder="Template ID" min="1" value="${template.id || ''}">
                    <input type="text" class="job-template-name" placeholder="Template Name" value="${template.name || ''}">
                    <input type="text" class="job-template-desc" placeholder="Description" value="${template.description || ''}">
                    <button type="button" class="remove-template-btn btn-small"><i class="fas fa-trash"></i></button>
                `;
                
                // Add to the list
                jobTemplatesList.appendChild(templateEntry);
                
                // Add event listener to the remove button
                templateEntry.querySelector('.remove-template-btn').addEventListener('click', function() {
                    templateEntry.remove();
                });
            });
        } else {
            // Add a default empty entry
            addNewJobTemplate();
        }
    }
    
    // Function to collect all job templates from the UI
    window.collectJobTemplates = function() {
        if (!jobTemplatesList) return [];
        
        const templates = [];
        const entries = jobTemplatesList.querySelectorAll('.job-template-entry');
        
        entries.forEach(entry => {
            const idInput = entry.querySelector('.job-template-id');
            const nameInput = entry.querySelector('.job-template-name');
            const descInput = entry.querySelector('.job-template-desc');
            
            const id = parseInt(idInput.value);
            const name = nameInput.value.trim();
            
            // Only add if id and name are provided
            if (id && name) {
                templates.push({
                    id: id,
                    name: name,
                    description: descInput.value.trim() || ''
                });
            }
        });
        
        return templates;
    };
});
