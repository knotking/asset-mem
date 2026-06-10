import { Page } from "playwright";
import { config } from "../config";
import {
  SceneResult,
  delay,
  enableCheckpointOptionalAgents,
  hasAgentResponseLoading,
  isFullStructuredCheckpointAnalysisComplete,
  openChatSettings,
} from "../helpers";

/**
 * General Analysis-agent chat scene (used by record-mobile.ts mobile-emulation flow).
 */
export async function recordAIChat(page: Page): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene: AI Chat");

    if (!page.url().includes("/properties/")) {
      throw new Error("Not on a property page");
    }

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

    console.log("  ⚙️  Opening chat settings to enable optional agents...");
    const settingsOpened = await openChatSettings(page);
    if (settingsOpened) {
      await enableCheckpointOptionalAgents(page);
      await page.keyboard.press("Escape");
      await delay(300);
      console.log("  ✅ Chat settings closed");
    } else {
      console.log("  ⚠️  Could not open chat settings, continuing without optional agents");
    }

    const question = "Give me a complete analysis of my property's issues";
    console.log(`  💭 Asking: "${question}"`);
    await chatInput.click();
    await chatInput.fill(question);
    await delay(500);

    const sendButton = page.locator(config.selectors.chat.sendButton).first();
    if (await sendButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sendButton.click();
    } else {
      await page.keyboard.press("Enter");
    }

    console.log("  ⏳ Waiting for structured checkpoint analysis...");
    const maxWaitTime = 300000;
    const minWaitBeforeComplete = 5000;
    const loopStart = Date.now();
    let responseReceived = false;

    // Let thinking strip / lifecycle UI appear before we accept any structured sections.
    await delay(10000);

    while (!responseReceived && Date.now() - loopStart < maxWaitTime) {
      if (Date.now() - loopStart < minWaitBeforeComplete) {
        await delay(1000);
        continue;
      }

      if (await hasAgentResponseLoading(page)) {
        await delay(1000);
        continue;
      }

      const responseComplete = await isFullStructuredCheckpointAnalysisComplete(page);
      if (responseComplete) {
        responseReceived = true;
        const elapsed = ((Date.now() - loopStart) / 1000).toFixed(1);
        console.log(
          `  ✅ Structured analysis complete (summary, optional branches, synthesis — ${elapsed}s)`,
        );
        break;
      }

      await delay(1000);
    }

    await delay(responseReceived ? 8000 : 3000);

    const duration = Date.now() - startTime;
    console.log(`✅ AI Chat scene completed in ${(duration / 1000).toFixed(1)}s`);
    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ AI Chat scene failed:", error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
