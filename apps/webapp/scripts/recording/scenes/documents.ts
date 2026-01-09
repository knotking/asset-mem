import { Page } from 'playwright';
import { config } from '../config';
import { SceneResult } from '../helpers';
import { delay, clickWithRetry, scrollSmoothly, waitForVisible } from '../helpers';
import * as path from 'path';
import * as fs from 'fs';

export async function recordDocuments(page: Page): Promise<SceneResult> {
  const startTime = Date.now();
  
  try {
    console.log('🎬 Scene 7: Documents & Upload');
    
    // Ensure we're on a property page
    if (!page.url().includes('/properties/')) {
      throw new Error('Not on a property page');
    }
    
    // Navigate to details tab
    console.log('  🔘 Navigating to Details tab...');
    try {
      const detailsTab = page.locator(config.selectors.propertyDetails.detailsTab).first();
      if (await detailsTab.isVisible({ timeout: 5000 })) {
        await detailsTab.click();
        await page.waitForURL('**/details**', { timeout: 5000 });
      } else {
        // Try navigating directly
        const currentUrl = page.url();
        const propertyId = currentUrl.match(/\/properties\/([^\/]+)/)?.[1];
        if (propertyId) {
          await page.goto(`${config.baseUrl}/home/properties/${propertyId}/details`, {
            waitUntil: 'load',
            timeout: 30000,
          });
        }
      }
    } catch (error) {
      console.log('  ⚠️  Could not navigate to details tab, continuing...');
    }
    
    // Wait for page to load (use 'load' instead of 'networkidle' which is too strict)
    try {
      await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {
        console.log('  ⚠️  Load state timeout, but page may be ready, continuing...');
      });
    } catch (error) {
      console.log('  ⚠️  Could not wait for load state, continuing...');
    }
    
    // Wait for the details page content to be visible instead
    try {
      await page.waitForSelector('h1:has-text("Property"), [class*="property"], button:has-text("Upload Documents"), [class*="document"]', {
        timeout: 5000,
        state: 'visible'
      });
      console.log('  ✅ Details page content is visible');
    } catch (error) {
      console.log('  ⚠️  Details page content may not be visible yet, continuing...');
    }
    
    await delay(2000);
    
    // Scroll to documents section
    console.log('  📜 Scrolling to documents section...');
    try {
      await scrollSmoothly(page, config.selectors.documents.documentList);
      await delay(1000);
    } catch (error) {
      // Just scroll down
      await page.evaluate(() => {
        window.scrollBy({ top: 600, behavior: 'smooth' });
      });
      await delay(1000);
    }
    
    // Show existing documents
    console.log('  📄 Showing existing documents...');
    await delay(1500);
    
    // Click upload button
    console.log('  🔘 Clicking upload button...');
    try {
      const uploadButton = page.locator(config.selectors.documents.uploadButton).first();
      if (await uploadButton.isVisible({ timeout: 5000 })) {
        await uploadButton.click();
        await delay(2000);
        
        // Wait for upload dialog
        const uploadDialog = page.locator(config.selectors.documents.uploadDialog).first();
        if (await uploadDialog.isVisible({ timeout: 3000 })) {
          console.log('  📤 Upload dialog opened');
          
          // Try to find file input for drag-and-drop simulation
          const fileInput = page.locator('input[type="file"]').first();
          if (await fileInput.isVisible({ timeout: 3000 })) {
            // Create a dummy test file for upload simulation
            const testFilePath = path.join(__dirname, '../../test-document.pdf');
            
            // Check if test file exists, if not create a placeholder
            if (!fs.existsSync(testFilePath)) {
              console.log('  ⚠️  Test file not found, simulating upload...');
              // Just show the dialog without actually uploading
            } else {
              // Set the file input
              await fileInput.setInputFiles(testFilePath);
              console.log('  📎 File selected for upload');
              await delay(2000);
            }
          }
          
          // Close the dialog (don't actually upload in demo)
          await page.keyboard.press('Escape');
          await delay(1000);
        }
      }
    } catch (error) {
      console.log('  ⚠️  Upload button not found or upload dialog not available');
    }
    
    // Show documents list again
    console.log('  📋 Showing documents list...');
    await delay(1000);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Scene 7 completed in ${(duration / 1000).toFixed(1)}s`);
    
    return {
      success: true,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Scene 7 failed:', error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

