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

export async function recordTimeline(page: Page): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene 6: Timeline/Checkpoints");

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

            // Wait 15 seconds after checkpoint is created, then show compare flow
            if (checkpointCreated) {
              console.log(
                "  ⏸️  Waiting 15 seconds after checkpoint creation..."
              );
              await delay(15000);

              // Ensure checkpoint list is visible and checkpoints are loaded
              console.log("  🔍 Waiting for checkpoint list to be visible...");
              try {
                // Wait for checkpoint list container to be visible
                await page
                  .waitForSelector(
                    '[class*="space-y-3"], [class*="space-y-4"], [class*="checkpoint"], div:has([class*="Card"])',
                    { timeout: 5000, state: "visible" }
                  )
                  .catch(() => {
                    console.log(
                      "  ⚠️  Checkpoint list container may not be visible yet"
                    );
                  });

                // Additional wait to ensure checkpoint cards are rendered
                await delay(1000);
              } catch (error) {
                console.log(
                  "  ⚠️  Error waiting for checkpoint list, continuing..."
                );
              }

              // Before comparison, open any checkpoint that is not in "Analyzing" state
              console.log(
                "  👁️  Opening a non-analyzing checkpoint for 2 seconds..."
              );
              try {
                // Wait a moment for checkpoint cards to be fully loaded
                await delay(500);

                // Try to find all checkpoint cards using the configured selector first
                let allCheckpointCards = await page
                  .locator(config.selectors.timeline.checkpointCard)
                  .all();

                // If no cards found, try fallback selectors
                if (allCheckpointCards.length === 0) {
                  console.log(
                    "  🔍 Trying fallback selectors to find checkpoint cards..."
                  );
                  const fallbackSelectors = [
                    '[data-testid="checkpoint-card"]',
                    'div[class*="space-y-3"] > div[class*="cursor-pointer"]',
                    '[data-testid="checkpoint-list"] > div[class*="cursor-pointer"]',
                    'div[class*="cursor-pointer"][class*="hover:shadow-md"]',
                  ];

                  for (const selector of fallbackSelectors) {
                    try {
                      const cards = await page.locator(selector).all();
                      if (cards.length > 0) {
                        allCheckpointCards = cards;
                        console.log(
                          `  ✅ Found ${cards.length} checkpoint cards using fallback: ${selector}`
                        );
                        break;
                      }
                    } catch (error) {
                      continue;
                    }
                  }
                }

                let nonAnalyzingCard = null;

                // Find the first checkpoint that is not in "Analyzing" state
                for (const card of allCheckpointCards) {
                  try {
                    if (!(await card.isVisible({ timeout: 500 }))) continue;

                    // Check if this card has "Analyzing" badge/text
                    // The Analyzing badge has text "Analyzing" and a Clock icon with animate-spin
                    const cardText =
                      (await card.textContent().catch(() => "")) || "";
                    const hasAnalyzingBadge =
                      (await card
                        .locator(
                          '[class*="Badge"]:has-text("Analyzing"), [class*="Badge"]:has([class*="animate-spin"])'
                        )
                        .count()
                        .catch(() => 0)) > 0;

                    // Check for "Analyzing" text in the card (case-insensitive)
                    const isAnalyzing =
                      cardText.toLowerCase().includes("analyzing") ||
                      hasAnalyzingBadge;

                    // Skip if it's analyzing
                    if (isAnalyzing) {
                      console.log(
                        `  ⏭️  Skipping checkpoint with "Analyzing" status...`
                      );
                      continue;
                    }

                    // This is a non-analyzing checkpoint - use it
                    nonAnalyzingCard = card;
                    console.log("  ✅ Found non-analyzing checkpoint");
                    break;
                  } catch (error) {
                    continue;
                  }
                }

                // If we found a non-analyzing checkpoint, click it
                if (nonAnalyzingCard) {
                  console.log("  👆 Clicking checkpoint to open details...");
                  await enhancedClick(page, nonAnalyzingCard, {
                    afterClickDelay: 1000,
                  });

                  // Wait for detail dialog to appear
                  try {
                    await page.waitForSelector(
                      '[role="dialog"], [class*="DialogContent"], [class*="Dialog"]',
                      {
                        timeout: 3000,
                        state: "visible",
                      }
                    );
                    console.log("  ✅ Checkpoint detail dialog opened");

                    // Scroll slowly to the bottom of the dialog
                    console.log(
                      "  📜 Scrolling to bottom of checkpoint details..."
                    );
                    try {
                      // Wait a moment for dialog content to fully render
                      await delay(500);

                      // Scroll within the DialogContent to the bottom smoothly
                      // DialogContent has overflow-y-auto, so we scroll that container
                      const scrollSteps = 6; // More steps for smoother scrolling
                      const scrollDelay = 400; // ms between scroll steps for slower scroll

                      for (let i = 0; i < scrollSteps; i++) {
                        await page.evaluate(() => {
                          // Find the DialogContent (has overflow-y-auto class)
                          const dialog = document.querySelector(
                            '[role="dialog"]'
                          ) as HTMLElement;

                          if (dialog) {
                            // Find DialogContent - it's usually the direct child with overflow-y-auto
                            const dialogContent = dialog.querySelector(
                              '[class*="DialogContent"], [class*="overflow-y-auto"]'
                            ) as HTMLElement;

                            const scrollableElement = dialogContent || dialog;

                            if (scrollableElement) {
                              const scrollHeight =
                                scrollableElement.scrollHeight;
                              const clientHeight =
                                scrollableElement.clientHeight;
                              const maxScroll = scrollHeight - clientHeight;

                              if (maxScroll > 0) {
                                // Scroll incrementally to bottom
                                const scrollPosition =
                                  (maxScroll * (i + 1)) / scrollSteps;
                                scrollableElement.scrollTo({
                                  top: scrollPosition,
                                  behavior: "smooth",
                                });
                              }
                            }
                          }
                        });
                        await delay(scrollDelay);
                      }

                      // Ensure we're at the bottom
                      await page.evaluate(() => {
                        const dialog = document.querySelector(
                          '[role="dialog"]'
                        ) as HTMLElement;
                        if (dialog) {
                          const dialogContent = dialog.querySelector(
                            '[class*="DialogContent"], [class*="overflow-y-auto"]'
                          ) as HTMLElement;
                          const scrollableElement = dialogContent || dialog;
                          if (scrollableElement) {
                            scrollableElement.scrollTo({
                              top: scrollableElement.scrollHeight,
                              behavior: "smooth",
                            });
                          }
                        }
                      });
                      await delay(500); // Wait for final scroll to complete

                      console.log("  ✅ Scrolled to bottom of dialog");
                    } catch (scrollError) {
                      console.log(
                        `  ⚠️  Could not scroll dialog: ${scrollError instanceof Error ? scrollError.message : String(scrollError)}, continuing...`
                      );
                    }

                    // Wait 2 seconds at the bottom before closing
                    await delay(2000);

                    // Close the dialog
                    await page.keyboard.press("Escape");
                    await delay(500);
                    console.log("  ✅ Checkpoint detail dialog closed");
                  } catch (error) {
                    console.log(
                      "  ⚠️  Detail dialog may not have appeared, continuing..."
                    );
                    // Try pressing Escape anyway to ensure we're back to list view
                    await page.keyboard.press("Escape");
                    await delay(500);
                  }
                } else {
                  console.log(
                    "  ⚠️  No non-analyzing checkpoint found, skipping detail view..."
                  );
                }
              } catch (error) {
                console.log(
                  `  ⚠️  Error opening checkpoint details: ${error instanceof Error ? error.message : String(error)}, continuing...`
                );
              }

              // Click on the Compare button in Timeline View
              console.log("  🔄 Clicking Compare button...");
              try {
                // Find the Compare button (has ArrowRightLeft icon and text "Compare")
                const compareButton = page
                  .locator(
                    'button:has-text("Compare"), button:has([class*="ArrowRightLeft"])'
                  )
                  .first();
                if (await compareButton.isVisible({ timeout: 5000 })) {
                  await enhancedClick(page, compareButton);
                  await delay(500); // Wait for selection mode to activate
                  console.log(
                    "  ✅ Compare button clicked - selection mode activated"
                  );

                  // Wait for selection mode banner to appear
                  try {
                    await page.waitForSelector(
                      'text="Select 2 checkpoints to compare", [class*="Badge"]:has-text("/ 2 selected"), text="0 / 2 selected"',
                      {
                        timeout: 3000,
                        state: "visible",
                      }
                    );
                    console.log("  ✅ Selection mode banner is visible");
                    await delay(1000); // Wait for DOM to update after selection mode is activated
                  } catch (error) {
                    console.log(
                      "  ⚠️  Selection mode banner may not be visible, continuing..."
                    );
                    await delay(1000); // Wait anyway for DOM to stabilize
                  }

                  // Select the first 2 checkpoints
                  console.log("  📋 Selecting first 2 checkpoints...");
                  try {
                    // Wait a bit more for checkpoint cards to be fully visible in selection mode
                    await delay(500);
                    // Wait for checkpoint cards to be visible in selection mode
                    // Use flexible selectors that match the actual DOM structure
                    // Note: Card component renders as <div> with utility classes, not "Card" in class name
                    // Checkpoint cards are divs with cursor-pointer class in a space-y-3 container
                    const checkpointCardSelectors = [
                      // Primary selector using data-testid (most reliable)
                      config.selectors.timeline.checkpointCard,
                      '[data-testid="checkpoint-card"]',
                      // Try finding cards by container and cursor-pointer class (actual rendered structure)
                      'div[class*="space-y-3"] > div[class*="cursor-pointer"]',
                      '[data-testid="checkpoint-list"] > div[class*="cursor-pointer"]',
                      'div[class*="space-y-4"] > div[class*="cursor-pointer"]',
                      // Find any clickable card with cursor-pointer and hover:shadow-md (checkpoint cards have these)
                      'div[class*="cursor-pointer"][class*="hover:shadow-md"]',
                      // More generic: any div with cursor-pointer that's not the selection banner
                      'div[class*="cursor-pointer"]:not(:has-text("Select 2 checkpoints"))',
                    ];

                    let checkpointCards: any[] = [];
                    let foundCards = false;

                    // Try each selector until we find checkpoint cards
                    for (const selector of checkpointCardSelectors) {
                      try {
                        console.log(`  🔍 Trying selector: ${selector}...`);
                        await page.waitForSelector(selector, {
                          timeout: 3000,
                          state: "visible",
                        });

                        const allCards = await page.locator(selector).all();

                        // Filter to only visible cards and exclude any selection mode banner
                        checkpointCards = [];
                        for (const card of allCards) {
                          try {
                            const isVisible = await card.isVisible({
                              timeout: 500,
                            });
                            if (!isVisible) continue;

                            // Exclude selection mode banner (has badge with "selected" text)
                            const hasBadge =
                              (await card
                                .locator(
                                  '[class*="Badge"]:has-text("selected")'
                                )
                                .count()) > 0;
                            if (hasBadge) continue;

                            // Also exclude the selection banner itself (contains "Select 2 checkpoints")
                            const text = await card
                              .textContent()
                              .catch(() => "");
                            if (
                              text &&
                              text.includes("Select 2 checkpoints to compare")
                            )
                              continue;

                            checkpointCards.push(card);
                          } catch {
                            continue;
                          }
                        }

                        if (checkpointCards.length >= 2) {
                          console.log(
                            `  ✅ Found ${checkpointCards.length} checkpoint cards using selector: ${selector}`
                          );
                          foundCards = true;
                          break;
                        } else if (checkpointCards.length > 0) {
                          console.log(
                            `  ⚠️  Found only ${checkpointCards.length} checkpoint cards (need 2), trying next selector...`
                          );
                        }
                      } catch (error) {
                        // Try next selector
                        continue;
                      }
                    }

                    // If still not found, try waiting a bit more and then look for any clickable cards
                    if (!foundCards || checkpointCards.length < 2) {
                      console.log(
                        "  ⏳ Waiting 2 more seconds for checkpoint cards to load..."
                      );
                      await delay(2000);

                      // Try a more generic approach - find all cards in the space-y-3 container
                      // Based on the actual structure: <div class="space-y-3"> contains <CheckpointCard /> components
                      try {
                        // First, find the checkpoint list container
                        const listContainer = page
                          .locator('div[class*="space-y-3"]')
                          .first();

                        if (await listContainer.isVisible({ timeout: 2000 })) {
                          // Get all direct children (CheckpointCard components)
                          const allCards = await listContainer
                            .locator("> *")
                            .all();
                          checkpointCards = [];

                          for (const card of allCards) {
                            try {
                              if (!(await card.isVisible({ timeout: 500 })))
                                continue;

                              // Get the card's class to check for checkpoint card characteristics
                              const cardClass =
                                (await card
                                  .getAttribute("class")
                                  .catch(() => "")) || "";

                              // Checkpoint cards have cursor-pointer and hover:shadow-md classes
                              if (!cardClass.includes("cursor-pointer"))
                                continue;

                              // Exclude selection banner by checking text content
                              const text =
                                (await card.textContent().catch(() => "")) ||
                                "";
                              if (
                                text &&
                                (text.includes(
                                  "Select 2 checkpoints to compare"
                                ) ||
                                  text.includes("Compare Selected"))
                              )
                                continue;

                              // Additional verification: checkpoint cards should have rounded-lg border classes
                              // and should contain a div with padding (CardContent structure)
                              const hasCardStructure =
                                cardClass.includes("rounded-lg") &&
                                (cardClass.includes("border") ||
                                  cardClass.includes("shadow"));

                              // If it looks like a checkpoint card (has cursor-pointer and card-like structure), include it
                              if (
                                hasCardStructure ||
                                cardClass.includes("hover:shadow-md")
                              ) {
                                checkpointCards.push(card);
                              }
                            } catch {
                              continue;
                            }
                          }

                          console.log(
                            `  ✅ Found ${checkpointCards.length} checkpoint cards using fallback method (space-y-3 container)`
                          );
                        } else {
                          // Last resort: find any div with cursor-pointer that looks like a checkpoint card
                          console.log(
                            "  🔍 Trying last resort: finding any clickable checkpoint card..."
                          );
                          const allCards = await page
                            .locator(
                              'div[class*="cursor-pointer"]:not(:has-text("Select 2 checkpoints"))'
                            )
                            .all();
                          checkpointCards = [];

                          for (const card of allCards) {
                            try {
                              if (!(await card.isVisible({ timeout: 500 })))
                                continue;

                              const cardClass =
                                (await card
                                  .getAttribute("class")
                                  .catch(() => "")) || "";

                              // Must have cursor-pointer
                              if (!cardClass.includes("cursor-pointer"))
                                continue;

                              // Should have card-like structure (rounded-lg, border, etc.)
                              const hasCardStructure =
                                cardClass.includes("rounded-lg") ||
                                (cardClass.includes("border") &&
                                  cardClass.includes("shadow"));

                              if (!hasCardStructure) continue;

                              const text =
                                (await card.textContent().catch(() => "")) ||
                                "";
                              if (
                                text &&
                                (text.includes(
                                  "Select 2 checkpoints to compare"
                                ) ||
                                  text.includes("Compare Selected") ||
                                  text.includes("/ 2 selected"))
                              )
                                continue;

                              checkpointCards.push(card);
                              if (checkpointCards.length >= 2) break; // Stop when we have enough
                            } catch {
                              continue;
                            }
                          }

                          console.log(
                            `  ✅ Found ${checkpointCards.length} checkpoint cards using last resort method`
                          );
                        }
                      } catch (error) {
                        console.log(
                          `  ⚠️  Fallback method failed: ${error instanceof Error ? error.message : String(error)}`
                        );
                      }
                    }

                    if (checkpointCards.length >= 2) {
                      // Select first checkpoint - look for "Good Condition" status
                      console.log(
                        "  ✅ Selecting first checkpoint (Good Condition)..."
                      );
                      try {
                        let firstCard = null;

                        // Search for checkpoint with "Good Condition" status badge
                        for (const card of checkpointCards) {
                          try {
                            if (!(await card.isVisible({ timeout: 500 })))
                              continue;

                            const cardText =
                              (await card.textContent().catch(() => "")) || "";

                            // Check if this card has "Good Condition" badge (case-insensitive)
                            // Use page.evaluate to search for badges more reliably
                            const hasGoodCondition = await page.evaluate(
                              (cardElement) => {
                                // Check card text first
                                const text = cardElement.textContent || "";
                                if (text.toLowerCase().includes("good condition")) {
                                  return true;
                                }

                                // Search for badge elements within the card
                                const badges = cardElement.querySelectorAll(
                                  '[class*="Badge"], span[class*="badge"]'
                                );
                                for (const badge of badges) {
                                  const badgeText = badge.textContent || "";
                                  if (
                                    badgeText.toLowerCase().includes("good condition")
                                  ) {
                                    return true;
                                  }
                                }
                                return false;
                              },
                              await card.elementHandle()
                            ).catch(() => false);

                            if (hasGoodCondition) {
                              firstCard = card;
                              console.log(
                                "  ✅ Found checkpoint with 'Good Condition' status"
                              );
                              break;
                            }
                          } catch {
                            continue;
                          }
                        }

                        // Fallback to first card if "Good Condition" not found
                        if (!firstCard && checkpointCards.length > 0) {
                          firstCard = checkpointCards[0];
                          console.log(
                            "  ⚠️  'Good Condition' checkpoint not found, using first checkpoint"
                          );
                        }

                        if (firstCard) {
                          // Scroll the card into view and click it
                          await firstCard.scrollIntoViewIfNeeded();
                          await delay(300);
                          await enhancedClick(page, firstCard, {
                            afterClickDelay: 600,
                          });
                          console.log(
                            "  ✅ First checkpoint (Good Condition) selected"
                          );
                        }

                        // Wait for selection badge to update (should show "1 / 2 selected")
                        try {
                          await page
                            .waitForSelector(
                              '[class*="Badge"]:has-text("1 / 2"), text="1 / 2 selected"',
                              {
                                timeout: 2000,
                                state: "visible",
                              }
                            )
                            .catch(() => {});
                        } catch (error) {
                          // Continue even if badge doesn't update
                        }
                      } catch (error) {
                        console.log(
                          `  ⚠️  Could not select first checkpoint: ${error instanceof Error ? error.message : String(error)}, continuing...`
                        );
                      }

                      // Wait a moment for DOM to update after first selection
                      await delay(500);

                      // Select second checkpoint - look for "Needs Attention" status
                      console.log(
                        "  ✅ Selecting second checkpoint (Needs Attention)..."
                      );
                      try {
                        // Re-find cards using the same method that worked before
                        // (DOM may have changed after first selection, so we need fresh references)
                        let updatedCheckpointCards: any[] = [];

                        // Try the same selectors that worked before
                        const checkpointCardSelectors = [
                          config.selectors.timeline.checkpointCard,
                          '[data-testid="checkpoint-card"]',
                          'div[class*="space-y-3"] > div[class*="cursor-pointer"]',
                          '[data-testid="checkpoint-list"] > div[class*="cursor-pointer"]',
                          'div[class*="cursor-pointer"][class*="hover:shadow-md"]',
                        ];

                        for (const selector of checkpointCardSelectors) {
                          try {
                            const cards = await page.locator(selector).all();
                            if (cards.length >= 2) {
                              updatedCheckpointCards = cards;
                              break;
                            }
                          } catch {
                            continue;
                          }
                        }

                        // If re-query didn't work, try to use cards from the original list
                        if (
                          updatedCheckpointCards.length < 2 &&
                          checkpointCards.length >= 2
                        ) {
                          updatedCheckpointCards = checkpointCards;
                        }

                        if (updatedCheckpointCards.length >= 2) {
                          // Find a card that has "Needs Attention" status and is not already selected
                          let secondCard = null;

                          console.log(
                            `  🔍 Searching for 'Needs Attention' checkpoint among ${updatedCheckpointCards.length} cards...`
                          );

                          // Search for "Needs Attention" checkpoint
                          for (const card of updatedCheckpointCards) {
                            try {
                              if (!(await card.isVisible({ timeout: 500 })))
                                continue;

                              // Check if this card is already selected
                              const cardClass =
                                (await card
                                  .getAttribute("class")
                                  .catch(() => "")) || "";
                              const hasSelectionRing =
                                cardClass.includes("ring-primary") ||
                                cardClass.includes("ring-2");

                              // Check if card has a checkmark (selected state)
                              const hasCheckmark =
                                (await card
                                  .locator('[class*="CheckCircle"]')
                                  .count()) > 0;

                              // Skip if already selected
                              if (hasSelectionRing || hasCheckmark) {
                                continue;
                              }

                              // Check if this card has "Needs Attention" status badge
                              const cardText =
                                (await card.textContent().catch(() => "")) ||
                                "";

                              // First check: simple text content check
                              let hasNeedsAttention =
                                cardText.toLowerCase().includes("needs attention");

                              // Second check: use page.evaluate to search for badges more reliably
                              if (!hasNeedsAttention) {
                                try {
                                  const elementHandle = await card.elementHandle();
                                  if (elementHandle) {
                                    hasNeedsAttention = await page.evaluate(
                                      (cardElement) => {
                                        // Search for badge elements within the card
                                        const badges = cardElement.querySelectorAll(
                                          '[class*="Badge"], span[class*="badge"], div[class*="Badge"]'
                                        );
                                        for (const badge of badges) {
                                          const badgeText = badge.textContent || "";
                                          if (
                                            badgeText
                                              .toLowerCase()
                                              .includes("needs attention")
                                          ) {
                                            return true;
                                          }
                                        }
                                        return false;
                                      },
                                      elementHandle
                                    );
                                  }
                                } catch (error) {
                                  // If elementHandle fails, fall back to text content check
                                  console.log(
                                    `  ⚠️  Could not use elementHandle for badge search: ${error instanceof Error ? error.message : String(error)}`
                                  );
                                }
                              }

                              if (hasNeedsAttention) {
                                secondCard = card;
                                console.log(
                                  "  ✅ Found checkpoint with 'Needs Attention' status"
                                );
                                break;
                              }
                            } catch {
                              continue;
                            }
                          }

                          // Fallback: if "Needs Attention" not found, use first unselected card
                          if (!secondCard) {
                            console.log(
                              "  ⚠️  'Needs Attention' checkpoint not found, trying fallback..."
                            );
                            for (const card of updatedCheckpointCards) {
                              try {
                                if (!(await card.isVisible({ timeout: 500 })))
                                  continue;

                                const cardClass =
                                  (await card
                                    .getAttribute("class")
                                    .catch(() => "")) || "";
                                const hasSelectionRing =
                                  cardClass.includes("ring-primary") ||
                                  cardClass.includes("ring-2");

                                const hasCheckmark =
                                  (await card
                                    .locator('[class*="CheckCircle"]')
                                    .count()) > 0;

                                if (!hasSelectionRing && !hasCheckmark) {
                                  // Log what we're selecting as fallback
                                  const fallbackText =
                                    (await card.textContent().catch(() => "")) ||
                                    "";
                                  console.log(
                                    `  ⚠️  Using fallback checkpoint: "${fallbackText.substring(0, 80)}..."`
                                  );
                                  secondCard = card;
                                  break;
                                }
                              } catch {
                                continue;
                              }
                            }
                          }

                          if (secondCard) {
                            // Scroll and click the second card
                            await secondCard.scrollIntoViewIfNeeded();
                            await delay(300);
                            await enhancedClick(page, secondCard, {
                              afterClickDelay: 600,
                            });
                            console.log(
                              "  ✅ Second checkpoint (Needs Attention) selected"
                            );

                            // Verify that 2 checkpoints are selected (badge should show "2 / 2 selected")
                            try {
                              await page.waitForSelector(
                                '[class*="Badge"]:has-text("2 / 2"), text="2 / 2 selected", [class*="Badge"]:has-text("2 selected")',
                                {
                                  timeout: 3000,
                                  state: "visible",
                                }
                              );
                              console.log(
                                "  ✅ Both checkpoints selected (2 / 2)"
                              );
                              await delay(500); // Brief pause to show selection state
                            } catch (error) {
                              console.log(
                                "  ⚠️  Selection badge may not show 2/2, but continuing..."
                              );
                              // Wait a bit anyway in case selection happened but badge isn't visible yet
                              await delay(1000);
                            }
                          } else {
                            console.log(
                              "  ⚠️  Could not find 'Needs Attention' checkpoint or unselected checkpoint card for second selection"
                            );
                          }
                        } else {
                          console.log(
                            "  ⚠️  Not enough checkpoint cards found after first selection, continuing..."
                          );
                        }
                      } catch (error) {
                        console.log(
                          `  ⚠️  Could not select second checkpoint: ${error instanceof Error ? error.message : String(error)}, continuing...`
                        );
                      }

                      // Click "Compare Selected" button
                      console.log('  🔄 Clicking "Compare Selected" button...');
                      try {
                        // Find the "Compare Selected" button in the selection mode banner
                        const compareSelectedButton = page
                          .locator(
                            'button:has-text("Compare Selected"), button:has-text("Compare Selected")'
                          )
                          .first();
                        if (
                          await compareSelectedButton.isVisible({
                            timeout: 3000,
                          })
                        ) {
                          // Check if button is enabled (should be enabled when 2 checkpoints are selected)
                          const isEnabled =
                            await compareSelectedButton.isEnabled();
                          if (isEnabled) {
                            await enhancedClick(page, compareSelectedButton, {
                              afterClickDelay: 1000,
                            });
                            console.log(
                              '  ✅ "Compare Selected" button clicked'
                            );
                          } else {
                            console.log(
                              '  ⚠️  "Compare Selected" button is disabled (need 2 checkpoints selected), waiting...'
                            );
                            await delay(1000);
                            // Try again after waiting
                            const retryButton = page
                              .locator('button:has-text("Compare Selected")')
                              .first();
                            if (
                              await retryButton.isEnabled({ timeout: 2000 })
                            ) {
                              await enhancedClick(page, retryButton, {
                                afterClickDelay: 1000,
                              });
                              console.log(
                                '  ✅ "Compare Selected" button clicked (after retry)'
                              );
                            }
                          }

                          // Wait for compare dialog to appear
                          try {
                            await page.waitForSelector(
                              '[role="dialog"]:has-text("Compare"), [class*="DialogContent"]:has-text("Compare"), [class*="Comparison"]',
                              {
                                timeout: 3000,
                                state: "visible",
                              }
                            );
                            console.log("  ✅ Compare dialog is visible");
                            await delay(1000); // Wait for dialog to fully render

                            // Click on "Side by Side" tab
                            console.log('  🔄 Clicking "Side by Side" tab...');
                            try {
                              const sideBySideTab = page
                                .locator(
                                  'button:has-text("Side by Side"), [role="tab"]:has-text("Side by Side"), [class*="TabsTrigger"]:has-text("Side by Side")'
                                )
                                .first();
                              if (
                                await sideBySideTab.isVisible({ timeout: 3000 })
                              ) {
                                await enhancedClick(page, sideBySideTab, {
                                  afterClickDelay: 500,
                                });
                                console.log('  ✅ "Side by Side" tab clicked');
                              } else {
                                console.log(
                                  '  ⚠️  "Side by Side" tab not found, trying alternative selector...'
                                );
                                // Try alternative selector
                                const sideBySideAlt = page
                                  .locator('[value="side-by-side"]')
                                  .first();
                                if (
                                  await sideBySideAlt.isVisible({
                                    timeout: 2000,
                                  })
                                ) {
                                  await enhancedClick(page, sideBySideAlt, {
                                    afterClickDelay: 500,
                                  });
                                  console.log(
                                    '  ✅ "Side by Side" tab clicked (alternative selector)'
                                  );
                                }
                              }
                            } catch (tabError) {
                              console.log(
                                `  ⚠️  Could not click "Side by Side" tab: ${tabError instanceof Error ? tabError.message : String(tabError)}, continuing...`
                              );
                            }

                            // Wait 1 second after clicking Side by Side
                            await delay(1000);

                            // Click on "Run AI Comparison" button
                            console.log(
                              '  🤖 Clicking "Run AI Comparison" button...'
                            );
                            try {
                              const runAIComparisonButton = page
                                .locator(
                                  'button:has-text("Run AI Comparison"), button:has([class*="ArrowRightLeft"]):has-text("Run AI Comparison")'
                                )
                                .first();
                              if (
                                await runAIComparisonButton.isVisible({
                                  timeout: 3000,
                                })
                              ) {
                                await enhancedClick(
                                  page,
                                  runAIComparisonButton,
                                  {
                                    afterClickDelay: 500,
                                  }
                                );
                                console.log(
                                  '  ✅ "Run AI Comparison" button clicked'
                                );

                                // Wait 10 seconds for AI comparison to run
                                console.log(
                                  "  ⏳ Waiting 10 seconds for AI comparison..."
                                );
                                await delay(10000);
                                console.log(
                                  "  ✅ AI comparison wait completed"
                                );
                              } else {
                                console.log(
                                  '  ⚠️  "Run AI Comparison" button not found, continuing...'
                                );
                              }
                            } catch (compareError) {
                              console.log(
                                `  ⚠️  Could not click "Run AI Comparison" button: ${compareError instanceof Error ? compareError.message : String(compareError)}, continuing...`
                              );
                            }

                            // Close compare dialog
                            await page.keyboard.press("Escape");
                            await delay(500);
                            console.log("  ✅ Compare dialog closed");
                          } catch (error) {
                            console.log(
                              "  ⚠️  Compare dialog may not be visible, continuing..."
                            );
                          }
                        } else {
                          console.log(
                            '  ⚠️  "Compare Selected" button not found or not enabled, continuing...'
                          );
                        }
                      } catch (error) {
                        console.log(
                          `  ⚠️  Could not click "Compare Selected" button: ${error instanceof Error ? error.message : String(error)}, continuing...`
                        );
                      }
                    } else {
                      console.log(
                        `  ⚠️  Not enough checkpoints found (found ${checkpointCards.length}, need at least 2), continuing...`
                      );
                    }
                  } catch (error) {
                    console.log(
                      `  ⚠️  Error selecting checkpoints: ${error instanceof Error ? error.message : String(error)}, continuing...`
                    );
                  }
                } else {
                  console.log("  ⚠️  Compare button not found, continuing...");
                }
              } catch (error) {
                console.log(
                  `  ⚠️  Error clicking Compare button: ${error instanceof Error ? error.message : String(error)}, continuing...`
                );
              }
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
        `  ⚠️  Error in checkpoint creation flow: ${error instanceof Error ? error.message : String(error)}, continuing...`
      );
    }

    // Ensure scene runs for at least 10 seconds
    const elapsedTime = Date.now() - startTime;
    const minDuration = 10000; // 10 seconds minimum
    if (elapsedTime < minDuration) {
      const remainingTime = minDuration - elapsedTime;
      console.log(
        `  ⏸️  Waiting for minimum duration (${(remainingTime / 1000).toFixed(1)}s remaining)...`
      );
      await delay(remainingTime);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Scene 6 completed in ${(duration / 1000).toFixed(1)}s`);

    return {
      success: true,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Scene 6 failed:", error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
