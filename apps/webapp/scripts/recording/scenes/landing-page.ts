import { Page } from "playwright";
import { config } from "../config";
import { SceneResult } from "../helpers";
import { scrollSmoothly, scrollPage, delay } from "../helpers";
import { createLandingSectionTracker } from "../landing-narration";

/** ~20s landing scene — tight gaps and short holds per section. */
const GAP_BETWEEN_CLICKS_MS = 600;
const SECTION_VIEW_DELAY_MS = 1200;
const AI_PIPELINE_VIEW_DELAY_MS = 1200;
const ENTERPRISE_VIEW_DELAY_MS = 1200;

async function panUseCaseCards(page: Page): Promise<void> {
  const cards = page.locator("#use-cases .grid > div");
  const count = await cards.count();
  if (count <= 2) {
    await delay(SECTION_VIEW_DELAY_MS);
    return;
  }

  console.log(`  📜 Panning through ${count} use case cards...`);

  // 2-col grid: show a mid-row card so the section reads in a short clip
  const scrollTargets = [Math.min(2, count - 1)].filter(
    (index, i, arr) => arr.indexOf(index) === i,
  );
  await delay(200);
  for (const index of scrollTargets) {
    try {
      console.log(`  📜 Scrolling to use case card ${index + 1}/${count}...`);
      await cards.nth(index).scrollIntoViewIfNeeded({ timeout: 3000 });
      await delay(300);
    } catch {
      await scrollPage(page, "down", 280);
      await delay(400);
    }
  }
}

export async function recordLandingPage(page: Page): Promise<SceneResult> {
  const startTime = Date.now();
  const tracker = createLandingSectionTracker(startTime);
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

  async function showSectionByScroll(
    sectionId: string,
    label: string,
    viewDelayMs = SECTION_VIEW_DELAY_MS,
  ): Promise<void> {
    await waitForClickGap();
    console.log(`  📜 Scrolling to ${label} section...`);
    await scrollSmoothly(page, sectionId);
    await delay(800);
    console.log(`  ⏸️  Showing ${label} section...`);
    await delay(viewDelayMs);
    lastClickAt = Date.now();
    await waitForClickGap();
  }

  try {
    console.log("🎬 Scene 1: Landing Page");
    console.log(`  ⏱️  ${GAP_BETWEEN_CLICKS_MS / 1000}s gap between clicks`);

    tracker.start("hero");
    await page.goto(config.baseUrl, { waitUntil: "networkidle" });
    await delay(600);
    console.log("  📜 Showing hero section...");
    await delay(1400);
    tracker.end();

    // Page order: hero → how-it-works → ai-pipeline → use-cases → enterprise → pricing → footer
    tracker.start("how-it-works");
    await clickNavAnchor("#how-it-works", "#how-it-works", "How It Works");
    tracker.end();

    tracker.start("ai-pipeline");
    await showSectionByScroll(
      "#ai-pipeline",
      "AI Intelligence",
      AI_PIPELINE_VIEW_DELAY_MS,
    );
    tracker.end();

    tracker.start("use-cases");
    await clickNavAnchor("#use-cases", "#use-cases", "Use Cases", {
      afterShow: panUseCaseCards,
    });
    tracker.end();

    tracker.start("enterprise");
    await clickNavAnchor("#enterprise", "#enterprise", "Enterprise", {
      viewDelayMs: ENTERPRISE_VIEW_DELAY_MS,
    });
    tracker.end();

    tracker.start("pricing");
    await clickNavAnchor("#pricing", "#pricing", "Pricing", {
      viewDelayMs: SECTION_VIEW_DELAY_MS,
    });
    tracker.end();

    tracker.start("footer");
    console.log("  📜 Scrolling to footer...");
    await scrollPage(page, "down", 500);
    await delay(500);
    console.log("  ⏸️  Showing footer...");
    await delay(SECTION_VIEW_DELAY_MS);
    await waitForClickGap();
    tracker.end();

    const duration = Date.now() - startTime;
    const narrationSections = tracker.finalize();
    console.log(`✅ Scene 1 completed in ${(duration / 1000).toFixed(1)}s`);
    for (const section of narrationSections) {
      console.log(
        `  🎙️  ${section.label}: ${(section.startOffsetMs / 1000).toFixed(1)}s–${(section.endOffsetMs / 1000).toFixed(1)}s`,
      );
    }

    return {
      success: true,
      duration,
      narrationSections,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Scene 1 failed:", error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
      narrationSections: tracker.finalize(),
    };
  }
}
