import { Page } from "playwright";
import { config } from "../config";
import { SceneResult, delay } from "../helpers";
import { getLandingHeroNarration } from "../landing-narration";

const HOLD_MS = 10_000;

/** Landing page hero hold — no scroll, clicks, or navigation. */
export async function recordLandingPageStatic(page: Page): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene: Landing Page Static");
    await page.goto(config.baseUrl, { waitUntil: "load", timeout: 30000 });
    await page
      .getByText("Timeline Intelligence", { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});
    console.log("  ⏸️  Holding landing hero for 10 seconds (no interaction)...");
    await delay(HOLD_MS);

    const duration = Date.now() - startTime;
    const narration = getLandingHeroNarration();
    console.log(
      `✅ Landing Page Static completed in ${(duration / 1000).toFixed(1)}s`,
    );
    return {
      success: true,
      duration,
      narrationSections: [
        {
          id: "hero",
          label: "Hero",
          narration,
          startOffsetMs: 0,
          endOffsetMs: duration,
        },
      ],
    };
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
