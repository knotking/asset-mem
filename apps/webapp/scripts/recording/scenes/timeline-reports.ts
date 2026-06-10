import { Page } from "playwright";
import { config } from "../config";
import { SceneResult, delay, enhancedClick } from "../helpers";

async function openReportsTab(page: Page): Promise<void> {
  if (!page.url().includes("/checkpoints")) {
    const timelineTab = page.locator(config.selectors.propertyDetails.timelineTab).first();
    if (await timelineTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await timelineTab.click();
      await page.waitForURL("**/checkpoints**", { timeout: 10000 });
    } else {
      const propertyId = page.url().match(/\/properties\/([^/]+)/)?.[1];
      if (propertyId) {
        await page.goto(
          `${config.baseUrl}/home/properties/${propertyId}/checkpoints?tab=reports`,
          { waitUntil: "load", timeout: 30000 },
        );
      }
    }
  }

  const tabNav = page.locator('nav[aria-label="Timeline tabs"]').first();
  await tabNav.waitFor({ state: "visible", timeout: 10000 });

  const reportsTab = page
    .locator('nav[aria-label="Timeline tabs"] button')
    .filter({ hasText: /Reports/i })
    .first();

  if (await reportsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await reportsTab.click();
    await delay(1000);
    return;
  }

  const propertyId = page.url().match(/\/properties\/([^/]+)/)?.[1];
  if (propertyId) {
    await page.goto(
      `${config.baseUrl}/home/properties/${propertyId}/checkpoints?tab=reports`,
      { waitUntil: "load", timeout: 30000 },
    );
    await delay(1500);
  }
}

export async function recordTimelineReports(page: Page): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene: Timeline Reports");

    if (!page.url().includes("/properties/")) {
      throw new Error("Not on a property page");
    }

    console.log("  📋 Opening Reports tab...");
    await openReportsTab(page);
    console.log("  ✅ Reports tab active");

    await page
      .locator(
        'button:has-text("Create Report"), text=/No reports yet/i, [class*="CardTitle"]',
      )
      .first()
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});
    console.log("  ⏸️  Showing reports list for 4 seconds...");
    await delay(4000);

    console.log("  ➕ Opening Create Report wizard...");
    const createBtn = page.locator('button:has-text("Create Report")').first();
    if (!(await createBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log("  ⚠️  Create Report button not visible, ending scene");
      return { success: true, duration: Date.now() - startTime };
    }

    await enhancedClick(page, createBtn);
    await page
      .locator('[role="dialog"]:has-text("Pick the reason"), [role="dialog"]')
      .first()
      .waitFor({ state: "visible", timeout: 8000 });
    await delay(1000);

    const showingIntent = page.locator('button:has-text("Showing / listing")').first();
    if (await showingIntent.isVisible({ timeout: 3000 }).catch(() => false)) {
      await showingIntent.click();
      await delay(500);
    }

    const continueBtn = page.locator('[role="dialog"] button:has-text("Continue")').first();
    if (await continueBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click();
      await delay(2000);
      console.log("  ✅ Report wizard step 2");
    }

    const step2Continue = page.locator('[role="dialog"] button:has-text("Continue")').last();
    const step2Ready = await step2Continue
      .isEnabled({ timeout: 60000 })
      .catch(() => false);
    if (step2Ready) {
      await step2Continue.click();
      await delay(2000);
      console.log("  ✅ Report wizard step 3");
    } else {
      console.log("  ⚠️  Step 2 Continue disabled (checkpoints/dates); showing wizard only");
      await page.keyboard.press("Escape");
      await delay(1000);
      return { success: true, duration: Date.now() - startTime };
    }

    const previewLayout = page.locator('[role="dialog"] button:has-text("Preview layout")').first();
    if (await previewLayout.isVisible({ timeout: 5000 }).catch(() => false)) {
      await previewLayout.click();

      const previewDialog = page
        .locator('[role="dialog"]:has-text("Layout preview")')
        .last();
      await previewDialog.waitFor({ state: "visible", timeout: 30000 });

      const previewIframe = previewDialog.locator(
        'iframe[title="Report layout preview"]',
      );
      await previewIframe.waitFor({ state: "visible", timeout: 30000 });
      console.log("  ✅ Layout preview visible");

      console.log("  📜 Scrolling layout preview...");
      const previewFrame = page
        .frameLocator('[role="dialog"]:has-text("Layout preview") iframe')
        .last();
      const scrollSteps = 10;
      for (let step = 1; step <= scrollSteps; step++) {
        await previewFrame.locator("body").evaluate((_, ratio) => {
          const maxScroll =
            document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo(0, maxScroll * ratio);
        }, step / scrollSteps);
        await delay(80);
      }

      await delay(1000);

      await page.keyboard.press("Escape");
      await delay(500);
      console.log("  ✅ Closed layout preview");
    }

    const wizardDialog = page
      .locator('[role="dialog"]')
      .filter({ has: page.locator('button:has-text("Preview layout")') })
      .first();
    const createReportBtn = wizardDialog
      .locator('button:has-text("Create Report")')
      .last();

    if (await createReportBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("  🔘 Clicking Create Report...");
      await createReportBtn.click();
      console.log("  ⏸️  Waiting 10 seconds after Create Report...");
      await delay(10000);
    } else {
      console.log("  ⚠️  Create Report button not found in wizard");
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Timeline Reports scene completed in ${(duration / 1000).toFixed(1)}s`);
    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Timeline Reports scene failed:", error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
