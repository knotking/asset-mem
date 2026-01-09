import { Page } from 'playwright';
import { config } from '../config';
import { SceneResult } from '../helpers';
import { delay } from '../helpers';

export async function recordPropertyDetails(page: Page): Promise<SceneResult> {
  const startTime = Date.now();
  
  try {
    console.log('🎬 Scene: Property Details');
    
    // Ensure we're on a property details page
    if (!page.url().includes('/properties/')) {
      throw new Error('Not on a property details page');
    }
    
    // Wait for tabs to be visible (indicates page is loaded)
    console.log('  ⏳ Waiting for page to load...');
    try {
      const tabs = page.locator('a[href*="/chat"], a[href*="/checkpoints"], a[href*="/details"]').first();
      await tabs.waitFor({ state: "visible", timeout: 10000 });
      await delay(1000);
    } catch (error) {
      console.log(`  ⚠️  Tabs not found, continuing anyway: ${error instanceof Error ? error.message : String(error)}`);
      await delay(2000);
    }
    
    // Click on the Details tab
    console.log('  🔘 Clicking on Details tab...');
    try {
      const detailsTab = page.locator(config.selectors.propertyDetails.detailsTab).first();
      
      // Try multiple selectors for robustness
      if (!(await detailsTab.isVisible({ timeout: 5000 }))) {
        // Try by text content
        const detailsTabByText = page.locator('a:has-text("Details"), button:has-text("Details")').first();
        if (await detailsTabByText.isVisible({ timeout: 5000 })) {
          await detailsTabByText.click();
          console.log('  ✅ Details tab clicked (by text)');
        } else {
          throw new Error('Details tab not found');
        }
      } else {
        await detailsTab.click();
        console.log('  ✅ Details tab clicked');
      }
      
      // Wait for the details page to load
      await page.waitForURL('**/details**', { timeout: 10000 });
      await delay(2000); // Give time for content to render
      
      console.log('  📋 Details page displayed');
    } catch (error) {
      console.log(`  ⚠️  Could not navigate to Details tab: ${error instanceof Error ? error.message : String(error)}`);
      // Continue anyway
    }
    
    // Wait for 5 seconds to display the page
    console.log('  ⏸️  Displaying Details page for 5 seconds...');
    await delay(5000);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Property Details scene completed in ${(duration / 1000).toFixed(1)}s`);
    
    return {
      success: true,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Property Details scene failed:', error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

