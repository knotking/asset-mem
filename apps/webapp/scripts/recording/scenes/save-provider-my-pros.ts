import { Page } from "playwright";
import { config } from "../config";
import {
  SceneResult,
  delay,
  enableCheckpointOptionalAgents,
  getChatSettingsPopoverLocator,
  isChatComposerIdleAfterProcessing,
  closeFullChatReportSheet,
  navigateToDetailsAndOpenMyPros,
  openChatSettings,
  saveProvidersFromReportSheet,
  selectPrimaryAgentInSettings,
  waitForChatProcessingToStart,
} from "../helpers";

/** Service agent only — focused turn for local pro recommendations. */
const SAVE_PROVIDER_OPTIONAL_AGENTS = ["service"] as const;
const CHAT_QUESTION = "Find local service pros";
const MIN_PROVIDERS_TO_SAVE = 3;

export async function recordSaveProviderMyPros(page: Page): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene: Save Provider & My Pros");

    if (!page.url().includes("/properties/")) {
      throw new Error("Not on a property page");
    }

    console.log("  💬 Switching to AI Chat tab...");
    if (!page.url().includes("/chat")) {
      const chatTab = page.locator(config.selectors.propertyDetails.chatTab).first();
      if (await chatTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await chatTab.click();
        await page.waitForURL("**/chat**", { timeout: 10000 });
      } else {
        const propertyId = page.url().match(/\/properties\/([^/]+)/)?.[1];
        if (propertyId) {
          await page.goto(`${config.baseUrl}/home/properties/${propertyId}/chat`, {
            waitUntil: "load",
            timeout: 30000,
          });
        }
      }
    }

    const chatInput = page.locator(config.selectors.chat.messageInput).first();
    await chatInput.waitFor({ state: "visible", timeout: 10000 });

    console.log("  ⚙️  Opening chat settings (Checkpoint + Service agent)...");
    const settingsOpened = await openChatSettings(page);
    if (settingsOpened) {
      const popover = getChatSettingsPopoverLocator(page);
      await popover.waitFor({ state: "visible", timeout: 5000 });
      await selectPrimaryAgentInSettings(page, "checkpoint");
      await enableCheckpointOptionalAgents(page, SAVE_PROVIDER_OPTIONAL_AGENTS);
      await page.keyboard.press("Escape");
      await delay(300);
    } else {
      console.log("  ⚠️  Could not open chat settings, continuing...");
    }

    console.log(`  💭 Asking: "${CHAT_QUESTION}"`);
    await chatInput.click();
    await chatInput.fill(CHAT_QUESTION);
    await delay(500);

    const sendButton = page.locator(config.selectors.chat.sendButton).first();
    if (await sendButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sendButton.click();
    } else {
      await page.keyboard.press("Enter");
    }

    console.log("  ⏳ Waiting for AI response with service recommendations...");

    const maxWaitTime = 300000;
    const loopStartTime = Date.now();
    let responseReceived = false;

    const processingStarted = await waitForChatProcessingToStart(page);
    if (!processingStarted) {
      console.log("  ⚠️  Stop button never appeared; using send-button restore detection");
    }

    while (!responseReceived && Date.now() - loopStartTime < maxWaitTime) {
      const composerIdle = await isChatComposerIdleAfterProcessing(page);
      const canComplete =
        (processingStarted && composerIdle) ||
        (!processingStarted && composerIdle && Date.now() - loopStartTime > 10000);

      if (canComplete) {
        responseReceived = true;
        const elapsed = ((Date.now() - loopStartTime) / 1000).toFixed(1);
        console.log(`  ✅ AI response received (after ${elapsed}s)`);
        break;
      }

      await delay(1000);
    }

    if (!responseReceived) {
      console.log("  ⚠️  Timed out waiting for AI response; continuing anyway...");
    }

    await delay(2000);

    const savedCount = await saveProvidersFromReportSheet(page, MIN_PROVIDERS_TO_SAVE);
    if (savedCount < MIN_PROVIDERS_TO_SAVE) {
      console.log(
        `  ⚠️  Saved ${savedCount}/${MIN_PROVIDERS_TO_SAVE} providers from the report sheet`,
      );
    }

    await closeFullChatReportSheet(page);

    console.log("  📋 Navigating to Details tab and opening My pros...");
    await navigateToDetailsAndOpenMyPros(page);

    console.log("  ⏸️  Holding on My pros for 8 seconds...");
    await delay(8000);

    const duration = Date.now() - startTime;
    console.log(
      `✅ Save Provider & My Pros scene completed in ${(duration / 1000).toFixed(1)}s`,
    );

    return { success: savedCount >= MIN_PROVIDERS_TO_SAVE, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Save Provider & My Pros scene failed:", error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
