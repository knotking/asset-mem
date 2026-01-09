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

export async function recordTimelineCompare(
  page: Page
): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene: Timeline Checkpoint Comparison");

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
              await page.evaluate(({ stepIndex, totalSteps }) => {
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
                        (maxScroll * (stepIndex + 1)) / totalSteps;
                      scrollableElement.scrollTo({
                        top: scrollPosition,
                        behavior: "smooth",
                      });
                    }
                  }
                }
              }, { stepIndex: i, totalSteps: scrollSteps });
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
            // Primary selector: divs with cursor-pointer in space-y-3 container (actual rendered structure)
            'div[class*="space-y-3"] > div[class*="cursor-pointer"]',
            // Fallback selectors
            config.selectors.timeline.checkpointCard,
            '[data-testid="checkpoint-card"]',
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
            // Store the index of the selected card to skip it later (needed for second selection)
            let selectedCardIndex = -1;
            
            // Select first checkpoint - look for "Good Condition" status
            console.log(
              "  ✅ Selecting first checkpoint (Good Condition)..."
            );
            try {
              let firstCard = null;

              // Search for checkpoint with "Good Condition" status badge
              for (let i = 0; i < checkpointCards.length; i++) {
                const card = checkpointCards[i];
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
                    selectedCardIndex = i; // Track the index when we find the card
                    console.log(
                      `  ✅ Found checkpoint with 'Good Condition' status at index ${i}`
                    );
                    break;
                  }
                } catch (error) {
                  console.log(
                    `  ⚠️  Error checking card ${i}: ${error instanceof Error ? error.message : String(error)}`
                  );
                  continue;
                }
              }

              // Fallback to first card if "Good Condition" not found
              if (!firstCard && checkpointCards.length > 0) {
                firstCard = checkpointCards[0];
                selectedCardIndex = 0; // Track that we selected the first card
                console.log(
                  "  ⚠️  'Good Condition' checkpoint not found, using first checkpoint"
                );
              }

              if (firstCard && selectedCardIndex === -1) {
                // Find the index of the selected card in the original array
                for (let i = 0; i < checkpointCards.length; i++) {
                  try {
                    // Compare by checking if they reference the same element
                    const cardHandle = await checkpointCards[i].elementHandle();
                    const firstCardHandle = await firstCard.elementHandle();
                    if (cardHandle && firstCardHandle) {
                      const isSame = await page.evaluate(
                        (el1, el2) => el1 === el2,
                        cardHandle,
                        firstCardHandle
                      );
                      if (isSame) {
                        selectedCardIndex = i;
                        break;
                      }
                    }
                  } catch {
                    continue;
                  }
                }
              }
              
              if (firstCard) {

                // Scroll the card into view and click it
                await firstCard.scrollIntoViewIfNeeded();
                await delay(300);
                await enhancedClick(page, firstCard, {
                  afterClickDelay: 600,
                });
                console.log(
                  `  ✅ First checkpoint (Good Condition) selected at index ${selectedCardIndex}`
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
              // Wait a bit for DOM to update after first selection
              await delay(500);

              // Re-find cards using the same method that worked before
              // (DOM may have changed after first selection, so we need fresh references)
              let updatedCheckpointCards: any[] = [];

              // Try the same selectors that worked before
              const checkpointCardSelectors = [
                // Primary selector: divs with cursor-pointer in space-y-3 container
                'div[class*="space-y-3"] > div[class*="cursor-pointer"]',
                // Fallback selectors
                config.selectors.timeline.checkpointCard,
                '[data-testid="checkpoint-card"]',
                '[data-testid="checkpoint-list"] > div[class*="cursor-pointer"]',
                'div[class*="cursor-pointer"][class*="hover:shadow-md"]',
              ];

              for (const selector of checkpointCardSelectors) {
                try {
                  const cards = await page.locator(selector).all();
                  if (cards.length >= 2) {
                    updatedCheckpointCards = cards;
                    console.log(`  ✅ Re-found ${cards.length} cards using selector: ${selector}`);
                    break;
                  }
                } catch {
                  continue;
                }
              }

              // If re-query didn't work, use cards from the original list
              if (
                updatedCheckpointCards.length < 2 &&
                checkpointCards.length >= 2
              ) {
                console.log(`  ⚠️  Re-query found ${updatedCheckpointCards.length} cards, using original list with ${checkpointCards.length} cards`);
                updatedCheckpointCards = checkpointCards;
              }

              if (updatedCheckpointCards.length >= 2) {
                // Find a card that has "Needs Attention" status and is not already selected
                let secondCard = null;

                console.log(
                  `  🔍 Searching for 'Needs Attention' checkpoint among ${updatedCheckpointCards.length} cards...`
                );
                console.log(`  📊 Selected card index: ${selectedCardIndex}`);

                // Debug: Log status of all cards before searching
                console.log("  🔍 Debug: Checking status of all cards...");
                for (let debugIdx = 0; debugIdx < Math.min(updatedCheckpointCards.length, 5); debugIdx++) {
                  try {
                    const debugCard = updatedCheckpointCards[debugIdx];
                    if (await debugCard.isVisible({ timeout: 500 })) {
                      const debugCardClass = (await debugCard.getAttribute("class").catch(() => "")) || "";
                      const debugCardText = (await debugCard.textContent().catch(() => "")) || "";
                      // Only ring-primary indicates selection (ring-2 alone is just hover state)
                      const debugHasRing = debugCardClass.includes("ring-primary");
                      const debugHasCheckmark = (await debugCard.locator('[class*="CheckCircle"][class*="fill-primary"], [class*="CheckCircle"][class*="text-primary"]').count()) > 0;
                      const debugAriaSelected = await debugCard.getAttribute("aria-selected").catch(() => null);
                      
                      // Check badge status
                      let debugBadgeText = "";
                      try {
                        const debugBadges = await debugCard.locator('[class*="Badge"]').all();
                        for (const badge of debugBadges) {
                          const badgeText = (await badge.textContent().catch(() => "")) || "";
                          if (badgeText) debugBadgeText += badgeText + ", ";
                        }
                      } catch {}
                      
                      console.log(
                        `    Card ${debugIdx}: ring=${debugHasRing}, checkmark=${debugHasCheckmark}, aria=${debugAriaSelected}, badge="${debugBadgeText.substring(0, 50)}", text="${debugCardText.substring(0, 40)}..."`
                      );
                    }
                  } catch {}
                }

                // Search for "Needs Attention" checkpoint
                // Skip the card that was already selected (if we know its index)
                for (let i = 0; i < updatedCheckpointCards.length; i++) {
                  // Skip the card that was already selected
                  if (selectedCardIndex >= 0 && i === selectedCardIndex) {
                    console.log(`  ⏭️  Skipping card at index ${i} (tracked as selected)`);
                    continue;
                  }
                  
                  const card = updatedCheckpointCards[i];
                  try {
                    if (!(await card.isVisible({ timeout: 500 })))
                      continue;

                    // Check if this card is already selected using multiple methods
                    // Only ring-primary indicates selection (ring-2 alone is just hover state)
                    const cardClass =
                      (await card
                        .getAttribute("class")
                        .catch(() => "")) || "";
                    const hasSelectionRing =
                      cardClass.includes("ring-primary");

                    // Check if card has a checkmark (selected state)
                    // The selected card has a CheckCircle with fill-primary class
                    const hasCheckmark =
                      (await card
                        .locator('[class*="CheckCircle"][class*="fill-primary"], [class*="CheckCircle"][class*="text-primary"]')
                        .count()) > 0;

                    // Also check aria-selected or data-selected attributes
                    const ariaSelected = await card
                      .getAttribute("aria-selected")
                      .catch(() => null);
                    const isSelected = ariaSelected === "true";

                    // Check if this card has "Needs Attention" status badge
                    const cardText =
                      (await card.textContent().catch(() => "")) ||
                      "";

                    // Debug log for each card being checked
                    const badgeMatches = cardText.toLowerCase().includes("needs attention");
                    console.log(
                      `  🔍 Card ${i}: ring=${hasSelectionRing}, checkmark=${hasCheckmark}, aria=${ariaSelected}, needsAttention=${badgeMatches}, text="${cardText.substring(0, 50)}..."`
                    );

                    // Skip if already selected
                    if (hasSelectionRing || hasCheckmark || isSelected) {
                      console.log(`  ⏭️  Skipping card ${i} (detected as selected)`);
                      continue;
                    }

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
                  } catch (error) {
                    console.log(
                      `  ⚠️  Error checking card: ${error instanceof Error ? error.message : String(error)}`
                    );
                    continue;
                  }
                }

                // Fallback: if "Needs Attention" not found, use first unselected card
                if (!secondCard) {
                  console.log(
                    "  ⚠️  'Needs Attention' checkpoint not found, trying fallback..."
                  );
                  console.log(`  📊 Fallback: Selected card index is ${selectedCardIndex}`);
                  let fallbackAttempts = 0;
                  let fallbackSkipped = 0;
                  for (let i = 0; i < updatedCheckpointCards.length; i++) {
                    // Skip the card that was already selected
                    if (selectedCardIndex >= 0 && i === selectedCardIndex) {
                      console.log(`  ⏭️  Fallback: Skipping card ${i} (tracked index)`);
                      fallbackSkipped++;
                      continue;
                    }
                    
                    const card = updatedCheckpointCards[i];
                    try {
                      if (!(await card.isVisible({ timeout: 500 })))
                        continue;

                      // Check if this card is already selected using multiple methods
                      // Only ring-primary indicates selection (ring-2 alone is just hover state)
                      const cardClass =
                        (await card
                          .getAttribute("class")
                          .catch(() => "")) || "";
                      const hasSelectionRing =
                        cardClass.includes("ring-primary");

                      // The selected card has a CheckCircle with fill-primary class
                      const hasCheckmark =
                        (await card
                          .locator('[class*="CheckCircle"][class*="fill-primary"], [class*="CheckCircle"][class*="text-primary"]')
                          .count()) > 0;

                      const ariaSelected = await card
                        .getAttribute("aria-selected")
                        .catch(() => null);
                      const isSelected = ariaSelected === "true";

                      // Use page.evaluate to check selection state more reliably
                      let isCardSelected = false;
                      try {
                        const elementHandle = await card.elementHandle();
                        if (elementHandle) {
                          isCardSelected = await page.evaluate(
                            (cardElement) => {
                              const classAttr = cardElement.getAttribute("class") || "";
                              // Check for ring-primary specifically (not just ring-2)
                              const hasRing = classAttr.includes("ring-primary");
                              // Check for CheckCircle with fill-primary (selected indicator)
                              const checkCircle = cardElement.querySelector('[class*="CheckCircle"]');
                              const hasCheck = checkCircle !== null && 
                                (checkCircle.classList.contains("fill-primary") || checkCircle.classList.contains("text-primary"));
                              const ariaSelected = cardElement.getAttribute("aria-selected");
                              return hasRing || hasCheck || ariaSelected === "true";
                            },
                            elementHandle
                          );
                        }
                      } catch (evalError) {
                        // If evaluate fails, use the previous checks
                        isCardSelected = hasSelectionRing || hasCheckmark || isSelected;
                      }

                      const cardText = (await card.textContent().catch(() => "")) || "";
                      console.log(
                        `  🔍 Fallback card ${i}: ring=${hasSelectionRing}, checkmark=${hasCheckmark}, aria=${ariaSelected}, eval=${isCardSelected}, text="${cardText.substring(0, 50)}..."`
                      );

                      if (!isCardSelected && !hasSelectionRing && !hasCheckmark && !isSelected) {
                        // Log what we're selecting as fallback
                        console.log(
                          `  ✅ Using fallback checkpoint (attempt ${fallbackAttempts + 1}): "${cardText.substring(0, 80)}..."`
                        );
                        secondCard = card;
                        break;
                      } else {
                        console.log(`  ⏭️  Fallback: Skipping card ${i} (detected as selected)`);
                      }
                      fallbackAttempts++;
                    } catch (error) {
                      console.log(
                        `  ⚠️  Error in fallback check for card ${i}: ${error instanceof Error ? error.message : String(error)}`
                      );
                      continue;
                    }
                  }
                  
                  if (!secondCard) {
                    console.log(
                      `  ⚠️  Fallback failed: checked ${fallbackAttempts} cards, skipped ${fallbackSkipped} by index, all remaining appear to be selected`
                    );
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

                      // Wait for AI comparison to complete (max 20 seconds)
                      // Check for either:
                      // 1. Comparison result appearing (AI Comparison Analysis section)
                      // 2. Loading state disappearing (Analyzing differences... text gone)
                      console.log(
                        "  ⏳ Waiting for AI comparison to complete (max 20 seconds)..."
                      );
                      
                      const maxWaitTime = 20000; // 20 seconds
                      const startTime = Date.now();
                      let comparisonComplete = false;

                      while (!comparisonComplete && (Date.now() - startTime) < maxWaitTime) {
                        try {
                          // Check if comparison result is visible (AI Comparison Analysis section)
                          // Try multiple selectors to be more robust
                          const resultSelectors = [
                            'h3:has-text("AI Comparison Analysis")',
                            'text="AI Comparison Analysis"',
                            '[class*="space-y-4"]:has-text("AI Comparison Analysis")',
                            'text="Similarity"',
                            'text="Detected Changes"',
                            'text="Change Regions"',
                          ];
                          
                          let hasResult = false;
                          for (const selector of resultSelectors) {
                            try {
                              hasResult = await page
                                .locator(selector)
                                .isVisible({ timeout: 500 })
                                .catch(() => false);
                              if (hasResult) {
                                console.log(`  ✅ AI comparison result detected using selector: ${selector}`);
                                break;
                              }
                            } catch {
                              continue;
                            }
                          }

                          if (hasResult) {
                            comparisonComplete = true;
                            break;
                          }

                          // Check if loading state is still visible
                          const isLoadingSelectors = [
                            'text="Analyzing differences..."',
                            'p:has-text("Analyzing differences")',
                            '[class*="Loader2"]',
                            '[class*="animate-spin"]:has-text("Analyzing")',
                          ];
                          
                          let isLoading = false;
                          for (const selector of isLoadingSelectors) {
                            try {
                              isLoading = await page
                                .locator(selector)
                                .isVisible({ timeout: 500 })
                                .catch(() => false);
                              if (isLoading) break;
                            } catch {
                              continue;
                            }
                          }

                          // If loading is gone and we've waited a bit, check for result again
                          if (!isLoading) {
                            await delay(1000); // Give more time for DOM to update
                            
                            // Check for result again with all selectors
                            for (const selector of resultSelectors) {
                              try {
                                hasResult = await page
                                  .locator(selector)
                                  .isVisible({ timeout: 500 })
                                  .catch(() => false);
                                if (hasResult) {
                                  console.log(`  ✅ AI comparison completed (loading gone, result appeared via ${selector})`);
                                  comparisonComplete = true;
                                  break;
                                }
                              } catch {
                                continue;
                              }
                            }
                            
                            if (comparisonComplete) break;
                          }

                          // Log progress every 5 seconds
                          const elapsed = Date.now() - startTime;
                          if (elapsed % 5000 < 500) {
                            console.log(`  ⏳ Still waiting... ${(elapsed / 1000).toFixed(1)}s elapsed`);
                          }

                          // Wait a bit before checking again
                          await delay(500);
                        } catch (error) {
                          // Continue waiting if check fails
                          await delay(500);
                        }
                      }

                      const elapsedTime = Date.now() - startTime;
                      if (comparisonComplete) {
                        console.log(
                          `  ✅ AI comparison completed in ${(elapsedTime / 1000).toFixed(1)}s`
                        );
                      } else {
                        console.log(
                          `  ⚠️  AI comparison wait timed out after ${(elapsedTime / 1000).toFixed(1)}s, scrolling anyway to show current state...`
                        );
                      }
                      
                      // Scroll the comparison dialog to show the results (even if comparison didn't complete)
                      console.log("  📜 Scrolling comparison dialog to show results...");
                      try {
                        await delay(500); // Wait for any results to render
                        
                        // Scroll within the DialogContent to show the comparison results
                        const scrollSteps = 6;
                        const scrollDelay = 400;
                        
                          for (let i = 0; i < scrollSteps; i++) {
                            await page.evaluate(({ stepIndex, totalSteps }) => {
                              const dialog = document.querySelector(
                                '[role="dialog"]'
                              ) as HTMLElement;
                              
                              if (dialog) {
                                const dialogContent = dialog.querySelector(
                                  '[class*="DialogContent"], [class*="overflow-y-auto"]'
                                ) as HTMLElement;
                                
                                const scrollableElement = dialogContent || dialog;
                                
                                if (scrollableElement) {
                                  const scrollHeight = scrollableElement.scrollHeight;
                                  const clientHeight = scrollableElement.clientHeight;
                                  const maxScroll = scrollHeight - clientHeight;
                                  
                                  if (maxScroll > 0) {
                                    const scrollPosition = (maxScroll * (stepIndex + 1)) / totalSteps;
                                    scrollableElement.scrollTo({
                                      top: scrollPosition,
                                      behavior: "smooth",
                                    });
                                  }
                                }
                              }
                            }, { stepIndex: i, totalSteps: scrollSteps });
                            await delay(scrollDelay);
                          }
                        
                        // Ensure we're at the bottom to show all results
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
                        await delay(1000); // Wait for scroll to complete and show results
                        
                        console.log("  ✅ Scrolled comparison dialog to show results");
                      } catch (scrollError) {
                        console.log(
                          `  ⚠️  Could not scroll comparison dialog: ${scrollError instanceof Error ? scrollError.message : String(scrollError)}, continuing...`
                        );
                      }
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
