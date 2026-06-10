import { Page } from "playwright";
import { config } from "../config";
import { SceneResult } from "../helpers";
import { delay } from "../helpers";
import * as path from "path";

export async function recordPropertyDetails(page: Page): Promise<SceneResult> {
  const startTime = Date.now();
  let detailsPageDisplayedTime: number | null = null;

  try {
    console.log("🎬 Scene: Property Details");

    // Ensure we're on a property details page
    if (!page.url().includes("/properties/")) {
      throw new Error("Not on a property details page");
    }

    // Wait for tabs to be visible (indicates page is loaded)
    console.log("  ⏳ Waiting for page to load...");
    try {
      const tabs = page
        .locator(
          'a[href*="/chat"], a[href*="/checkpoints"], a[href*="/details"]',
        )
        .first();
      await tabs.waitFor({ state: "visible", timeout: 10000 });
      await delay(1000);
    } catch (error) {
      console.log(
        `  ⚠️  Tabs not found, continuing anyway: ${error instanceof Error ? error.message : String(error)}`,
      );
      await delay(2000);
    }

    // Click on the Details tab
    console.log("  🔘 Clicking on Details tab...");
    try {
      const detailsTab = page
        .locator(config.selectors.propertyDetails.detailsTab)
        .first();

      // Try multiple selectors for robustness
      if (!(await detailsTab.isVisible({ timeout: 5000 }))) {
        // Try by text content
        const detailsTabByText = page
          .locator('a:has-text("Details"), button:has-text("Details")')
          .first();
        if (await detailsTabByText.isVisible({ timeout: 5000 })) {
          await detailsTabByText.click();
          console.log("  ✅ Details tab clicked (by text)");
        } else {
          throw new Error("Details tab not found");
        }
      } else {
        await detailsTab.click();
        console.log("  ✅ Details tab clicked");
      }

      // Wait for the details page to load
      await page.waitForURL("**/details**", { timeout: 10000 });
      await delay(2000); // Give time for content to render

      console.log("  📋 Details page displayed");
      detailsPageDisplayedTime = Date.now();
    } catch (error) {
      console.log(
        `  ⚠️  Could not navigate to Details tab: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Continue anyway
      // If navigation failed, set displayed time to current time to avoid undefined
      if (!detailsPageDisplayedTime) {
        detailsPageDisplayedTime = Date.now();
      }
    }

    // Wait 5 seconds on the details tab before clicking Upload documents
    console.log("  ⏸️  Waiting 5 seconds on Details tab...");
    await delay(5000);

    // Click "Upload documents"
    console.log("  🔘 Clicking Upload documents...");
    try {
      const uploadBtn = page
        .locator(config.selectors.documents.uploadButton)
        .first();
      await uploadBtn.waitFor({ state: "visible", timeout: 8000 });
      await uploadBtn.click();
      console.log("  ✅ Upload documents clicked");
      
      // Wait for upload dialog to appear
      console.log("  ⏳ Waiting for upload dialog to appear...");
      try {
        await page.waitForSelector(
          '[role="dialog"]:has-text("Upload"), input[type="file"]',
          {
            timeout: 5000,
            state: "visible",
          }
        );
        console.log("  ✅ Upload dialog is visible");
        await delay(1000);
      } catch (error) {
        console.log(
          `  ⚠️  Upload dialog may not be visible: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      
      // Upload the document
      console.log("  📄 Uploading HomePolicyDocument.pdf...");
      try {
        // Get the path to HomePolicyDocument.pdf from the recordings directory
        // Script runs from apps/webapp, so recordings is at apps/webapp/recordings
        // __dirname points to scenes/ directory (apps/webapp/scripts/recording/scenes)
        // So we need to go up 3 levels to get to apps/webapp, then into recordings
        const recordingsDir = path.join(
          __dirname,
          "..",
          "..",
          "..",
          "recordings"
        );
        const documentPath = path.join(recordingsDir, "HomePolicyDocument.pdf");

        // Find file input - don't try to click it, just set files directly
        // Playwright can set files on hidden inputs without clicking
        const fileInput = page.locator('input[type="file"]').first();

        // Wait for file input to exist in DOM (it may be hidden, which is fine)
        // Use "attached" state instead of "visible" since file inputs are often hidden
        try {
          await fileInput.waitFor({ state: "attached", timeout: 5000 });
        } catch (error) {
          console.log("  ⚠️  File input not found in DOM, will try anyway...");
        }

        // Set the file directly without clicking (avoids interception by SVG/overlay elements)
        // This works even if the input is hidden
        await fileInput.setInputFiles(documentPath);
        console.log(`  ✅ Document selected: ${path.basename(documentPath)}`);
        
        // Click the Upload button to submit the upload
        // The button text changes to "Upload 1 Document" after file is set
        console.log("  🔘 Clicking Upload button...");
        try {
          // Wait for the specific "Upload 1 Document" button to appear (more efficient than fixed delay)
          console.log("  ⏳ Waiting for 'Upload 1 Document' button to appear...");
          let uploadButtonClicked = false;
          
          // Strategy 1: Wait for the specific "Upload 1 Document" button
          try {
            const uploadButton = page.locator('button:has-text("Upload 1 Document")').first();
            await uploadButton.waitFor({ state: 'visible', timeout: 3000 });
            await uploadButton.click();
            console.log("  ✅ Upload button clicked: 'Upload 1 Document'");
            uploadButtonClicked = true;
          } catch (error) {
            // Strategy 2: Look for any upload button with a number (prioritized)
            try {
              const allUploadButtons = await page.locator('button:has-text("Upload")').all();
              for (const button of allUploadButtons) {
                try {
                  if (!(await button.isVisible({ timeout: 500 }))) continue;
                  const buttonText = (await button.textContent().catch(() => "")) || "";
                  // Prioritize buttons with numbers (like "Upload 1 Document")
                  if (buttonText && buttonText.toLowerCase().includes("upload") && /\d/.test(buttonText)) {
                    await button.click();
                    console.log(`  ✅ Upload button clicked: "${buttonText.trim()}"`);
                    uploadButtonClicked = true;
                    break;
                  }
                } catch (error) {
                  continue;
                }
              }
            } catch (error) {
              // Strategy 3: Fallback to any upload button
              try {
                const fallbackButton = page.locator('button:has-text("Upload")').first();
                if (await fallbackButton.isVisible({ timeout: 1000 })) {
                  await fallbackButton.click();
                  const buttonText = (await fallbackButton.textContent().catch(() => "")) || "Upload";
                  console.log(`  ✅ Upload button clicked: "${buttonText.trim()}"`);
                  uploadButtonClicked = true;
                }
              } catch (error) {
                console.log("  ⚠️  Could not find Upload button");
              }
            }
          }
          
          if (!uploadButtonClicked) {
            console.log("  ⚠️  Could not find or click Upload button, continuing...");
          }
        } catch (error) {
          console.log(
            `  ⚠️  Could not click Upload button: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        
        // Wait 3 seconds after clicking Upload button
        console.log("  ⏸️  Waiting 3 seconds after upload...");
        await delay(3000);
      } catch (error) {
        console.log(
          `  ⚠️  Could not upload document: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } catch (err) {
      console.log(
        `  ⚠️  Could not click Upload documents: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Sign out before navigating
    // The logout button is in a dropdown menu that appears when clicking the user name/avatar in the top right
    console.log("  🚪 Signing out...");
    const signoutStartTime = Date.now();
    let signoutPerformed = false;
    try {
      // Find the user dropdown button in the header (top right navigation bar)
      // The button contains an Avatar and user email/name
      console.log("  🔍 Looking for user dropdown button in header...");
      
      const header = page.locator('header').first();
      if (!(await header.isVisible({ timeout: 3000 }))) {
        throw new Error("Header not found");
      }
      
      // Find the user dropdown button specifically (not theme toggle)
      // Based on actual HTML: button with aria-haspopup="menu", contains span with rounded-full (Avatar), and span with email
      console.log("  🔍 Looking for user dropdown button...");
      
      let dropdownOpened = false;
      
      // Strategy 1: Find button with aria-haspopup="menu" AND rounded-full span (most specific)
      // This uniquely identifies the user dropdown button
      try {
        const userButton = header.locator('button[aria-haspopup="menu"]:has(span[class*="rounded-full"])').first();
        if (await userButton.isVisible({ timeout: 3000 })) {
          await userButton.scrollIntoViewIfNeeded();
          await delay(300);
          await userButton.click();
          console.log("  ✅ User dropdown opened (button with aria-haspopup and rounded-full span)");
          dropdownOpened = true;
        }
      } catch (error) {
        console.log(`  ⚠️  Strategy 1 failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      if (!dropdownOpened) {
        // Strategy 2: Find button with rounded-full span AND email span (hidden sm:inline-block)
        try {
          const userButton = header.locator('button:has(span[class*="rounded-full"]):has(span[class*="hidden"])').first();
          if (await userButton.isVisible({ timeout: 2000 })) {
            await userButton.scrollIntoViewIfNeeded();
            await delay(300);
            await userButton.click();
            console.log("  ✅ User dropdown opened (button with rounded-full and hidden span)");
            dropdownOpened = true;
          }
        } catch (error) {
          console.log(`  ⚠️  Strategy 2 failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (!dropdownOpened) {
        // Strategy 3: Find button with aria-haspopup="menu" in header (user dropdown has this)
        try {
          const menuButtons = await header.locator('button[aria-haspopup="menu"]').all();
          for (const button of menuButtons) {
            try {
              if (!(await button.isVisible({ timeout: 1000 }))) continue;
              
              // Check if it has rounded-full span (Avatar) - distinguishes from theme toggle
              const hasRoundedFull = await button.locator('span[class*="rounded-full"]').count().catch(() => 0);
              if (hasRoundedFull > 0) {
                await button.scrollIntoViewIfNeeded();
                await delay(300);
                await button.click();
                console.log("  ✅ User dropdown opened (button with aria-haspopup and rounded-full)");
                dropdownOpened = true;
                break;
              }
            } catch (error) {
              continue;
            }
          }
        } catch (error) {
          console.log(`  ⚠️  Strategy 3 failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (!dropdownOpened) {
        // Strategy 4: Find all buttons and check for the specific structure
        try {
          const allHeaderButtons = await header.locator('button').all();
          console.log(`  🔍 Found ${allHeaderButtons.length} button(s) in header, checking structure...`);
          
          for (const button of allHeaderButtons) {
            try {
              if (!(await button.isVisible({ timeout: 1000 }))) continue;
              
              // Check for the exact structure: rounded-full span AND aria-haspopup="menu"
              const hasRoundedFull = await button.locator('span[class*="rounded-full"]').count().catch(() => 0);
              const ariaHaspopup = await button.getAttribute('aria-haspopup').catch(() => "");
              
              if (hasRoundedFull > 0 && ariaHaspopup === 'menu') {
                await button.scrollIntoViewIfNeeded();
                await delay(300);
                await button.click();
                const buttonText = (await button.textContent().catch(() => "")) || "";
                console.log(`  ✅ User dropdown opened (found button with structure: "${buttonText.trim()}")`);
                dropdownOpened = true;
                break;
              }
            } catch (error) {
              continue;
            }
          }
        } catch (error) {
          console.log(`  ⚠️  Strategy 4 failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (!dropdownOpened) {
        // Strategy 5: Use page.evaluate with exact structure matching
        try {
          console.log("  🔍 Strategy 5: Using page.evaluate with exact structure...");
          const clicked = await page.evaluate(() => {
            const header = document.querySelector('header');
            if (!header) return false;
            
            // Find all buttons in header
            const buttons = Array.from(header.querySelectorAll('button'));
            
            // Find button with aria-haspopup="menu" AND rounded-full span
            for (const button of buttons) {
              const ariaHaspopup = button.getAttribute('aria-haspopup');
              const roundedFullSpan = button.querySelector('span[class*="rounded-full"]');
              
              if (ariaHaspopup === 'menu' && roundedFullSpan !== null) {
                const rect = button.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  (button as HTMLElement).click();
                  return true;
                }
              }
            }
            return false;
          });
          
          if (clicked) {
            console.log("  ✅ User dropdown opened (via page.evaluate)");
            dropdownOpened = true;
            await delay(500); // Wait for dropdown to appear
          }
        } catch (error) {
          console.log(`  ⚠️  Strategy 5 failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (!dropdownOpened) {
        throw new Error("Could not find or click user dropdown button");
      }
      
      // Wait for dropdown menu to appear
      console.log("  ⏳ Waiting for dropdown menu to appear...");
      await delay(800); // Give time for dropdown animation
      
      // Wait for the dropdown menu content to be visible
      try {
        await page.waitForSelector(
          '[role="menu"], [role="menuitem"], [data-radix-popper-content-wrapper]',
          { timeout: 2000, state: 'visible' }
        );
        console.log("  ✅ Dropdown menu is visible");
      } catch (error) {
        console.log("  ⚠️  Dropdown menu may not be fully visible, continuing...");
      }
      
      // Click on "Log out" menu item
      // Radix UI dropdown items might not have role="menuitem", so we need to find by text content
      console.log("  🔘 Clicking Log out menu item...");
      
      let logoutClicked = false;
      
      // Strategy 1: Find by span containing "Log out" and click its parent
      try {
        console.log("  🔍 Strategy 1: Looking for span with 'Log out' text...");
        const logoutSpan = page.locator('span:has-text("Log out"), span:has-text("Logout")').first();
        if (await logoutSpan.isVisible({ timeout: 2000 })) {
          // Get the parent element (the actual clickable menu item)
          const logoutItem = logoutSpan.locator('..').first();
          await logoutItem.scrollIntoViewIfNeeded();
          await delay(200);
          await logoutItem.click();
          console.log("  ✅ Log out clicked (via span parent)");
          logoutClicked = true;
        }
      } catch (error) {
        console.log("  ⚠️  Strategy 1 failed, trying next...");
      }
      
      if (!logoutClicked) {
        // Strategy 2: Find any element containing "Log out" text in the dropdown
        try {
          console.log("  🔍 Strategy 2: Looking for any element with 'Log out' text in dropdown...");
          const logoutElements = await page.locator('*:has-text("Log out"), *:has-text("Logout")').all();
          for (const element of logoutElements) {
            try {
              const elementText = (await element.textContent().catch(() => "")) || "";
              const isVisible = await element.isVisible({ timeout: 500 }).catch(() => false);
              
              // Check if it's actually "Log out" and is visible
              if (isVisible && (elementText.toLowerCase().includes('log out') || elementText.toLowerCase().includes('logout'))) {
                // Check if it's in the dropdown menu (not in header or elsewhere)
                const isInDropdown = await element.evaluate((el) => {
                  return el.closest('[data-radix-popper-content-wrapper]') !== null ||
                         el.closest('[role="menu"]') !== null ||
                         el.closest('[class*="dropdown"]') !== null;
                }).catch(() => false);
                
                if (isInDropdown) {
                  // Try clicking the element itself, or its closest clickable parent
                  await element.scrollIntoViewIfNeeded();
                  await delay(200);
                  
                  // Try clicking the element
                  try {
                    await element.click();
                    console.log(`  ✅ Log out clicked (found element with text: "${elementText.trim()}")`);
                    logoutClicked = true;
                    break;
                  } catch (clickError) {
                    // If direct click fails, try clicking parent
                    try {
                      const parent = element.locator('..').first();
                      await parent.click();
                      console.log(`  ✅ Log out clicked (via parent of element with text: "${elementText.trim()}")`);
                      logoutClicked = true;
                      break;
                    } catch (parentError) {
                      continue;
                    }
                  }
                }
              }
            } catch (error) {
              continue;
            }
          }
        } catch (error) {
          console.log("  ⚠️  Strategy 2 failed, trying next...");
        }
      }
      
      if (!logoutClicked) {
        // Strategy 3: Find all clickable elements in dropdown and check their text
        try {
          console.log("  🔍 Strategy 3: Iterating all clickable elements in dropdown...");
          
          // Get dropdown content container
          const dropdownContent = page.locator('[data-radix-popper-content-wrapper], [role="menu"], [class*="dropdown-content"]').first();
          
          if (await dropdownContent.isVisible({ timeout: 2000 })) {
            // Get all clickable elements (divs, buttons, etc.) in the dropdown
            const clickableElements = await dropdownContent.locator('div, button, a, [role="menuitem"]').all();
            
            for (const element of clickableElements) {
              try {
                const elementText = (await element.textContent().catch(() => "")) || "";
                const isVisible = await element.isVisible({ timeout: 500 }).catch(() => false);
                
                if (isVisible && (elementText.toLowerCase().includes('log out') || elementText.toLowerCase().includes('logout'))) {
                  await element.scrollIntoViewIfNeeded();
                  await delay(200);
                  await element.click();
                  console.log(`  ✅ Log out clicked (found clickable element: "${elementText.trim()}")`);
                  logoutClicked = true;
                  break;
                }
              } catch (error) {
                continue;
              }
            }
          }
        } catch (error) {
          console.log("  ⚠️  Strategy 3 failed, trying next...");
        }
      }
      
      if (!logoutClicked) {
        // Strategy 4: Use page.evaluate to find and click the logout item
        try {
          console.log("  🔍 Strategy 4: Using page.evaluate to find logout element...");
          const clicked = await page.evaluate(() => {
            // Find all elements containing "Log out" or "Logout"
            const allElements = Array.from(document.querySelectorAll('*'));
            const logoutElements = allElements.filter(el => {
              const text = el.textContent || '';
              if (!(el instanceof HTMLElement)) return false;
              return (text.toLowerCase().includes('log out') || text.toLowerCase().includes('logout')) &&
                     el.offsetParent !== null; // Element is visible
            });
            
            // Find the one in the dropdown menu
            for (const el of logoutElements) {
              // Check if it's in a dropdown menu
              const isInDropdown = el.closest('[data-radix-popper-content-wrapper]') !== null ||
                                   el.closest('[role="menu"]') !== null ||
                                   el.closest('[class*="dropdown"]') !== null;
              
              if (isInDropdown) {
                // Try to find the clickable parent (usually a div with cursor-pointer or similar)
                let clickableEl: HTMLElement | null = el as HTMLElement;
                
                // Walk up the DOM to find a clickable parent
                while (clickableEl && clickableEl !== document.body) {
                  const style = window.getComputedStyle(clickableEl);
                  const cursor = style.cursor;
                  const hasClickHandler = clickableEl.onclick !== null || 
                                         clickableEl.getAttribute('onclick') !== null;
                  
                  if (cursor === 'pointer' || hasClickHandler || clickableEl.tagName === 'BUTTON' || 
                      clickableEl.getAttribute('role') === 'menuitem') {
                    clickableEl.click();
                    return true;
                  }
                  clickableEl = clickableEl.parentElement;
                }
                
                // If no clickable parent found, try clicking the element itself
                (el as HTMLElement).click();
                return true;
              }
            }
            return false;
          });
          
          if (clicked) {
            console.log("  ✅ Log out clicked (via page.evaluate)");
            logoutClicked = true;
            await delay(500); // Wait for click to register
          }
        } catch (error) {
          console.log(`  ⚠️  Strategy 4 failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (logoutClicked) {
        signoutPerformed = true;
        // Wait for logout to complete (navigation to '/' or login page)
        console.log("  ⏳ Waiting for logout to complete...");
        try {
          await page.waitForURL(/\/(login|$)/, { timeout: 5000 });
          console.log("  ✅ Logged out successfully");
        } catch (error) {
          console.log("  ⚠️  May still be logged in, continuing...");
        }
        await delay(1000);
      } else {
        console.log("  ⚠️  Could not find or click Log out menu item");
      }
    } catch (error) {
      console.log(
        `  ⚠️  Could not sign out: ${error instanceof Error ? error.message : String(error)}, continuing...`,
      );
    }
    const signoutEndTime = Date.now();

    console.log(`  🌐 Navigating to ${config.baseUrl}...`);
    await page.goto(config.baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await delay(10000);

    const duration = Date.now() - startTime;
    console.log(
      `✅ Property Details scene completed in ${(duration / 1000).toFixed(1)}s`,
    );

    const result: SceneResult = {
      success: true,
      duration,
    };
    
    // Collect all wait cuts
    const waitCuts: Array<{ startOffsetMs: number; endOffsetMs: number }> = [];
    
    // Add wait cut for initial navigation/loading until details page is displayed
    if (detailsPageDisplayedTime && detailsPageDisplayedTime > startTime) {
      waitCuts.push({
        startOffsetMs: 0, // From the start of the scene
        endOffsetMs: detailsPageDisplayedTime - startTime,
      });
      console.log(
        `  📊 Initial navigation wait cut: ${((detailsPageDisplayedTime - startTime) / 1000).toFixed(1)}s will be removed from final video`,
      );
    }
    
    // Add wait cut for signout if it was performed
    if (signoutPerformed && signoutStartTime && signoutEndTime && signoutEndTime > signoutStartTime) {
      waitCuts.push({
        startOffsetMs: signoutStartTime - startTime,
        endOffsetMs: signoutEndTime - startTime,
      });
      console.log(
        `  📊 Signout wait cut: ${((signoutEndTime - signoutStartTime) / 1000).toFixed(1)}s will be removed from final video`,
      );
    }
    
    // Set waitCuts if we have any
    if (waitCuts.length > 0) {
      result.waitCuts = waitCuts;
      console.log(`  📊 Total wait cuts: ${waitCuts.length}`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Property Details scene failed:", error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
