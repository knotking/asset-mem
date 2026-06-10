import { Page } from "playwright";
import { config } from "../config";
import { SceneResult, delay } from "../helpers";

const HOLD_MS = 10_000;

/** Landing page hero hold — no scroll, clicks, or navigation. */
export async function recordLandingPageStatic(page: Page): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene: Landing Page Static");
    await page.goto(config.baseUrl, { waitUntil: "load", timeout: 30000 });
    console.log("  ⏸️  Holding landing page for 10 seconds (no interaction)...");
    await delay(HOLD_MS);

    const duration = Date.now() - startTime;
    console.log(
      `✅ Landing Page Static completed in ${(duration / 1000).toFixed(1)}s`,
    );
    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Landing Page Static scene failed:", error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
