import { Page } from 'playwright';
import { config } from '../config';
import { SceneResult } from '../helpers';
import { delay, hoverAndWait, clickWithRetry, waitForVisible } from '../helpers';

export async function recordDashboard(page: Page): Promise<SceneResult> {
  const startTime = Date.now();
  
  try {
    console.log('🎬 Scene 3: Properties Dashboard');
    
    // Ensure we're on the dashboard
    if (!page.url().includes('/home')) {
      await page.goto(`${config.baseUrl}/home`, { waitUntil: 'networkidle' });
      await delay(2000);
    }
    
    // Wait for properties to load - wait for actual property cards to appear
    console.log('  ⏳ Waiting for properties to load...');
    
    // Wait for at least one property card (not "Add New Property") to be visible
    let propertyCardFound = false;
    const maxWaitTime = 15000; // 15 seconds max
    const waitStartTime = Date.now();
    
    while (!propertyCardFound && (Date.now() - waitStartTime) < maxWaitTime) {
      try {
        // Check if we have any property cards (excluding "Add New Property")
        const gridContainer = page.locator('div[class*="grid"]').first();
        const allCards = await gridContainer.locator('> *').all();
        
        for (const card of allCards) {
          if (!(await card.isVisible())) continue;
          
          const cardText = await card.textContent();
          const isAddProperty = cardText?.toLowerCase().includes('add new property') || 
                               cardText?.toLowerCase().includes('upload documents');
          
          // If we find a card that's not "Add New Property" and has content, we're good
          if (!isAddProperty && cardText && cardText.trim().length > 10) {
            propertyCardFound = true;
            break;
          }
        }
        
        if (!propertyCardFound) {
          await delay(500);
        }
      } catch (error) {
        await delay(500);
      }
    }
    
    if (!propertyCardFound) {
      console.log('  ⚠️  No property cards found after waiting, proceeding anyway...');
      await delay(2000);
    } else {
      console.log('  ✅ Property cards loaded');
      await delay(500); // Small delay after cards are found
    }
    
    // Find and click the first property card (excluding "Add New Property")
    console.log('  🔘 Selecting first property...');
    
    let clicked = false;
    
    // Strategy 1: Find all cards in the grid, exclude "Add New Property", click first property card
    try {
      // Get all cards/divs in the grid
      const gridContainer = page.locator('div[class*="grid"]').first();
      const allCards = await gridContainer.locator('> *').all();
      
      for (const card of allCards) {
        // Skip if card is not visible
        if (!(await card.isVisible())) continue;
        
        // Get the text content to check if it's the "Add New Property" card
        const cardText = await card.textContent();
        const isAddProperty = cardText?.toLowerCase().includes('add new property') || 
                             cardText?.toLowerCase().includes('upload documents');
        
        // Skip the "Add New Property" card
        if (isAddProperty) {
          continue;
        }
        
        // If the card has meaningful content (likely a property card), click it
        if (cardText && cardText.trim().length > 10) {
          console.log(`  🖱️  Hovering over property: "${cardText.substring(0, 40).trim()}..."`);
          await card.hover();
          await delay(1000);
          
          console.log('  🔘 Clicking property card...');
          await card.click();
          clicked = true;
          break;
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Strategy 1 failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Strategy 2: Try using CSS selector to find property cards (excluding Add Property)
    if (!clicked) {
      try {
        // Look for cards that don't contain "Add New Property" text
        const propertyCard = page.locator('div[class*="Card"]:not(:has-text("Add New Property")):not(:has-text("Upload documents"))').first();
        
        if (await propertyCard.isVisible({ timeout: 3000 })) {
          await propertyCard.hover();
          await delay(800);
          await propertyCard.click();
          clicked = true;
          console.log('  ✅ Clicked property using selector strategy');
        }
      } catch (error) {
        console.log('  ⚠️  Strategy 2 failed, trying link-based approach...');
      }
    }
    
    // Strategy 3: Look for property links (but not new-property)
    if (!clicked) {
      try {
        const propertyLink = page.locator('a[href*="/properties/"]:not([href*="new-property"])').first();
        
        if (await propertyLink.isVisible({ timeout: 3000 })) {
          await propertyLink.hover();
          await delay(500);
          await propertyLink.click();
          clicked = true;
          console.log('  ✅ Clicked property using link strategy');
        }
      } catch (error) {
        console.log('  ⚠️  Strategy 3 also failed');
      }
    }
    
    if (!clicked) {
      throw new Error('Could not find or click a property card after trying multiple strategies');
    }
    
    // Wait for navigation to property details (should navigate to chat tab by default)
    console.log('  ⏳ Waiting for navigation to property page...');
    
    // Wait for URL to include /properties/ and /chat (may redirect from /chat to /chat/[sessionId])
    await page.waitForURL('**/properties/**/chat**', { timeout: 10000 });
    
    // The chat page redirects to a session, so wait for that redirect to complete
    // Wait for the URL to stabilize (either /chat or /chat/[sessionId])
    let urlStable = false;
    let lastUrl = page.url();
    await delay(1000); // Give redirect a moment to start
    for (let i = 0; i < 10; i++) {
      await delay(500);
      const currentUrl = page.url();
      if (currentUrl === lastUrl) {
        urlStable = true;
        break;
      }
      lastUrl = currentUrl;
    }
    
    await page.waitForLoadState('networkidle');
    
    // Wait for AI Chat tab to fully load
    console.log('  ⏳ Waiting for AI Chat tab to load...');
    
    // Wait for chat interface elements to be visible (message input indicates chat is ready)
    try {
      // Wait for chat input to appear (indicating chat interface is loaded)
      await page.waitForSelector('textarea, input[type="text"]', { 
        state: 'visible', 
        timeout: 10000 
      });
      console.log('  ✅ Chat input found, chat interface is ready');
    } catch (error) {
      console.log('  ⚠️  Chat input not found immediately, will wait longer...');
    }
    
    // Additional wait as requested - give the chat interface time to fully render
    // This includes loading session data, messages, sidebar, etc.
    console.log('  ⏸️  Waiting for chat interface to fully load (3 seconds)...');
    await delay(3000); // Wait 3 seconds for chat to fully load
    
    const duration = Date.now() - startTime;
    console.log(`✅ Scene 3 completed in ${(duration / 1000).toFixed(1)}s`);
    
    return {
      success: true,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Scene 3 failed:', error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

