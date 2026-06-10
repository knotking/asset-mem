import { Page } from "playwright";
import { config } from "../config";
import { SceneResult } from "../helpers";
import {
  delay,
  typeHumanLike,
  clickWithRetry,
  waitForVisible,
  scrollChatPartially,
  hasAgentResponseLoading,
  isCheckpointChatResponseComplete,
} from "../helpers";

export async function recordCheckpointChat(page: Page): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene: Checkpoint Chat Question");

    // Ensure we're on a property page
    if (!page.url().includes("/properties/")) {
      throw new Error("Not on a property page");
    }

    // Navigate to chat tab if not already there
    console.log("  💬 Switching to Checkpoint Chat tab...");
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
            }
          );
        }
      }
    }

    // Wait for chat tab to load - wait for chat input to be visible instead of networkidle
    console.log("  ⏳ Waiting for chat tab to load...");
    try {
      // Wait for URL to include /chat if we navigated
      if (page.url().includes("/chat")) {
        await page.waitForURL("**/chat**", { timeout: 5000 }).catch(() => {});
      }
      // Wait for chat input to be visible (indicates chat is loaded)
      const chatInput = page
        .locator(
          'textarea[aria-label="Chat input"], textarea[placeholder*="Ask" i], textarea'
        )
        .first();
      await chatInput.waitFor({ state: "visible", timeout: 10000 });
      await delay(1000);
    } catch (error) {
      console.log(
        `  ⚠️  Chat input wait timeout, continuing anyway: ${error instanceof Error ? error.message : String(error)}`
      );
      await delay(2000);
    }

    // Wait for chat input to be visible
    console.log("  ⏳ Waiting for chat input to be ready...");
    try {
      const chatInput = page
        .locator(
          'textarea[aria-label="Chat input"], textarea[placeholder*="Ask" i], textarea'
        )
        .first();
      await chatInput.waitFor({ state: "visible", timeout: 10000 });
      await delay(1000);
      console.log("  ✅ Chat input is ready");
    } catch (error) {
      console.log(
        `  ⚠️  Chat input not found: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Open Agent Settings and select Checkpoint Agent
    console.log("  ⚙️  Opening Agent Settings to select Checkpoint Agent...");
    try {
      // Try to find and click the Agent Settings button
      const agentSettingsSelectors = [
        'button[aria-label*="Open chat settings" i]',
        'button:has([class*="Settings"]):has([aria-label*="settings" i])',
        'button:has-text("Checkpoint"):has([class*="Clock"]), button:has-text("Checkpoint")',
        'button:has-text("Analysis"):has([class*="Stethoscope"]), button:has-text("Analysis")',
      ];

      let settingsOpened = false;

      // Find and click Agent Settings button
      for (const selector of agentSettingsSelectors) {
        try {
          const settingsButton = page.locator(selector).first();
          if (await settingsButton.isVisible({ timeout: 3000 })) {
            console.log(`  🔘 Found Agent Settings button`);
            await settingsButton.scrollIntoViewIfNeeded();
            await delay(300);
            await settingsButton.hover({ timeout: 1000 }).catch(() => {});
            await delay(300);
            await settingsButton.click();
            await delay(500); // Wait for popover to open
            settingsOpened = true;
            console.log("  ✅ Agent Settings opened");
            break;
          }
        } catch (error) {
          continue;
        }
      }

      // Alternative: Try to find the CompactSettingsBar
      if (!settingsOpened) {
        try {
          const settingsBar = page
            .locator(
              'div:has(button:has([class*="Settings"])):has(button:has-text("Analysis")), div:has(button:has([class*="Settings"])):has(button:has-text("Checkpoint"))'
            )
            .first();
          if (await settingsBar.isVisible({ timeout: 3000 })) {
            // Try the Settings icon button
            const settingsIconButton = settingsBar
              .locator('button:has([class*="Settings"])')
              .first();
            if (await settingsIconButton.isVisible({ timeout: 2000 })) {
              console.log("  🔘 Found Settings icon button, clicking...");
              await settingsIconButton.scrollIntoViewIfNeeded();
              await delay(300);
              await settingsIconButton.hover({ timeout: 1000 }).catch(() => {});
              await delay(300);
              await settingsIconButton.click();
              await delay(500);
              settingsOpened = true;
              console.log(
                "  ✅ Agent Settings opened via Settings icon button"
              );
            }
          }
        } catch (error) {
          console.log(
            "  ⚠️  Could not find Agent Settings button, continuing..."
          );
        }
      }

      // Wait for Agent Settings popover to be visible
      if (settingsOpened) {
        try {
          await page.waitForSelector(
            '[class*="PopoverContent"]:has-text("Chat Settings"), [class*="PopoverContent"]:has-text("Primary Agent")',
            {
              timeout: 3000,
              state: "visible",
            }
          );
          console.log("  ✅ Agent Settings popover is visible");
        } catch (error) {
          console.log(
            "  ⚠️  Agent Settings popover may not be visible, but continuing..."
          );
        }

        // Select Checkpoint Agent
        console.log("  🔘 Selecting Checkpoint Agent...");
        try {
          // Find the Checkpoint button in the Primary Agent section
          // Button has text "Checkpoint" and Clock icon, variant "default" when selected
          const checkpointButton = page
            .locator(
              'button:has-text("Checkpoint"):has([class*="Clock"]), button:has-text("Checkpoint")'
            )
            .first();

          if (await checkpointButton.isVisible({ timeout: 3000 })) {
            // Check if already selected (has variant="default")
            const isSelected = await checkpointButton
              .evaluate((el) => {
                const classList = el.classList.toString();
                return (
                  classList.includes("bg-primary") ||
                  classList.includes("default")
                );
              })
              .catch(() => false);

            if (!isSelected) {
              await checkpointButton.scrollIntoViewIfNeeded();
              await delay(300);
              await checkpointButton.hover({ timeout: 1000 }).catch(() => {});
              await delay(300);
              await checkpointButton.click();
              await delay(500);
              console.log("  ✅ Checkpoint Agent selected");
            } else {
              console.log("  ✅ Checkpoint Agent already selected");
            }
          } else {
            console.log("  ⚠️  Checkpoint Agent button not found");
          }
        } catch (error) {
          console.log(
            `  ⚠️  Could not select Checkpoint Agent: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        // Close the popover
        try {
          await page.keyboard.press("Escape");
          await delay(300);
          console.log("  ✅ Agent Settings closed (Escape key)");
        } catch (error) {
          // Try clicking outside
          try {
            await page.mouse.click(100, 100);
            await delay(300);
            console.log("  ✅ Agent Settings closed (clicked outside)");
          } catch (error) {
            console.log("  ⚠️  Could not close Agent Settings, continuing...");
          }
        }
      }
    } catch (error) {
      console.log(
        `  ⚠️  Error opening Agent Settings: ${error instanceof Error ? error.message : String(error)}, continuing...`
      );
    }

    // Type a question about checkpoints
    const checkpointQuestion =
      "What checkpoints do I have and what is their current status?";
    console.log(
      `  💭 Asking question about checkpoints: "${checkpointQuestion}"`
    );

    try {
      const chatInput = page
        .locator(
          'textarea[aria-label="Chat input"], textarea[placeholder*="Ask" i], textarea'
        )
        .first();

      // Clear any existing text
      await chatInput.click();
      await delay(300);
      await chatInput.fill("");

      // Type the question word by word
      await chatInput.focus();

      // Split into words and paste word by word
      const words = checkpointQuestion.split(" ");
      let currentText = "";
      for (const word of words) {
        currentText += (currentText ? " " : "") + word;
        await chatInput.fill(currentText);
        await delay(50); // Small delay between words
      }

      await delay(1000);

      console.log("  ✅ Question typed");
    } catch (error) {
      console.log(
        `  ⚠️  Could not type question: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }

    // Send the message
    console.log("  📤 Sending message...");
    try {
      const sendButton = page.locator(config.selectors.chat.sendButton).first();
      if (await sendButton.isVisible({ timeout: 5000 })) {
        await sendButton.click();
        console.log("  ✅ Message sent via send button");
      } else {
        // Try pressing Enter
        await page.keyboard.press("Enter");
        console.log("  ✅ Message sent via Enter key");
      }
      await delay(2000); // Wait for message to be sent
    } catch (error) {
      console.log(
        `  ⚠️  Could not send message: ${error instanceof Error ? error.message : String(error)}`
      );
      // Try pressing Enter as fallback
      await page.keyboard.press("Enter");
      await delay(2000);
    }

    // Wait for results to appear
    console.log("  ⏳ Waiting for AI response...");

    // Wait for assistant message to appear (not just user message)
    let responseReceived = false;
    let responseWaitEnd: number | null = null;
    let responseWaitStart: number | null = null; // Will be set after spinner visible for 2s
    let spinnerFirstSeen: number | null = null;
    const maxWaitTime = 300000; // 5 minutes max wait
    const minWaitBeforeComplete = 5000; // Don't consider complete before 5s (avoids 0.0s false positive)
    const spinnerVisibleDuration = 2000; // Wait 2s after spinner appears before starting cut timer
    const loopStartTime = Date.now();
    await delay(10000);
    while (!responseReceived && Date.now() - loopStartTime < maxWaitTime) {
      try {
        const elapsed = Date.now() - loopStartTime;

        const hasPageLevelLoading = await hasAgentResponseLoading(page);

        // Track when spinner first appears, then wait 2s before starting cut timer
        if (hasPageLevelLoading && spinnerFirstSeen === null) {
          spinnerFirstSeen = Date.now();
          console.log("  🔄 Checkpoint Agent spinner detected, waiting 2s before starting cut timer...");
        }
        
        // Start cut timer 2 seconds after spinner first appears
        if (spinnerFirstSeen !== null && responseWaitStart === null) {
          const spinnerVisibleTime = Date.now() - spinnerFirstSeen;
          if (spinnerVisibleTime >= spinnerVisibleDuration) {
            responseWaitStart = Date.now();
            console.log("  ✂️  Cut timer started (spinner visible for 2s)");
          }
        }

        // Don't consider response complete until minimum wait has passed (avoids matching
        // pre-existing content or UI before "Thinking" / AgentStatus appears)
        // Use responseWaitStart if set, otherwise use loopStartTime
        const effectiveStartTime = responseWaitStart || loopStartTime;
        const effectiveElapsed = Date.now() - effectiveStartTime;
        if (effectiveElapsed < minWaitBeforeComplete) {
          await delay(1000);
          continue;
        }

        // Look for assistant messages (not user messages)
        // User messages typically have bg-secondary or self-end classes
        // Assistant messages don't have these classes
        const assistantMessages = await page
          .locator(
            'div.flex.items-start:not(:has([class*="bg-secondary"]:has([class*="self-end"]))):not(:has([class*="justify-end"]))'
          )
          .all();

        // Check if we have at least one assistant message after our question
        // We should have at least 2 messages: our question (user) and the response (assistant)
        if (assistantMessages.length > 0 && !hasPageLevelLoading) {
          // Check if the last assistant message has content (not just loading)
          const lastAssistantMessage =
            assistantMessages[assistantMessages.length - 1];
          const messageText = await lastAssistantMessage
            .textContent()
            .catch(() => "");

          const hasSpinnerInMessage = await lastAssistantMessage
            .locator("[class*='animate-spin']")
            .isVisible()
            .catch(() => false);

          const responseComplete = await isCheckpointChatResponseComplete(
            page,
            messageText ?? "",
          );

          if (responseComplete && !hasSpinnerInMessage) {
            responseReceived = true;
            responseWaitEnd = Date.now();
            const effectiveStartTime = responseWaitStart || loopStartTime;
            const elapsed = ((Date.now() - effectiveStartTime) / 1000).toFixed(
              1
            );
            console.log(
              `  ✅ AI response received (checkpoint summary found, after ${elapsed}s)`,
            );
            break;
          }
        }

        // Log periodically while waiting
        if (hasPageLevelLoading) {
          const elapsed = ((Date.now() - loopStartTime) / 1000).toFixed(0);
          if (parseInt(elapsed) % 5 === 0) {
            console.log(
              `  ⏳ Still waiting for response... (${elapsed}s elapsed, Checkpoint Agent active)`
            );
          }
        }

        await delay(1000); // Check every second
      } catch (error) {
        await delay(1000);
      }
    }
    if (responseWaitEnd === null) responseWaitEnd = Date.now();
    
    // If we never saw the spinner, use loop start time as fallback
    // This ensures we always have a valid start time for the cut
    if (responseWaitStart === null) {
      responseWaitStart = loopStartTime;
      console.log("  ⚠️  Spinner not detected, using loop start time for cut");
    }

    // Scroll back to top after response (chat is already at bottom)
    if (responseReceived) {
      console.log("  📜 Scrolling back to top to show response...");
      try {
        // Scroll to top
        await scrollChatPartially(page, "top", 1.0, 15, 80);
      } catch (scrollErr) {
        console.log(
          `  ⚠️  Could not scroll chat: ${scrollErr instanceof Error ? scrollErr.message : String(scrollErr)}, continuing...`
        );
      }
      console.log("  ⏸️  Waiting 30 seconds after AI response...");
      await delay(30000);
    } else {
      console.log(
        "  ⚠️  AI response may not have been received, but waiting 5 seconds anyway..."
      );
      await delay(5000);
    }

    const duration = Date.now() - startTime;
    console.log(
      `✅ Checkpoint Chat scene completed in ${(duration / 1000).toFixed(1)}s`
    );

    const out: SceneResult = { success: true, duration };
    if (responseWaitEnd != null && responseWaitStart != null) {
      out.waitCut = {
        startOffsetMs: responseWaitStart - startTime,
        endOffsetMs: responseWaitEnd - startTime,
      };
    }
    return out;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Checkpoint Chat scene failed:", error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
