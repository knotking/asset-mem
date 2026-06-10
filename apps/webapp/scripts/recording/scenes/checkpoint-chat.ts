import { Page } from "playwright";
import { config } from "../config";
import { SceneResult } from "../helpers";
import {
  delay,
  enableCheckpointOptionalAgents,
  getChatSettingsPopoverLocator,
  isChatComposerIdleAfterProcessing,
  openChatSettings,
  openFullChatReportSheetAndScroll,
  selectPrimaryAgentInSettings,
  waitForChatProcessingToStart,
} from "../helpers";

const CHECKPOINT_CHAT_OPTIONAL_AGENTS = ["coverage", "service"] as const;

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
            },
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

    // Wait for chat input to be visible
    console.log("  ⏳ Waiting for chat input to be ready...");
    try {
      const chatInput = page
        .locator(
          'textarea[aria-label="Chat input"], textarea[placeholder*="Ask" i], textarea',
        )
        .first();
      await chatInput.waitFor({ state: "visible", timeout: 10000 });
      await delay(1000);
      console.log("  ✅ Chat input is ready");
    } catch (error) {
      console.log(
        `  ⚠️  Chat input not found: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Open Agent Settings and select Checkpoint Agent
    console.log("  ⚙️  Opening Agent Settings to select Checkpoint Agent...");
    try {
      const settingsOpened = await openChatSettings(page);
      if (!settingsOpened) {
        console.log("  ⚠️  Could not open chat settings, continuing...");
      } else {
        console.log("  ✅ Agent Settings opened");
        const popover = getChatSettingsPopoverLocator(page);
        await popover.waitFor({ state: "visible", timeout: 5000 });
        console.log("  ✅ Agent Settings popover is visible");

        console.log("  🔘 Selecting Checkpoint Agent...");
        await selectPrimaryAgentInSettings(page, "checkpoint");

        console.log("  🔘 Enabling optional agents (Coverage, Service)...");
        await enableCheckpointOptionalAgents(page, CHECKPOINT_CHAT_OPTIONAL_AGENTS);

        await page.keyboard.press("Escape");
        await delay(300);
        console.log("  ✅ Agent Settings closed (Escape key)");
      }
    } catch (error) {
      console.log(
        `  ⚠️  Error opening Agent Settings: ${error instanceof Error ? error.message : String(error)}, continuing...`,
      );
    }

    // Type a question about checkpoints
    const checkpointQuestion =
      "Give me a complete analysis of my property's issues";
    console.log(
      `  💭 Asking question about checkpoints: "${checkpointQuestion}"`,
    );

    try {
      const chatInput = page
        .locator(
          'textarea[aria-label="Chat input"], textarea[placeholder*="Ask" i], textarea',
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
        `  ⚠️  Could not type question: ${error instanceof Error ? error.message : String(error)}`,
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
        `  ⚠️  Could not send message: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Try pressing Enter as fallback
      await page.keyboard.press("Enter");
      await delay(2000);
    }

    // Wait for agent turn: Stop appears while streaming, then Send returns when done.
    console.log("  ⏳ Waiting for AI response...");

    let responseReceived = false;
    const maxWaitTime = 300000; // 5 minutes max wait
    const loopStartTime = Date.now();

    const processingStarted = await waitForChatProcessingToStart(page);
    if (!processingStarted) {
      console.log(
        "  ⚠️  Stop button never appeared; falling back to send-button restore detection",
      );
    } else {
      console.log("  🔄 Agent processing started (Stop button visible)");
    }

    while (!responseReceived && Date.now() - loopStartTime < maxWaitTime) {
      try {
        const composerIdle = await isChatComposerIdleAfterProcessing(page);
        const canComplete =
          (processingStarted && composerIdle) ||
          (!processingStarted &&
            composerIdle &&
            Date.now() - loopStartTime > 10000);

        if (canComplete) {
          responseReceived = true;
          const elapsed = ((Date.now() - loopStartTime) / 1000).toFixed(1);
          console.log(
            `  ✅ AI response received (send button restored, after ${elapsed}s)`,
          );
          break;
        }

        await delay(1000);
      } catch (error) {
        await delay(1000);
      }
    }

    if (responseReceived) {
      await openFullChatReportSheetAndScroll(page);
    } else {
      console.log(
        "  ⚠️  AI response may not have been received, but waiting 5 seconds anyway...",
      );
      await delay(5000);
    }

    const duration = Date.now() - startTime;
    console.log(
      `✅ Checkpoint Chat scene completed in ${(duration / 1000).toFixed(1)}s`,
    );

    return { success: true, duration };
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
