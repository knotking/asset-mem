import { Page } from "playwright";
import { config } from "../config";
import {
  SceneResult,
  delay,
  hasAgentResponseLoading,
  messageLooksLikeAgentLoading,
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

    const question = "What maintenance does this property need?";
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

    console.log("  ⏳ Waiting for AI response...");
    const maxWaitTime = 300000;
    const loopStart = Date.now();
    let responseReceived = false;

    while (!responseReceived && Date.now() - loopStart < maxWaitTime) {
      if (await hasAgentResponseLoading(page)) {
        await delay(1000);
        continue;
      }

      const assistantMessages = await page
        .locator(
          'div.flex.items-start:not(:has([class*="bg-secondary"]:has([class*="self-end"]))):not(:has([class*="justify-end"]))',
        )
        .all();

      if (assistantMessages.length > 0) {
        const last = assistantMessages[assistantMessages.length - 1];
        const text = (await last.textContent().catch(() => "")) ?? "";
        const hasSpinner = await last
          .locator("[class*='animate-spin']")
          .isVisible()
          .catch(() => false);

        if (!messageLooksLikeAgentLoading(text) && !hasSpinner && text.trim().length > 40) {
          responseReceived = true;
          console.log("  ✅ AI response received");
          break;
        }
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
