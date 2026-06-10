import { Page } from "playwright";
import { config } from "../config";
import { SceneResult } from "../helpers";
import { scrollSmoothly, scrollPage, delay } from "../helpers";

/** Time between each nav / CTA click in the landing scene (and zoom trigger spacing). */
const GAP_BETWEEN_CLICKS_MS =
  (config.zoomEffects?.minGapBetweenZoomsSec ?? 3) * 1000;

/** Extra pause while each section is on screen (from Use Cases onward). */
const SECTION_VIEW_DELAY_MS = 4000;
const AI_AGENTS_EXTRA_DELAY_MS = 2000;
const TIMELINE_EXTRA_DELAY_MS = 1000;

async function panReportTypeCards(page: Page): Promise<void> {
  const cards = page.locator("#reports .grid > div");
  const count = await cards.count();
  if (count === 0) {
    await delay(SECTION_VIEW_DELAY_MS);
    return;
  }
  console.log(`  📜 Panning through ${count} report type cards...`);
  for (let i = 0; i < count; i++) {
    try {
      await cards.nth(i).scrollIntoViewIfNeeded({ timeout: 3000 });
      await delay(800);
    } catch {
      await scrollPage(page, "down", 300);
      await delay(600);
    }
  }
}

async function panUseCaseCards(page: Page): Promise<void> {
  const cards = page.locator("#use-cases .grid > div");
  const count = await cards.count();
  if (count <= 2) {
    await delay(SECTION_VIEW_DELAY_MS);
    return;
  }

  console.log(`  📜 Panning through ${count} use case cards...`);

  // 2-col grid: index 2 = row 2, then mid/bottom rows so all cards appear in recording
  const scrollTargets = [2, Math.min(4, count - 1), count - 1].filter(
    (index, i, arr) => arr.indexOf(index) === i,
  );
  await delay(500);
  for (const index of scrollTargets) {
    try {
      console.log(`  📜 Scrolling to use case card ${index + 1}/${count}...`);
      await cards.nth(index).scrollIntoViewIfNeeded({ timeout: 3000 });
      await delay(500);
    } catch {
      await scrollPage(page, "down", 350);
      await delay(1000);
    }
  }
}

export async function recordLandingPage(page: Page): Promise<SceneResult> {
  const startTime = Date.now();
  let lastClickAt = 0;

  async function waitForClickGap(): Promise<void> {
    if (lastClickAt === 0) return;
    const elapsed = Date.now() - lastClickAt;
    if (elapsed < GAP_BETWEEN_CLICKS_MS) {
      await delay(GAP_BETWEEN_CLICKS_MS - elapsed);
    }
  }

  async function clickNavAnchor(
    href: string,
    sectionId: string,
    label: string,
    options?: {
      afterShow?: (page: Page) => Promise<void>;
      viewDelayMs?: number;
    },
  ): Promise<void> {
    await waitForClickGap();
    console.log(`  🔘 Clicking on ${label} navigation link...`);
    try {
      const link = page.locator(`a[href="${href}"]`).first();
      await link.waitFor({ state: "visible", timeout: 5000 });
      await link.hover();
      await delay(200);
      await link.click();
      lastClickAt = Date.now();
      await delay(800); // smooth scroll

      await page.waitForSelector(sectionId, { timeout: 3000 }).catch(() => {});
      console.log(`  ⏸️  Showing ${label} section...`);
      if (options?.afterShow) {
        await options.afterShow(page);
      } else {
        await delay(options?.viewDelayMs ?? SECTION_VIEW_DELAY_MS);
      }
      await waitForClickGap();
    } catch (error) {
      console.log(
        `  ⚠️  Could not click ${label} link, using fallback scroll...`,
      );
      await scrollSmoothly(page, sectionId);
      lastClickAt = Date.now();
      if (options?.afterShow) {
        await options.afterShow(page);
      } else {
        await delay(options?.viewDelayMs ?? SECTION_VIEW_DELAY_MS);
      }
      await waitForClickGap();
    }
  }

  try {
    console.log("🎬 Scene 1: Landing Page");
    console.log(`  ⏱️  ${GAP_BETWEEN_CLICKS_MS / 1000}s gap between clicks`);

    await page.goto(config.baseUrl, { waitUntil: "networkidle" });
    await delay(1000);

    console.log("  📜 Showing hero section...");
    await delay(2000);

    await clickNavAnchor("#use-cases", "#use-cases", "Use Cases", {
      afterShow: panUseCaseCards,
    });
    await clickNavAnchor("#features", "#features", "Features");
    await clickNavAnchor("#reports", "#reports", "Reports", {
      afterShow: panReportTypeCards,
    });
    await clickNavAnchor("#ai-agents", "#ai-agents", "AI Agents", {
      viewDelayMs: SECTION_VIEW_DELAY_MS + AI_AGENTS_EXTRA_DELAY_MS,
    });
    await clickNavAnchor("#timeline-feature", "#timeline-feature", "Timeline", {
      viewDelayMs: SECTION_VIEW_DELAY_MS + TIMELINE_EXTRA_DELAY_MS,
    });

    console.log("  📜 Scrolling to Docs Chat showcase...");
    await scrollSmoothly(page, "#docs-chat");
    await delay(800);
    console.log("  ⏸️  Showing Docs Chat section...");
    await delay(SECTION_VIEW_DELAY_MS);
    await waitForClickGap();

    await clickNavAnchor("#how-it-works", "#how-it-works", "How It Works");
    await clickNavAnchor("#pricing", "#pricing", "Pricing", {
      viewDelayMs: SECTION_VIEW_DELAY_MS + 1000,
    });

    console.log("  📜 Scrolling to CTA section...");
    await scrollPage(page, "down", 600);
    await delay(1000);
    console.log("  ⏸️  Showing CTA section...");
    await delay(SECTION_VIEW_DELAY_MS);
    await waitForClickGap();

    const duration = Date.now() - startTime;
    console.log(`✅ Scene 1 completed in ${(duration / 1000).toFixed(1)}s`);

    return {
      success: true,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Scene 1 failed:", error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
