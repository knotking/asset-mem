import { Page } from "playwright";
import { config } from "../config";
import { SceneResult } from "../helpers";
import { delay, enhancedClick } from "../helpers";
import * as path from "path";

export async function recordPropertyOnboarding(
  page: Page
): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene: Property Onboarding");

    // Navigate to dashboard/home page (may have navigated to a property page in previous scene)
    console.log("  🔄 Navigating to dashboard/home page...");
    const currentUrl = page.url();
    console.log(`  ℹ️  Current URL: ${currentUrl}`);

    // If we're on a property page or not on /home, navigate to dashboard
    if (currentUrl.includes("/properties/") || !currentUrl.includes("/home")) {
      console.log("  🔄 Navigating to dashboard (was on property page)...");
      await page.goto(`${config.baseUrl}/home`, {
        waitUntil: "load",
      });
      await delay(2000);
    } else {
      console.log("  ℹ️  Already on dashboard/home page");
    }

    // Wait for dashboard to load - wait for the grid or property cards container
    console.log("  ⏳ Waiting for dashboard to load...");
    try {
      await page.waitForSelector(
        'div[class*="grid"], a[href*="/properties/"], button:has-text("Add New Property"), div:has-text("Add New Property")',
        {
          timeout: 10000,
          state: "visible",
        }
      );
      await delay(1000);
      console.log("  ✅ Dashboard loaded");
    } catch (error) {
      console.log("  ⚠️  Dashboard may not be fully loaded, continuing...");
    }

    // Wait for "Add New Property" button to be visible with multiple strategies
    console.log("  ⏳ Waiting for 'Add New Property' button to be visible...");
    let addPropertyVisible = false;
    const maxWaitTime = 15000; // Increased to 15 seconds
    const waitStartTime = Date.now();

    while (!addPropertyVisible && Date.now() - waitStartTime < maxWaitTime) {
      try {
        // Try multiple selectors
        const selectors = [
          'button:has-text("Add New Property")',
          'a[href*="/new-property"]',
          'div:has-text("Add New Property")',
          'button:has-text("Add New Property")',
          'div:has-text("Add New Property")',
        ];

        for (const selector of selectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 500 })) {
              addPropertyVisible = true;
              console.log(
                `  ✅ 'Add New Property' button is visible (found with: ${selector})`
              );
              break;
            }
          } catch (error) {
            continue;
          }
        }

        if (addPropertyVisible) break;
      } catch (error) {
        // Continue waiting
      }
      await delay(500);
    }

    if (!addPropertyVisible) {
      console.log(
        "  ⚠️  'Add New Property' button may not be visible, but will try to find it anyway..."
      );
      // Try to find it using page.evaluate as a last resort
      try {
        const found = await page.evaluate(() => {
          const buttons = Array.from(
            document.querySelectorAll("button, a, div")
          );
          return buttons.find((el) => {
            const text = el.textContent?.toLowerCase() || "";
            const href = el.getAttribute("href") || "";
            return (
              text.includes("add new property") ||
              text.includes("upload documents") ||
              href.includes("/new-property")
            );
          });
        });
        if (found) {
          console.log(
            "  ✅ Found 'Add New Property' button using page.evaluate"
          );
          addPropertyVisible = true;
        }
      } catch (error) {
        console.log("  ⚠️  Could not find button using page.evaluate");
      }
    }

    // Find and click "Add New Property" card directly from dashboard
    // Make sure we're clicking the "Add New Property" button, not an existing property card
    console.log("  ➕ Clicking 'Add New Property' card from dashboard...");

    // First, try to find all potential "Add New Property" elements and verify they're not property cards
    const addPropertySelectors = [
      'button:has-text("Add New Property")',
      'a[href*="/new-property"]',
      'button:has-text("Add New Property")',
      'div:has-text("Add New Property")',
    ];

    let addPropertyClicked = false;
    for (const selector of addPropertySelectors) {
      try {
        // Get all matching elements
        const allMatches = await page.locator(selector).all();

        for (const element of allMatches) {
          if (!(await element.isVisible({ timeout: 1000 }))) continue;

          // Verify this is actually the "Add New Property" button, not a property card
          const elementText =
            (await element.textContent().catch(() => "")) || "";
          const elementHref = await element
            .getAttribute("href")
            .catch(() => "");

          // Check if it contains "Add New Property" text or links to new-property
          const isAddPropertyButton =
            elementText.toLowerCase().includes("add new property") ||
            elementText.toLowerCase().includes("upload documents") ||
            elementHref?.includes("/new-property") ||
            selector.includes("add-property-card");

          // Exclude if it looks like an existing property card (has address, property name, etc.)
          const isPropertyCard =
            elementText.match(
              /\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|blvd|boulevard)/i
            ) ||
            elementText.match(/^\w+,\s*\w{2}\s+\d{5}/) || // Address format
            (elementHref &&
              elementHref.includes("/properties/") &&
              !elementHref.includes("/new-property"));

          if (isAddPropertyButton && !isPropertyCard) {
            await element.scrollIntoViewIfNeeded();
            await delay(300);
            await enhancedClick(page, element, {
              afterClickDelay: 1000,
            });
            console.log(
              `  ✅ Found and clicked 'Add New Property' with selector: ${selector}`
            );
            addPropertyClicked = true;
            break;
          }
        }

        if (addPropertyClicked) break;
      } catch (error) {
        continue;
      }
    }

    // If still not found, try a more specific approach - find the card with "Add New Property" text
    if (!addPropertyClicked) {
      try {
        // Look for divs or cards that contain "Add New Property" text
        const allCards = await page.locator("div, button, a").all();
        for (const card of allCards) {
          try {
            if (!(await card.isVisible({ timeout: 500 }))) continue;

            const cardText = (await card.textContent().catch(() => "")) || "";
            const cardHref = await card.getAttribute("href").catch(() => "");

            // Check if it's the "Add New Property" card
            if (
              (cardText.toLowerCase().includes("add new property") ||
                cardText.toLowerCase().includes("upload documents")) &&
              !cardText.match(/\d{1,5}\s+\w+\s+(street|st|avenue|ave)/i) && // Not an address
              (cardHref?.includes("/new-property") || !cardHref)
            ) {
              await card.scrollIntoViewIfNeeded();
              await delay(300);
              await enhancedClick(page, card, {
                afterClickDelay: 1000,
              });
              console.log(
                "  ✅ Found and clicked 'Add New Property' card (fallback method)"
              );
              addPropertyClicked = true;
              break;
            }
          } catch (error) {
            continue;
          }
        }
      } catch (error) {
        console.log(
          `  ⚠️  Fallback method failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (!addPropertyClicked) {
      throw new Error(
        "Could not find 'Add New Property' button on dashboard/home page"
      );
    }

    // Wait for navigation to new property page
    console.log("  ⏳ Waiting for navigation to new property page...");
    try {
      await page.waitForURL("**/new-property**", { timeout: 10000 });
      console.log("  ✅ Navigated to new property page");
      await delay(2000);
    } catch (error) {
      console.log(
        `  ⚠️  URL may not have changed to new-property: ${error instanceof Error ? error.message : String(error)}, continuing...`
      );
      await delay(2000);
    }

    // Wait for upload dialog to appear
    console.log("  ⏳ Waiting for upload dialog to appear...");
    try {
      await page.waitForSelector(
        '[role="dialog"]:has-text("Upload"), [role="dialog"]:has-text("Property Type"), button:has-text("Upload Documents")',
        {
          timeout: 5000,
          state: "visible",
        }
      );
      console.log("  ✅ Upload dialog is visible");
      await delay(1000);
    } catch (error) {
      console.log(
        "  ⚠️  Upload dialog may not be visible, checking if we need to open it..."
      );
      // Try to find and click upload button if dialog is not open
      try {
        const uploadButton = page
          .locator(
            'button:has-text("Upload Documents"), button:has-text("Upload")'
          )
          .first();
        if (await uploadButton.isVisible({ timeout: 3000 })) {
          await uploadButton.click();
          await delay(1000);
        }
      } catch (error) {
        console.log("  ⚠️  Could not find upload button, continuing...");
      }
    }

    // Select property type if available
    console.log("  🏠 Selecting property type...");
    try {
      const propertyTypeSelect = page
        .locator(
          'select, [role="combobox"]:has-text("Property Type"), button:has-text("Select")'
        )
        .first();
      if (await propertyTypeSelect.isVisible({ timeout: 3000 })) {
        await propertyTypeSelect.click();
        await delay(500);
        // Select "Real Estate" or first option
        const realEstateOption = page
          .locator(
            'text="Real Estate", [role="option"]:has-text("Real Estate")'
          )
          .first();
        if (await realEstateOption.isVisible({ timeout: 2000 })) {
          await realEstateOption.click();
          console.log("  ✅ Selected 'Real Estate' property type");
        } else {
          // Select first available option
          const firstOption = page.locator('[role="option"]').first();
          if (await firstOption.isVisible({ timeout: 2000 })) {
            await firstOption.click();
            console.log("  ✅ Selected first property type option");
          }
        }
        await delay(500);
      } else {
        console.log("  ℹ️  Property type selector not found, skipping...");
      }
    } catch (error) {
      console.log(
        `  ⚠️  Could not select property type: ${error instanceof Error ? error.message : String(error)}, continuing...`
      );
    }

    // Upload a sample document
    console.log("  📄 Uploading document...");
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
      const sampleDocPath = path.join(recordingsDir, "HomePolicyDocument.pdf");

      // Find file input - don't try to click it, just set files directly
      // Playwright can set files on hidden inputs without clicking, which avoids
      // the interception issue with SVG overlay elements
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
      await fileInput.setInputFiles(sampleDocPath);
      console.log(`  ✅ Document uploaded: ${path.basename(sampleDocPath)}`);
      await delay(1000); // Brief delay for file to be set
    } catch (error) {
      console.log(
        `  ⚠️  Could not upload document: ${error instanceof Error ? error.message : String(error)}`
      );
      // Note: setInputFiles should work even on hidden inputs, so if this fails,
      // there may be a different issue (file not found, dialog not open, etc.)
    }

    // Click on the "Upload Documents" button after file is uploaded
    // The button text may be "Upload 1 Document" or "Upload Documents" depending on file count
    console.log("  🔘 Clicking 'Upload Documents' button...");
    const buttonSearchStartTime = Date.now();

    try {
      // Wait a moment for the button to appear with updated text (e.g., "Upload 1 Document")
      console.log("  ⏳ Waiting 1 second for button text to update...");
      await delay(1000);
      console.log(
        `  ⏱️  Elapsed: ${((Date.now() - buttonSearchStartTime) / 1000).toFixed(1)}s`
      );

      const uploadButtonSelectors = [
        'button:has-text("Upload")', // Matches "Upload 1 Document", "Upload Documents", etc.
        'button[type="submit"]:has-text("Upload")',
        'button:has-text("Upload Documents")',
        'button:has-text("Upload Document")',
      ];

      let uploadButtonClicked = false;
      console.log(
        `  🔍 Trying ${uploadButtonSelectors.length} selector strategies...`
      );

      for (let i = 0; i < uploadButtonSelectors.length; i++) {
        const selector = uploadButtonSelectors[i];
        const selectorStartTime = Date.now();
        console.log(
          `  🔍 [${i + 1}/${uploadButtonSelectors.length}] Trying selector: ${selector}`
        );

        try {
          // Get all matching buttons and find the one that's actually visible and clickable
          console.log(`    ⏳ Locating buttons with selector...`);
          const allButtons = await page.locator(selector).all();
          console.log(
            `    ✅ Found ${allButtons.length} button(s) with selector (took ${((Date.now() - selectorStartTime) / 1000).toFixed(1)}s)`
          );

          if (allButtons.length === 0) {
            console.log(
              `    ⚠️  No buttons found with this selector, trying next...`
            );
            continue;
          }

          // First, collect all buttons with their text to prioritize correctly
          const buttonInfo: Array<{
            button: any;
            index: number;
            text: string;
            hasNumber: boolean;
          }> = [];

          for (let j = 0; j < allButtons.length; j++) {
            const button = allButtons[j];
            try {
              const isVisible = await button.isVisible({ timeout: 500 });
              if (!isVisible) continue;

              const buttonText =
                (await button.textContent().catch(() => "")) || "";
              if (buttonText.toLowerCase().includes("upload")) {
                // Check if button text contains a number (e.g., "Upload 1 Document")
                const hasNumber = /\d/.test(buttonText);
                buttonInfo.push({
                  button,
                  index: j + 1,
                  text: buttonText.trim(),
                  hasNumber,
                });
                console.log(
                  `    📝 Button ${j + 1} text: "${buttonText.trim()}" (has number: ${hasNumber})`
                );
              }
            } catch (error) {
              continue;
            }
          }

          // Sort buttons: prioritize those with numbers (like "Upload 1 Document") first
          // This avoids the modal overlay interception issue with the generic "Upload Documents" button
          buttonInfo.sort((a, b) => {
            if (a.hasNumber && !b.hasNumber) return -1; // Buttons with numbers first
            if (!a.hasNumber && b.hasNumber) return 1;
            return 0;
          });

          console.log(
            `    📋 Found ${buttonInfo.length} upload button(s), prioritizing buttons with numbers first...`
          );

          // Try buttons in priority order (with numbers first, like "Upload 1 Document")
          for (const { button, index, text } of buttonInfo) {
            const buttonCheckStartTime = Date.now();
            console.log(
              `    🔍 Checking button ${index} (priority order): "${text}"...`
            );

            try {
              await button.scrollIntoViewIfNeeded();
              await delay(300);

              // Try enhanced click for better reliability
              const clickStartTime = Date.now();
              await enhancedClick(page, button, {
                afterClickDelay: 500,
              });
              console.log(
                `      ✅ Clicked button ${index} (took ${((Date.now() - clickStartTime) / 1000).toFixed(1)}s)`
              );

              console.log(`  ✅ Clicked 'Upload Documents' button: "${text}"`);
              console.log(
                `  ⏱️  Total time to find and click button: ${((Date.now() - buttonSearchStartTime) / 1000).toFixed(1)}s`
              );
              uploadButtonClicked = true;
              await delay(1000); // Wait for upload to start
              break;
            } catch (error) {
              console.log(
                `      ⚠️  Error clicking button ${index}: ${error instanceof Error ? error.message : String(error)} (took ${((Date.now() - buttonCheckStartTime) / 1000).toFixed(1)}s)`
              );
              // Continue to next button if this one fails
              continue;
            }
          }

          if (uploadButtonClicked) {
            console.log(
              `  ✅ Successfully clicked button using selector ${i + 1}`
            );
            break;
          } else {
            console.log(
              `  ⚠️  No clickable upload button found with selector ${i + 1}, trying next...`
            );
          }
        } catch (error) {
          console.log(
            `  ⚠️  Error with selector ${i + 1}: ${error instanceof Error ? error.message : String(error)} (took ${((Date.now() - selectorStartTime) / 1000).toFixed(1)}s)`
          );
          continue;
        }
      }

      if (!uploadButtonClicked) {
        console.log(
          `  ⚠️  'Upload Documents' button not found after ${uploadButtonSelectors.length} selectors, trying alternative method...`
        );
        console.log(
          `  ⏱️  Total time so far: ${((Date.now() - buttonSearchStartTime) / 1000).toFixed(1)}s`
        );

        // Try to find button in dialog footer
        const altStartTime = Date.now();
        try {
          console.log(
            `  🔍 Trying alternative: looking for button in dialog footer...`
          );
          const dialogFooter = page
            .locator(
              '[role="dialog"] [class*="footer"], [role="dialog"] button'
            )
            .last();
          const footerVisible = await dialogFooter.isVisible({ timeout: 2000 });
          console.log(
            `    👁️  Dialog footer visibility: ${footerVisible} (took ${((Date.now() - altStartTime) / 1000).toFixed(1)}s)`
          );

          if (footerVisible) {
            const footerText =
              (await dialogFooter.textContent().catch(() => "")) || "";
            console.log(`    📝 Footer text: "${footerText.trim()}"`);

            if (footerText.toLowerCase().includes("upload")) {
              await dialogFooter.click();
              console.log(`  ✅ Clicked upload button via dialog footer`);
              uploadButtonClicked = true;
              await delay(1000);
            } else {
              console.log(`    ⚠️  Footer doesn't contain "upload" text`);
            }
          }
        } catch (error) {
          console.log(
            `  ⚠️  Alternative method failed: ${error instanceof Error ? error.message : String(error)} (took ${((Date.now() - altStartTime) / 1000).toFixed(1)}s)`
          );
        }
      }

      console.log(
        `  ⏱️  Total time for button search: ${((Date.now() - buttonSearchStartTime) / 1000).toFixed(1)}s`
      );
    } catch (error) {
      console.log(
        `  ⚠️  Could not click 'Upload Documents' button: ${error instanceof Error ? error.message : String(error)}, continuing...`
      );
    }

    // Wait 30 seconds after document upload before completing the scene
    console.log("  ⏸️  Waiting 45 seconds after document upload...");
    await delay(45000);

    const duration = Date.now() - startTime;
    console.log(
      `✅ Property Onboarding scene completed in ${(duration / 1000).toFixed(1)}s`
    );

    return {
      success: true,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Property Onboarding scene failed:", error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
