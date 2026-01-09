import { Page } from "playwright";
import { config } from "../config";
import { SceneResult } from "../helpers";
import {
  delay,
  typeHumanLike,
  clickWithRetry,
  waitForVisible,
  processAllAccordions,
} from "../helpers";
import * as path from "path";

export async function recordDiagnosisChat(page: Page): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene: Diagnosis Chat");

    // Ensure we're on a property chat page
    if (!page.url().includes("/properties/")) {
      throw new Error("Not on a property page");
    }

    // Navigate to chat tab if not already there
    if (!page.url().includes("/chat")) {
      try {
        const chatTab = page
          .locator(config.selectors.propertyDetails.chatTab)
          .first();
        if (await chatTab.isVisible()) {
          await chatTab.click();
          await page.waitForURL("**/chat**", { timeout: 5000 });
        }
      } catch (error) {
        // Try navigating directly
        const currentUrl = page.url();
        const propertyId = currentUrl.match(/\/properties\/([^\/]+)/)?.[1];
        if (propertyId) {
          await page.goto(
            `${config.baseUrl}/home/properties/${propertyId}/chat`,
            {
              waitUntil: "networkidle",
            },
          );
        }
      }
    }

    // Wait for chat to be ready - wait for chat input instead of networkidle
    try {
      // Wait for URL to include /chat if we navigated
      if (page.url().includes("/chat")) {
        await page.waitForURL("**/chat**", { timeout: 5000 }).catch(() => {});
      }
      // Wait for chat input to be visible (indicates chat is loaded)
      const chatInput = page
        .locator(
          'textarea[aria-label="Chat input"], textarea[placeholder*="Ask" i], textarea',
        )
        .first();
      await chatInput.waitFor({ state: "visible", timeout: 10000 });
      await delay(1000);
    } catch (error) {
      console.log(
        `  ⚠️  Chat input wait timeout, continuing anyway: ${error instanceof Error ? error.message : String(error)}`,
      );
      await delay(2000);
    }

    // Show chat sessions sidebar if visible
    console.log("  📋 Showing chat sessions...");
    try {
      const sessionList = page
        .locator(config.selectors.chat.sessionList)
        .first();
      if (await sessionList.isVisible({ timeout: 3000 })) {
        await delay(1000);
      }
    } catch (error) {
      console.log("  ⚠️  Session list not visible, continuing...");
    }

    // Click on "New Session" button
    console.log("  ➕ Clicking on New Session button...");
    try {
      // Find the "New Session" button - try multiple selectors
      const newSessionSelectors = [
        'button[aria-label="New Session"]',
        'button:has-text("New Session")',
        'footer button:has([class*="Plus"]):has-text("New Session")',
        'aside footer button:has([class*="Plus"])',
      ];

      let newSessionButton = null;
      let buttonFound = false;

      for (const selector of newSessionSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 3000 })) {
            newSessionButton = button;
            buttonFound = true;
            console.log(
              `  🔘 Found New Session button with selector: ${selector}`,
            );
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (buttonFound && newSessionButton) {
        await newSessionButton.scrollIntoViewIfNeeded();
        await delay(300);
        await newSessionButton.hover({ timeout: 1000 }).catch(() => {});
        await delay(300);
        await newSessionButton.click();
        console.log("  ✅ New Session button clicked");

        // Wait for 5 seconds as requested
        console.log("  ⏸️  Waiting 5 seconds for new session to be created...");
        await delay(5000);
      } else {
        console.log("  ⚠️  New Session button not found, continuing...");
      }
    } catch (error) {
      console.log(
        `  ⚠️  Could not click New Session button: ${error instanceof Error ? error.message : String(error)}, continuing...`,
      );
    }

    // Show Agent Settings for 2 seconds before uploading photo
    console.log("  ⚙️  Opening Agent Settings...");
    try {
      // Try to find and click the Agent Settings button
      // The CompactSettingsBar has buttons for Agent and Settings
      // Try the Settings icon button first, then the Agent button
      const agentSettingsSelectors = [
        'button[aria-label*="Open chat settings" i]',
        'button:has([class*="Settings"]):has([aria-label*="settings" i])',
        'button:has-text("Analysis"):has([class*="Stethoscope"]), button:has-text("Analysis")',
        'button:has-text("Checkpoint"):has([class*="Clock"]), button:has-text("Checkpoint")',
      ];

      let settingsButtonElement = null;
      let settingsOpened = false;

      // Find and click Agent Settings button
      for (const selector of agentSettingsSelectors) {
        try {
          const settingsButton = page.locator(selector).first();
          if (await settingsButton.isVisible({ timeout: 3000 })) {
            console.log(`  🔘 Found Agent Settings button`);
            settingsButtonElement = settingsButton;
            await settingsButton.scrollIntoViewIfNeeded();
            await delay(300);
            // Hover before click for better visibility
            await settingsButton.hover({ timeout: 1000 }).catch(() => {});
            await delay(300);
            await settingsButton.click();
            await delay(500); // Wait for popover to open
            settingsOpened = true;
            console.log("  ✅ Agent Settings opened");

            // Keep mouse visible on the Agent Settings button for 1 second after clicking
            console.log(
              "  👁️  Mouse staying on Agent Settings button for 1 second...",
            );
            await delay(1000);
            break;
          }
        } catch (error) {
          continue;
        }
      }

      // Alternative: Try to find the CompactSettingsBar and click on the agent button or settings icon
      if (!settingsOpened) {
        try {
          // Look for the CompactSettingsBar container - it has buttons for Agent and Settings
          const settingsBar = page
            .locator(
              'div:has(button:has([class*="Settings"])):has(button:has-text("Analysis")), div:has(button:has([class*="Settings"])):has(button:has-text("Checkpoint"))',
            )
            .first();
          if (await settingsBar.isVisible({ timeout: 3000 })) {
            // Click on the Agent button (the one with text "Analysis" or "Checkpoint")
            const agentButton = settingsBar
              .locator(
                'button:has-text("Analysis"), button:has-text("Checkpoint")',
              )
              .first();
            if (await agentButton.isVisible({ timeout: 2000 })) {
              console.log(
                "  🔘 Found Agent button in CompactSettingsBar, clicking...",
              );
              settingsButtonElement = agentButton;
              await agentButton.scrollIntoViewIfNeeded();
              await delay(300);
              await agentButton.hover({ timeout: 1000 }).catch(() => {});
              await delay(300);
              await agentButton.click();
              await delay(500);
              settingsOpened = true;
              console.log("  ✅ Agent Settings opened via Agent button");

              // Keep mouse visible on the Agent Settings button for 1 second after clicking
              console.log(
                "  👁️  Mouse staying on Agent Settings button for 1 second...",
              );
              await delay(1000);
            } else {
              // Try the Settings icon button
              const settingsIconButton = settingsBar
                .locator('button:has([class*="Settings"])')
                .first();
              if (await settingsIconButton.isVisible({ timeout: 2000 })) {
                console.log(
                  "  🔘 Found Settings icon button in CompactSettingsBar, clicking...",
                );
                settingsButtonElement = settingsIconButton;
                await settingsIconButton.scrollIntoViewIfNeeded();
                await delay(300);
                await settingsIconButton
                  .hover({ timeout: 1000 })
                  .catch(() => {});
                await delay(300);
                await settingsIconButton.click();
                await delay(500);
                settingsOpened = true;
                console.log(
                  "  ✅ Agent Settings opened via Settings icon button",
                );

                // Keep mouse visible on the Agent Settings button for 1 second after clicking
                console.log(
                  "  👁️  Mouse staying on Agent Settings button for 1 second...",
                );
                await delay(1000);
              }
            }
          }
        } catch (error) {
          console.log(
            "  ⚠️  Could not find Agent Settings button, continuing...",
          );
        }
      }

      // Wait for Agent Settings popover to be visible
      if (settingsOpened) {
        try {
          // Wait for the Chat Settings popover content to be visible
          // The popover has "Chat Settings" heading and "Agent" tab
          await page.waitForSelector(
            '[class*="PopoverContent"]:has-text("Chat Settings"), [class*="PopoverContent"]:has-text("Agent"), [class*="PopoverContent"]:has-text("Primary Agent")',
            {
              timeout: 3000,
              state: "visible",
            },
          );
          console.log("  ✅ Agent Settings popover is visible");
        } catch (error) {
          // Try alternative selectors
          try {
            await page.waitForSelector(
              'text="Chat Settings", text="Primary Agent", text="Optional Agents"',
              {
                timeout: 2000,
                state: "visible",
              },
            );
            console.log(
              "  ✅ Agent Settings popover is visible (alternative check)",
            );
          } catch (error) {
            console.log(
              "  ⚠️  Agent Settings popover may not be visible, but continuing...",
            );
          }
        }

        // Click on Location tab
        console.log("  📍 Clicking on Location tab...");
        try {
          const locationTab = page
            .locator(
              '[role="tab"]:has-text("Location"), button:has-text("Location"), [class*="TabsTrigger"]:has-text("Location")',
            )
            .first();
          if (await locationTab.isVisible({ timeout: 3000 })) {
            await locationTab.click();
            await delay(500);
            console.log("  ✅ Location tab clicked");
          } else {
            console.log(
              "  ⚠️  Location tab not found, trying alternative selector...",
            );
            // Try alternative selector
            const locationTabAlt = page
              .locator('[value="location"], [data-value="location"]')
              .first();
            if (await locationTabAlt.isVisible({ timeout: 2000 })) {
              await locationTabAlt.click();
              await delay(500);
              console.log("  ✅ Location tab clicked (alternative selector)");
            }
          }
        } catch (error) {
          console.log(
            `  ⚠️  Could not click Location tab: ${error instanceof Error ? error.message : String(error)}, continuing...`,
          );
        }

        // Set search radius to 10 miles
        console.log("  📍 Setting search radius to 10 miles...");
        try {
          // Wait for the Location tab content to be visible
          await delay(500);

          // Look for the radius button with text "10" in the location settings area
          // The buttons are in a flex container with buttons for 5, 10, 25, 50, 100
          const radiusButton = page
            .locator(
              'button:has-text("10"):not(:has-text("100")):not(:has-text("25")):not(:has-text("50"))',
            )
            .first();

          if (await radiusButton.isVisible({ timeout: 3000 })) {
            await radiusButton.scrollIntoViewIfNeeded();
            await delay(200);
            await radiusButton.hover({ timeout: 1000 }).catch(() => {});
            await delay(200);
            await radiusButton.click();
            await delay(500);
            console.log("  ✅ Search radius set to 10 miles");
          } else {
            // Try alternative: look for button with exact text "10" in a flex container
            const radiusButtonAlt = page
              .locator(
                'div:has(label:has-text("Search Radius")) button:has-text("10")',
              )
              .first();
            if (await radiusButtonAlt.isVisible({ timeout: 2000 })) {
              await radiusButtonAlt.scrollIntoViewIfNeeded();
              await delay(200);
              await radiusButtonAlt.hover({ timeout: 1000 }).catch(() => {});
              await delay(200);
              await radiusButtonAlt.click();
              await delay(500);
              console.log(
                "  ✅ Search radius set to 10 miles (alternative selector)",
              );
            } else {
              console.log("  ⚠️  Search radius button '10' not found");
            }
          }
        } catch (error) {
          console.log(
            `  ⚠️  Could not set search radius: ${error instanceof Error ? error.message : String(error)}, continuing...`,
          );
        }

        // Close the popover by pressing Escape or clicking outside
        try {
          // First try Escape key
          await page.keyboard.press("Escape");
          await delay(300);
          console.log("  ✅ Agent Settings closed (Escape key)");
        } catch (error) {
          // If Escape doesn't work, try clicking outside the popover
          try {
            // Click on a safe area outside the popover (top-left corner of the chat input area)
            await page.mouse.click(100, 100);
            await delay(300);
            console.log("  ✅ Agent Settings closed (clicked outside)");
          } catch (error) {
            // Last resort: try to find and click a close button if it exists
            try {
              const closeButton = page
                .locator(
                  'button[aria-label*="Close"], button:has([class*="X"])',
                )
                .first();
              if (await closeButton.isVisible({ timeout: 1000 })) {
                await closeButton.click();
                await delay(300);
                console.log("  ✅ Agent Settings closed (close button)");
              } else {
                console.log(
                  "  ⚠️  Could not close Agent Settings, continuing...",
                );
              }
            } catch (error) {
              console.log(
                "  ⚠️  Could not close Agent Settings, continuing...",
              );
            }
          }
        }
      }

      // After closing Agent Settings (or if it wasn't found), click the Attachment (paperclip) button
      console.log(
        "  📎 Clicking Attachment button (paperclip icon) near chat input...",
      );
      try {
        // Find the attachment/paperclip button near the chat input
        const attachmentButtonSelectors = [
          'button[aria-label*="Attach file" i], button[aria-label*="Attach" i]',
          'button:has([class*="Paperclip"]), button:has(svg[class*="Paperclip"])',
          'button:has(svg):has([class*="h-5"]):near(textarea)',
        ];

        let attachmentButtonClicked = false;
        for (const selector of attachmentButtonSelectors) {
          try {
            const attachmentButton = page.locator(selector).first();
            if (await attachmentButton.isVisible({ timeout: 3000 })) {
              console.log(`  🔘 Found Attachment button`);
              await attachmentButton.scrollIntoViewIfNeeded();
              await delay(300);
              // Hover before click for better visibility (shows mouse moving to button)
              await attachmentButton.hover({ timeout: 1000 }).catch(() => {});
              await delay(400); // Show hover state - longer delay for better visibility
              await attachmentButton.click();
              await delay(500); // Wait for file dialog or input to be ready
              attachmentButtonClicked = true;
              console.log("  ✅ Attachment button clicked");
              break;
            }
          } catch (error) {
            continue;
          }
        }

        // Alternative: Try to find by finding textarea first, then finding buttons near it
        if (!attachmentButtonClicked) {
          try {
            // Find textarea first
            const textarea = page
              .locator(
                'textarea[aria-label="Chat input"], textarea[placeholder*="Ask" i]',
              )
              .first();
            if (await textarea.isVisible({ timeout: 3000 })) {
              // Find the paperclip button - it should be in the same container as textarea
              // Look for buttons in the chat input area
              const chatInputArea = textarea.locator("..").first(); // Parent container
              const paperclipButton = chatInputArea
                .locator("button:has(svg)")
                .first();

              if (await paperclipButton.isVisible({ timeout: 2000 })) {
                console.log("  🔘 Found Attachment button near textarea");
                await paperclipButton.scrollIntoViewIfNeeded();
                await delay(300);
                await paperclipButton.hover({ timeout: 1000 }).catch(() => {});
                await delay(400); // Show hover state
                await paperclipButton.click();
                await delay(500);
                attachmentButtonClicked = true;
                console.log("  ✅ Attachment button clicked (near textarea)");
              }
            }
          } catch (error) {
            console.log(
              "  ⚠️  Could not find Attachment button near textarea, continuing...",
            );
          }
        }

        if (!attachmentButtonClicked) {
          console.log(
            "  ⚠️  Could not find Attachment button, will try direct file input...",
          );
        }
      } catch (error) {
        console.log(
          `  ⚠️  Error clicking Attachment button: ${error instanceof Error ? error.message : String(error)}, continuing...`,
        );
      }
    } catch (error) {
      console.log(
        `  ⚠️  Error showing Agent Settings: ${error instanceof Error ? error.message : String(error)}, continuing with photo upload...`,
      );
    }

    // Upload photo instead of typing a message
    console.log("  📸 Uploading photo...");

    // Get the path to the photo file (same directory as this script)
    // __dirname works when script is executed directly via tsx/ts-node
    const photoPath = path.join(__dirname, "DoorPaintDamage.png");

    // Find and upload the file to the file input
    try {
      // Look for the file input (hidden input with type="file")
      const fileInput = page.locator('input[type="file"]').first();

      if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        // If visible, click it first
        await fileInput.click();
        await delay(500);
      }

      // Set the file directly (Playwright can interact with hidden inputs)
      await fileInput.setInputFiles(photoPath);
      console.log(`  ✅ Photo uploaded: ${path.basename(photoPath)}`);

      // Wait for file to be processed/uploaded
      await delay(2000);

      // Check if file attachment preview is visible (indicating successful upload)
      try {
        await page
          .waitForSelector(
            '[class*="file"]:has-text("Upload"), [class*="attachment"]',
            {
              timeout: 5000,
              state: "visible",
            },
          )
          .catch(() => {
            // File might be processing, wait a bit more
            console.log("  ⏳ Waiting for file processing...");
          });
      } catch (error) {
        console.log("  ℹ️  File upload in progress...");
      }

      // Wait a bit more for the file to be fully attached
      await delay(2000);
    } catch (error) {
      console.log(
        `  ⚠️  Could not upload file directly, trying alternative method...`,
      );

      // Alternative: Click the paperclip button to trigger file dialog
      try {
        const paperclipButton = page
          .locator('button[aria-label*="Attach"], button[aria-label*="file"]')
          .first();
        if (await paperclipButton.isVisible({ timeout: 3000 })) {
          await paperclipButton.click();
          await delay(500);

          // Then set the file on the input
          const fileInput = page.locator('input[type="file"]').first();
          await fileInput.setInputFiles(photoPath);
          console.log(
            `  ✅ Photo uploaded via button: ${path.basename(photoPath)}`,
          );
          await delay(2000);
        }
      } catch (altError) {
        console.log(
          `  ❌ Failed to upload photo: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new Error(
          `Could not upload photo: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Send message with photo attachment
    console.log("  📤 Sending message with photo...");
    try {
      const sendButton = page.locator(config.selectors.chat.sendButton).first();
      if (await sendButton.isVisible({ timeout: 5000 })) {
        // Wait a bit more for file to finish uploading
        await delay(2000);
        await sendButton.click();
        console.log("  ✅ Message with photo sent");
        await delay(3000); // Wait a bit for message to be sent
      } else {
        // Try pressing Enter
        await delay(2000);
        await page.keyboard.press("Enter");
        console.log("  ✅ Message with photo sent (via Enter)");
        await delay(3000);
      }
    } catch (error) {
      console.log(
        `  ⚠️  Could not send message: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Wait a bit to show the message with photo was sent
    await delay(2000);

    // Track each agent's completion time for video cutting
    interface AgentTracking {
      name: string;
      startTime: number | null; // When spinner first appears (2s after first seen)
      endTime: number | null; // When checkmark appears
      firstSeen: number | null; // When spinner first detected
    }

    const agents: AgentTracking[] = [
      { name: "triage", startTime: null, endTime: null, firstSeen: null },
      { name: "coverage", startTime: null, endTime: null, firstSeen: null },
      { name: "diy", startTime: null, endTime: null, firstSeen: null },
      { name: "service", startTime: null, endTime: null, firstSeen: null },
      { name: "cost", startTime: null, endTime: null, firstSeen: null },
    ];

    const spinnerVisibleDuration = 2000; // Wait 2s after spinner appears before starting cut timer
    let accordionAppearTime: number | null = null; // Track when accordions appear (for wait cut)

    // Wait for all Agent status to complete, specifically waiting for the cost agent (last one)
    console.log(
      "  ⏳ Waiting for all agents to complete (including cost agent, which is the last one)...",
    );
    // No timeout - will wait until all agents complete and results are shown
    const agentWaitStart = Date.now();
    let allAgentsCompleted = false;

    while (!allAgentsCompleted) {
      try {
        // Look for the agent status card (AgentStatus renders a Card with `max-w-md` and header "Thinking...")
        // NOTE: shadcn/ui `Card` does NOT include "Card" in its className, so `[class*="Card"]` won't match.
        const agentStatusCard = page
          .locator(
            'div:has-text("Thinking...")[class*="max-w-md"], div[class*="max-w-md"]:has-text("Thinking..."), div.max-w-md:has-text("Thinking...")',
          )
          .first();

        if (
          await agentStatusCard.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          // Get all step rows in the agent status card
          const allSteps = await agentStatusCard
            .locator(
              'div[class*="justify-between"][class*="items-center"]:has(div[class*="gap-2"])',
            )
            .all();

          // Track each agent's status
          for (const step of allSteps) {
            try {
              // Step label is rendered in the inner flex row: icon + <span>{step.name}</span>
              const stepName =
                (await step
                  .locator('div[class*="gap-2"] > span')
                  .first()
                  .textContent()
                  .catch(() => "")) || "";
              const stepTextLower = stepName.toLowerCase();

              // Find which agent this step belongs to
              let agent: AgentTracking | null = null;
              for (const a of agents) {
                if (stepTextLower.includes(a.name)) {
                  agent = a;
                  break;
                }
              }

              if (!agent) continue;

              // Check if step has spinner (executing)
              const hasSpinner = await step
                .locator('svg.animate-spin, [class*="animate-spin"]')
                .isVisible()
                .catch(() => false);

              // Check if step has checkmark (completed)
              const hasCheckCircle = await step
                .locator(
                  'svg.text-green-500, [class*="text-green-500"], [class*="text-green"]',
                )
                .isVisible()
                .catch(() => false);

              const now = Date.now();

              // Track when spinner first appears
              if (hasSpinner && agent.firstSeen === null) {
                agent.firstSeen = now;
                console.log(
                  `  🔄 ${agent.name} agent spinner detected, waiting 2s before starting cut timer...`,
                );
              }

              // Set start time 2s after spinner first appears
              if (agent.firstSeen !== null && agent.startTime === null) {
                const spinnerVisibleTime = now - agent.firstSeen;
                if (spinnerVisibleTime >= spinnerVisibleDuration) {
                  agent.startTime = now;
                  console.log(
                    `  ✂️  ${agent.name} agent cut timer started (spinner visible for 2s)`,
                  );
                }
              }

              // Track when agent completes
              if (hasCheckCircle && !hasSpinner && agent.endTime === null) {
                agent.endTime = now;
                console.log(`  ✅ ${agent.name} agent completed`);
              }
            } catch (error) {
              continue;
            }
          }
        }

        // Check if all agents are completed
        const allCompleted = agents.every((a) => a.endTime !== null);
        const hasExecuting = await page
          .locator(
            '[class*="animate-spin"]:visible, text="Executing":visible, text="Thinking":visible',
          )
          .count()
          .catch(() => 0);

        // If all agents completed, check completion conditions
        if (allCompleted) {
          // Log agent completion status
          const completedAgents = agents
            .filter((a) => a.endTime !== null)
            .map((a) => a.name)
            .join(", ");
          console.log(`  ✅ All agents completed: ${completedAgents}`);

          // Double check: wait a bit more to ensure everything is truly done and results are displayed
          await delay(2000);
          const stillExecuting = await page
            .locator(
              '[class*="animate-spin"]:visible, text="Executing":visible',
            )
            .count()
            .catch(() => 0);
          const stillThinking = await page
            .locator('text="Thinking":visible')
            .count()
            .catch(() => 0);

          // Check if accordions are visible (results are displayed in accordions)
          const accordionTriggers = await page
            .locator(
              '[role="button"][aria-expanded], [class*="AccordionTrigger"], button[aria-expanded]',
            )
            .count()
            .catch(() => 0);
          const accordionItems = await page
            .locator('[class*="AccordionItem"], [data-radix-accordion-item]')
            .count()
            .catch(() => 0);
          const hasAccordions = accordionTriggers > 0 || accordionItems > 0;

          // Also check for result text as backup
          const hasCostEstimates = await page
            .getByText(/Cost Estimates/i)
            .isVisible()
            .catch(() => false);
          const hasResults = await page
            .locator("text=/Cost Estimates|DIY|Service|Coverage|Diagnosis/i")
            .count()
            .catch(() => 0);

          // Debug logging
          console.log(
            `  🔍 Completion check: allCompleted=${allCompleted}, stillExecuting=${stillExecuting}, stillThinking=${stillThinking}, hasAccordions=${hasAccordions} (${accordionTriggers} triggers, ${accordionItems} items), hasResults=${hasResults}`,
          );

          if (stillExecuting === 0 && stillThinking === 0 && hasAccordions) {
            allAgentsCompleted = true;
            console.log(
              `  ✅ All agents completed and accordions are visible (${accordionTriggers} trigger(s), ${accordionItems} item(s))`,
            );
            break;
          } else if (
            stillExecuting === 0 &&
            stillThinking === 0 &&
            (hasCostEstimates || hasResults > 0)
          ) {
            // Fallback: if no accordions but results text is visible
            allAgentsCompleted = true;
            console.log(
              "  ✅ All agents completed and results are displayed (fallback check)",
            );
            break;
          } else if (stillExecuting === 0 && stillThinking === 0) {
            // All agents done but accordions might still be rendering, wait a bit more
            console.log(
              "  ⏳ All agents completed, waiting for accordions to render...",
            );
            await delay(3000);
            // Check again for accordions
            const finalAccordionTriggers = await page
              .locator(
                '[role="button"][aria-expanded], [class*="AccordionTrigger"], button[aria-expanded]',
              )
              .count()
              .catch(() => 0);
            const finalAccordionItems = await page
              .locator('[class*="AccordionItem"], [data-radix-accordion-item]')
              .count()
              .catch(() => 0);
            const finalHasAccordions =
              finalAccordionTriggers > 0 || finalAccordionItems > 0;

            // Check for result text again
            const finalHasResults = await page
              .locator("text=/Cost Estimates|DIY|Service|Coverage|Diagnosis/i")
              .count()
              .catch(() => 0);

            console.log(
              `  🔍 Final check: finalHasAccordions=${finalHasAccordions} (${finalAccordionTriggers} triggers, ${finalAccordionItems} items), finalHasResults=${finalHasResults}`,
            );

            if (finalHasAccordions) {
              allAgentsCompleted = true;
              console.log(
                `  ✅ Accordions are now visible (${finalAccordionTriggers} trigger(s), ${finalAccordionItems} item(s))`,
              );
              break;
            } else if (finalHasResults > 0) {
              // Final fallback: check for result text
              allAgentsCompleted = true;
              console.log("  ✅ Results are now displayed (fallback check)");
              break;
            } else {
              // Ultimate fallback: if all agents completed, proceed anyway
              // (accordions might be in a different format or not yet detected)
              console.log(
                "  ⚠️  All agents completed but accordions/results not detected. Proceeding anyway after 3s wait...",
              );
              await delay(3000);
              allAgentsCompleted = true;
              console.log("  ✅ Proceeding with completion (all agents done)");
              break;
            }
          }
        } else if (allCompleted) {
          // If all agents completed but we didn't enter the above block, proceed anyway
          // This handles the case where hasExecuting > 0 but all agents are done
          console.log(
            "  ✅ All agents completed (some UI indicators may still be visible, but proceeding)",
          );
          allAgentsCompleted = true;
          break;
        }

        if (!allAgentsCompleted) {
          await delay(2000); // Check every 2 seconds
          const elapsed = ((Date.now() - agentWaitStart) / 1000).toFixed(0);
          const completedCount = agents.filter(
            (a) => a.endTime !== null,
          ).length;
          console.log(
            `  ⏳ Still waiting for agents to complete... (${completedCount}/${agents.length} completed, ${elapsed}s elapsed)`,
          );
        }
      } catch (error) {
        await delay(2000);
      }
    }

    // Wait for agent status card's "Thinking" text to disappear after cost agent completes
    if (allAgentsCompleted) {
      console.log(
        "  ⏳ Waiting for agent status 'Thinking...' text to disappear...",
      );
      let thinkingDisappeared = false;

      // Wait indefinitely for the agent status card's "Thinking..." to disappear
      const thinkingWaitStart = Date.now();
      while (!thinkingDisappeared) {
        // Check if the agent status card with "Thinking..." is still visible
        const agentStatusCardVisible = await page
          .locator(
            'div:has-text("Thinking...")[class*="max-w-md"], div[class*="max-w-md"]:has-text("Thinking...")',
          )
          .isVisible()
          .catch(() => false);

        if (!agentStatusCardVisible) {
          thinkingDisappeared = true;
          console.log("  ✅ Agent status 'Thinking...' text has disappeared");
        } else {
          await delay(1000);
          const elapsed = Math.floor((Date.now() - thinkingWaitStart) / 1000);
          // Log every 2 seconds
          if (elapsed > 0 && elapsed % 2 === 0) {
            console.log(
              `  ⏳ Still waiting for agent status 'Thinking...' to disappear... (${elapsed}s elapsed)`,
            );
          }
        }
      }

      // Wait indefinitely for accordions to be displayed
      console.log(
        "  ⏳ Waiting for accordions to be displayed (indefinitely)...",
      );
      let accordionsVisible = false;
      const accordionWaitStart = Date.now();

      while (!accordionsVisible) {
        const accordionTriggers = await page
          .locator(
            '[role="button"][aria-expanded], [class*="AccordionTrigger"], button[aria-expanded]',
          )
          .count()
          .catch(() => 0);
        const accordionItems = await page
          .locator('[class*="AccordionItem"], [data-radix-accordion-item]')
          .count()
          .catch(() => 0);

        if (accordionTriggers > 0 || accordionItems > 0) {
          accordionsVisible = true;
          accordionAppearTime = Date.now();
          console.log(
            `  ✅ Accordions are visible (${accordionTriggers} trigger(s), ${accordionItems} item(s))`,
          );
        } else {
          await delay(1000);
          const elapsed = Math.floor((Date.now() - accordionWaitStart) / 1000);
          // Log every 5 seconds
          if (elapsed > 0 && elapsed % 5 === 0) {
            console.log(
              `  ⏳ Still waiting for accordions to appear... (${elapsed}s elapsed)`,
            );
          }
        }
      }

      // Process accordions if they're visible, otherwise proceed anyway since all agents completed
      if (accordionsVisible) {
        // Wait a bit more for accordions to be fully rendered before processing
        console.log(
          "  ⏸️  Waiting 2 seconds for accordions to fully render...",
        );
        await delay(2000);

        // Process accordions: expand, scroll, collapse (same as Existing Chat scene)
        console.log("  📂 Processing accordions (expand/collapse)...");
        try {
          // Import findAccordions to check before processing
          const { findAccordions } = await import("../helpers");

          // Retry logic: if no accordions found, wait and try again
          let accordionsProcessed = false;
          for (let retry = 0; retry < 7; retry++) {
            const foundAccordions = await findAccordions(page);
            if (foundAccordions.length > 0) {
              await processAllAccordions(page, {
                order: [
                  "triage",
                  "coverage",
                  "diy",
                  "service",
                  "cost-estimates",
                ],
                collapseAfterScroll: true,
                waitAfterExpand: 2000,
                waitAfterScroll: 1000,
              });
              accordionsProcessed = true;
              break;
            } else if (retry < 6) {
              console.log(
                `  🔄 No accordions found, waiting 2 seconds and retrying... (attempt ${retry + 2}/7)`,
              );
              await delay(2000);
            }
          }

          if (!accordionsProcessed) {
            console.log(
              "  ⚠️  Could not find accordions to process after retries, but continuing since all agents completed",
            );
          }
        } catch (error) {
          console.log(
            `  ⚠️  Error processing accordions: ${error instanceof Error ? error.message : String(error)}, but continuing since all agents completed`,
          );
        }
      } else {
        console.log(
          "  ⚠️  Accordions not detected, but all agents completed - proceeding with scene completion",
        );
      }
    } else {
      console.log("  ⚠️  All agents may not have completed, but continuing...");
    }

    // Ensure scene runs for at least 20 seconds
    const elapsedTime = Date.now() - startTime;
    const minDuration = 20000; // 20 seconds minimum
    if (elapsedTime < minDuration) {
      const remainingTime = minDuration - elapsedTime;
      console.log(
        `  ⏸️  Waiting for minimum duration (${(remainingTime / 1000).toFixed(1)}s remaining)...`,
      );
      await delay(remainingTime);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Scene 5 completed in ${(duration / 1000).toFixed(1)}s`);

    // Build wait cuts array from agent tracking
    const waitCuts: Array<{ startOffsetMs: number; endOffsetMs: number }> = [];
    for (const agent of agents) {
      if (agent.startTime !== null && agent.endTime !== null) {
        const startOffset = agent.startTime - startTime;
        const endOffset = agent.endTime - startTime;
        waitCuts.push({ startOffsetMs: startOffset, endOffsetMs: endOffset });
        console.log(
          `  ✂️  ${agent.name} agent wait segment: ${(startOffset / 1000).toFixed(1)}s - ${(endOffset / 1000).toFixed(1)}s`,
        );
      }
    }

    // Add wait cut for gap between cost agent completion and accordion appearance
    const costAgent = agents.find((a) => a.name === "cost");
    if (
      costAgent &&
      costAgent.endTime !== null &&
      accordionAppearTime !== null
    ) {
      const costAgentEndOffset = costAgent.endTime - startTime;
      const accordionAppearOffset = accordionAppearTime - startTime;
      // Only add cut if there's a meaningful gap (at least 1 second)
      if (accordionAppearOffset - costAgentEndOffset > 1000) {
        waitCuts.push({
          startOffsetMs: costAgentEndOffset,
          endOffsetMs: accordionAppearOffset,
        });
        console.log(
          `  ✂️  Cost agent to accordion gap wait segment: ${(costAgentEndOffset / 1000).toFixed(1)}s - ${(accordionAppearOffset / 1000).toFixed(1)}s (${((accordionAppearOffset - costAgentEndOffset) / 1000).toFixed(1)}s gap)`,
        );
      }
    }

    return {
      success: true,
      duration,
      waitCuts: waitCuts.length > 0 ? waitCuts : undefined,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Scene 5 failed:", error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
