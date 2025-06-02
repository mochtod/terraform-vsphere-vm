// Test the connection status functionality in the browser
const puppeteer = require('puppeteer');

async function testConnectionStatus() {
    console.log('Starting browser test for connection status...');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });
    
    try {
        const page = await browser.newPage();
        
        // Listen for console messages from the browser
        page.on('console', msg => {
            console.log(`BROWSER: ${msg.text()}`);
        });
        
        // Listen for errors
        page.on('error', error => {
            console.error(`PAGE ERROR: ${error.message}`);
        });
        
        // Navigate to the application
        console.log('Loading application...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        
        // Wait for the connection status elements to be present
        console.log('Waiting for connection status elements...');
        await page.waitForSelector('#vsphere-status', { timeout: 10000 });
        await page.waitForSelector('#templates-status', { timeout: 10000 });
        await page.waitForSelector('#infrastructure-status', { timeout: 10000 });
        await page.waitForSelector('#test-vsphere-connection', { timeout: 10000 });
          // Wait a bit for initial status check to complete
        console.log('Waiting for initial status check...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get initial status values
        const initialStatus = await page.evaluate(() => {
            const vsphereEl = document.getElementById('vsphere-status');
            const templatesEl = document.getElementById('templates-status');
            const infraEl = document.getElementById('infrastructure-status');
            
            return {
                vsphere: {
                    text: vsphereEl ? vsphereEl.textContent : 'NOT FOUND',
                    class: vsphereEl ? vsphereEl.className : 'NOT FOUND'
                },
                templates: {
                    text: templatesEl ? templatesEl.textContent : 'NOT FOUND',
                    class: templatesEl ? templatesEl.className : 'NOT FOUND'
                },
                infrastructure: {
                    text: infraEl ? infraEl.textContent : 'NOT FOUND',
                    class: infraEl ? infraEl.className : 'NOT FOUND'
                }
            };
        });
        
        console.log('Initial status:', JSON.stringify(initialStatus, null, 2));
        
        // Click the test connection button
        console.log('Clicking test connection button...');
        await page.click('#test-vsphere-connection');
          // Wait for testing to complete
        console.log('Waiting for connection test to complete...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Get final status values
        const finalStatus = await page.evaluate(() => {
            const vsphereEl = document.getElementById('vsphere-status');
            const templatesEl = document.getElementById('templates-status');
            const infraEl = document.getElementById('infrastructure-status');
            
            return {
                vsphere: {
                    text: vsphereEl ? vsphereEl.textContent : 'NOT FOUND',
                    class: vsphereEl ? vsphereEl.className : 'NOT FOUND'
                },
                templates: {
                    text: templatesEl ? templatesEl.textContent : 'NOT FOUND',
                    class: templatesEl ? templatesEl.className : 'NOT FOUND'
                },
                infrastructure: {
                    text: infraEl ? infraEl.textContent : 'NOT FOUND',
                    class: infraEl ? infraEl.className : 'NOT FOUND'
                }
            };
        });
        
        console.log('Final status:', JSON.stringify(finalStatus, null, 2));
        
        // Check if status indicators show error states (expected since govc is missing)
        const hasExpectedErrors = 
            finalStatus.vsphere.class.includes('status-error') &&
            finalStatus.templates.class.includes('status-error');
            
        if (hasExpectedErrors) {
            console.log('✅ SUCCESS: Connection status indicators are working correctly');
            console.log('✅ ERROR HANDLING: Properly showing error states for missing govc binary');
        } else {
            console.log('❌ ISSUE: Connection status indicators may not be working as expected');
        }
        
        // Test dropdown behavior without demo data
        console.log('Testing dropdown behavior...');
        
        // Try to load VM templates dropdown
        await page.click('label[for="vmTemplate"]');
        await page.waitForTimeout(1000);
        
        const templateOptions = await page.evaluate(() => {
            const select = document.getElementById('vmTemplate');
            return select ? Array.from(select.options).map(opt => opt.text) : [];
        });
        
        console.log('Template dropdown options:', templateOptions);
        
        // Verify no demo data is present
        const hasDemoData = templateOptions.some(option => 
            option.includes('Demo') || option.includes('Sample') || option.includes('Test')
        );
        
        if (!hasDemoData && templateOptions.length <= 1) {
            console.log('✅ SUCCESS: No demo data in dropdowns');
        } else {
            console.log('❌ ISSUE: Demo data may still be present in dropdowns');
        }
        
        console.log('Browser test completed successfully!');
        
    } catch (error) {
        console.error('Browser test failed:', error.message);
    } finally {
        // Keep browser open for manual inspection
        console.log('Browser will remain open for manual inspection. Close it manually when done.');
        // await browser.close();
    }
}

// Check if puppeteer is installed
const { execSync } = require('child_process');
try {
    require('puppeteer');
    testConnectionStatus();
} catch (error) {
    console.log('Puppeteer not found. Installing...');
    execSync('npm install puppeteer', { stdio: 'inherit' });
    console.log('Puppeteer installed. Running test...');
    testConnectionStatus();
}
