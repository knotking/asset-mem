import { Page } from "playwright";
import { config } from "../config";
import { SceneResult } from "../helpers";
import {
  delay,
  clickWithRetry,
  waitForVisible,
  scrollSmoothly,
  enhancedClick,
} from "../helpers";
import * as path from "path";

export async function recordTimelineCheckpoint(
  page: Page
): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene: Timeline Checkpoint Creation");

    // Ensure we're on a property page
    if (!page.url().includes("/properties/")) {
      throw new Error("Not on a property page");
    }

    // Navigate to timeline/checkpoints tab
    console.log("  🔘 Navigating to Timeline tab...");
    try {
      const timelineTab = page
        .locator(config.selectors.propertyDetails.timelineTab)
        .first();
      if (await timelineTab.isVisible({ timeout: 5000 })) {
        await timelineTab.click();
        await page.waitForURL("**/checkpoints**", { timeout: 5000 });
      } else {
        // Try navigating directly
        const currentUrl = page.url();
        const propertyId = currentUrl.match(/\/properties\/([^\/]+)/)?.[1];
        if (propertyId) {
          await page.goto(
            `${config.baseUrl}/home/properties/${propertyId}/checkpoints`,
            {
              waitUntil: "load",
              timeout: 30000,
            }
          );
        }
      }
    } catch (error) {
      console.log("  ⚠️  Could not navigate to timeline tab, continuing...");
    }

    // Wait for page to load (use 'load' instead of 'networkidle' which is too strict)
    try {
      await page.waitForLoadState("load", { timeout: 10000 }).catch(() => {
        console.log(
          "  ⚠️  Load state timeout, but page may be ready, continuing..."
        );
      });
    } catch (error) {
      console.log("  ⚠️  Could not wait for load state, continuing...");
    }

    // Wait for the timeline/checkpoints page content to be visible instead
    try {
      await page.waitForSelector(
        'h1:has-text("Timeline"), h1:has-text("Property Timeline"), button:has-text("Add Checkpoint"), [class*="checkpoint"]',
        {
          timeout: 5000,
          state: "visible",
        }
      );
      console.log("  ✅ Timeline page content is visible");
    } catch (error) {
      console.log(
        "  ⚠️  Timeline content may not be visible yet, continuing..."
      );
    }

    await delay(2000);

    // Show checkpoint list
    console.log("  📋 Showing checkpoint list...");
    try {
      const checkpointList = page
        .locator(config.selectors.timeline.checkpointList)
        .first();
      if (await checkpointList.isVisible({ timeout: 5000 })) {
        await scrollSmoothly(page, config.selectors.timeline.checkpointList);
        await delay(1000);
      }
    } catch (error) {
      console.log("  ⚠️  Checkpoint list not found, continuing...");
    }

    // Try to click on an existing checkpoint to view details
    console.log("  👆 Clicking checkpoint to view details...");
    try {
      const checkpointCard = page
        .locator(config.selectors.timeline.checkpointCard)
        .first();
      if (await checkpointCard.isVisible({ timeout: 5000 })) {
        await checkpointCard.click();
        await delay(2000);
        // Close the detail view
        await page.keyboard.press("Escape");
        await delay(1000);
      }
    } catch (error) {
      console.log("  ⚠️  No checkpoint cards found, will create new one...");
    }

    // Create new checkpoint
    console.log("  ➕ Creating new checkpoint...");
    try {
      // Find and click the "Add Checkpoint" or "Create Checkpoint" button
      const createButtonSelectors = [
        'button:has-text("Add Checkpoint")',
        'button:has-text("Create Checkpoint")',
        'button:has-text("New Checkpoint")',
        config.selectors.timeline.createCheckpointButton,
      ];

      let createButtonClicked = false;
      for (const selector of createButtonSelectors) {
        try {
          const createButton = page.locator(selector).first();
          if (await createButton.isVisible({ timeout: 5000 })) {
            console.log(`  🔘 Found create checkpoint button: ${selector}`);
            await createButton.scrollIntoViewIfNeeded();
            await delay(300);
            await createButton.click();
            await delay(1000); // Wait for dialog to open
            createButtonClicked = true;
            console.log("  ✅ Create checkpoint dialog opened");
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!createButtonClicked) {
        console.log(
          "  ⚠️  Could not find create checkpoint button, skipping..."
        );
      } else {
        // Wait for dialog to be visible
        await page
          .waitForSelector(
            '[role="dialog"]:has-text("Create New Checkpoint"), [class*="DialogContent"]:has-text("Create New Checkpoint")',
            {
              timeout: 3000,
              state: "visible",
            }
          )
          .catch(() => {
            console.log("  ⚠️  Dialog may not be visible, continuing...");
          });

        await delay(500);

        // Fill in checkpoint name (required)
        console.log("  📝 Filling in checkpoint name...");
        try {
          const nameInput = page
            .locator(
              'input[id="name"], input[placeholder*="name" i], input[placeholder*="Kitchen" i]'
            )
            .first();
          if (await nameInput.isVisible({ timeout: 3000 })) {
            await nameInput.fill("Demo Property Inspection");
            await delay(500);
            console.log("  ✅ Checkpoint name filled");
          }
        } catch (error) {
          console.log("  ⚠️  Could not find name input, trying alternative...");
        }

        // Select Asset Type (optional but good to show)
        console.log("  🏠 Selecting asset type...");
        try {
          const assetTypeSelect = page
            .locator(
              'select[id="asset-type"], button:has-text("Select asset type"), [role="combobox"]:has-text("Select asset type")'
            )
            .first();
          if (await assetTypeSelect.isVisible({ timeout: 3000 })) {
            await assetTypeSelect.click();
            await delay(400);
            // Select "Real Estate" (first option, default)
            const realEstateOption = page
              .locator(
                'text="Real Estate", [role="option"]:has-text("Real Estate")'
              )
              .first();
            if (await realEstateOption.isVisible({ timeout: 2000 })) {
              await realEstateOption.click();
              await delay(500);
              console.log("  ✅ Asset type selected: Real Estate");
            }
          }
        } catch (error) {
          console.log("  ⚠️  Could not select asset type, continuing...");
        }

        // Select Location (optional)
        console.log("  📍 Selecting location...");
        try {
          const locationSelect = page
            .locator(
              'select[id="location"], button:has-text("Select location"), [role="combobox"]:has-text("Select location")'
            )
            .first();
          if (await locationSelect.isVisible({ timeout: 3000 })) {
            await locationSelect.click();
            await delay(400);
            // Select "Kitchen" as a common location
            const kitchenOption = page
              .locator('text="Kitchen", [role="option"]:has-text("Kitchen")')
              .first();
            if (await kitchenOption.isVisible({ timeout: 2000 })) {
              await kitchenOption.click();
              await delay(500);
              console.log("  ✅ Location selected: Kitchen");
            } else {
              // If Kitchen not found, select first available location
              const firstLocation = page.locator('[role="option"]').first();
              if (await firstLocation.isVisible({ timeout: 1000 })) {
                await firstLocation.click();
                await delay(500);
                console.log("  ✅ Location selected (first option)");
              } else {
                await page.keyboard.press("Escape");
                await delay(200);
              }
            }
          }
        } catch (error) {
          console.log("  ⚠️  Could not select location, continuing...");
        }

        // Fill in description (optional)
        console.log("  📄 Adding description...");
        try {
          const descriptionInput = page
            .locator(
              'textarea[id="description"], textarea[placeholder*="notes" i], textarea[placeholder*="Description" i]'
            )
            .first();
          if (await descriptionInput.isVisible({ timeout: 3000 })) {
            await descriptionInput.fill(
              "This is a demo checkpoint created for recording purposes."
            );
            await delay(500);
            console.log("  ✅ Description filled");
          }
        } catch (error) {
          console.log("  ⚠️  Could not find description input, continuing...");
        }

        // Upload photo (required) - use the same photo as in AI Chat scene
        console.log("  📸 Uploading photo...");
        try {
          // Use the same DoorPaintGood.png image from the scenes directory
          const photoPath = path.join(__dirname, "DoorPaintGood.png");

          // The FileUploadZone has a hidden file input that covers the drop zone
          // We can interact with it directly even though it's hidden
          const fileInput = page.locator('input[type="file"]').first();

          // Wait for the file input to be present (it might be hidden but still accessible)
          try {
            await fileInput.waitFor({ timeout: 3000, state: "attached" });
            // Set the file directly (Playwright can interact with hidden inputs)
            await fileInput.setInputFiles(photoPath);
            console.log(`  ✅ Photo uploaded: ${path.basename(photoPath)}`);
            await delay(2000); // Wait for file to be processed and preview to appear

            // Wait for file preview to be visible (indicates successful upload)
            try {
              await page.waitForSelector(
                'img[src^="blob:"], [class*="preview"]',
                {
                  timeout: 3000,
                  state: "visible",
                }
              );
              console.log("  ✅ Photo preview displayed");
            } catch (error) {
              console.log(
                "  ⚠️  Photo preview may not be visible, but file should be uploaded"
              );
            }
          } catch (error) {
            console.log(
              "  ⚠️  Could not find file input, trying alternative method..."
            );
            // Alternative: Click on the drop zone area and then set files
            try {
              const dropZone = page
                .locator(
                  'div:has-text("Drop files here"), div[class*="border-dashed"]'
                )
                .first();
              if (await dropZone.isVisible({ timeout: 2000 })) {
                // Click on the drop zone (which triggers the file input)
                await dropZone.click();
                await delay(500);
                // Now try to set the file
                const fileInputAfterClick = page
                  .locator('input[type="file"]')
                  .first();
                if ((await fileInputAfterClick.count()) > 0) {
                  await fileInputAfterClick.setInputFiles(photoPath);
                  console.log(
                    `  ✅ Photo uploaded via drop zone click: ${path.basename(photoPath)}`
                  );
                  await delay(2000);
                }
              }
            } catch (error) {
              console.log(
                "  ⚠️  Alternative upload method also failed, but continuing..."
              );
            }
          }
        } catch (error) {
          console.log(
            `  ⚠️  Photo upload failed: ${error instanceof Error ? error.message : String(error)}, but continuing...`
          );
        }

        // Show the filled form for a moment before submitting
        await delay(1000);
        console.log("  👁️  Showing filled checkpoint form for 2 seconds...");
        await delay(2000);

        // Submit the form by clicking "Create Checkpoint" button
        console.log("  ✅ Submitting checkpoint creation...");
        try {
          const submitButton = page
            .locator(
              'button:has-text("Create Checkpoint"), button:has-text("Create"):not(:has-text("Cancel"))'
            )
            .first();
          if (await submitButton.isVisible({ timeout: 3000 })) {
            await submitButton.click();
            console.log("  ✅ Checkpoint creation submitted");
            await delay(2000); // Wait for processing to start

            // Wait for processing dialog or success message
            try {
              await page.waitForSelector(
                '[role="dialog"]:has-text("Processing"), [class*="Processing"], text="Creating checkpoint"',
                {
                  timeout: 5000,
                  state: "visible",
                }
              );
              console.log("  ⏳ Checkpoint is being processed...");
              await delay(3000); // Show processing state for 3 seconds
            } catch (error) {
              console.log(
                "  ⚠️  Processing dialog may not be visible, continuing..."
              );
            }

            // Close processing dialog or continue
            let checkpointCreated = false;
            try {
              const continueButton = page
                .locator(
                  'button:has-text("Continue"), button:has-text("Close")'
                )
                .first();
              if (await continueButton.isVisible({ timeout: 3000 })) {
                await continueButton.click();
                await delay(500);
                console.log("  ✅ Processing dialog closed");
                checkpointCreated = true;
              } else {
                // Try pressing Escape to close any dialogs
                await page.keyboard.press("Escape");
                await delay(500);
                console.log("  ✅ Dialog closed (Escape key)");
                checkpointCreated = true;
              }
            } catch (error) {
              // Dialog may have closed automatically - assume checkpoint was created
              console.log("  ✅ Checkpoint creation flow completed");
              checkpointCreated = true;
            }

            if (checkpointCreated) {
              console.log("  ✅ Checkpoint creation scene completed");
            }
          } else {
            console.log("  ⚠️  Could not find submit button, canceling...");
            await page.keyboard.press("Escape");
            await delay(500);
          }
        } catch (error) {
          console.log(
            `  ⚠️  Error submitting checkpoint: ${error instanceof Error ? error.message : String(error)}, canceling...`
          );
          await page.keyboard.press("Escape");
          await delay(500);
        }
      }
    } catch (error) {
      console.log(
        `  ⚠️  Error creating checkpoint: ${error instanceof Error ? error.message : String(error)}, continuing...`
      );
    }

    const duration = Date.now() - startTime;
    return {
      success: true,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
