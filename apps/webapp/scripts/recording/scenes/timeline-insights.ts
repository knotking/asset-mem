import { Page } from "playwright";
import { config } from "../config";
import { SceneResult } from "../helpers";
import {
  delay,
  clickWithRetry,
  waitForVisible,
} from "../helpers";

export async function recordTimelineInsights(page: Page): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene: Timeline Insights");

    // Ensure we're on a property page
    if (!page.url().includes("/properties/")) {
      throw new Error("Not on a property page");
    }

    // Navigate to timeline/checkpoints tab if not already there
    console.log("  🔘 Navigating to Timeline tab...");
    if (!page.url().includes("/checkpoints")) {
      try {
        const timelineTab = page
          .locator(config.selectors.propertyDetails.timelineTab)
          .first();
        if (await timelineTab.isVisible({ timeout: 5000 })) {
          await timelineTab.click();
          await page.waitForURL("**/checkpoints**", { timeout: 5000 });
        } else {
          // Try navigating directly
          const currentUrl = page.url();
          const propertyId = currentUrl.match(/\/properties\/([^\/]+)/)?.[1];
          if (propertyId) {
            await page.goto(
              `${config.baseUrl}/home/properties/${propertyId}/checkpoints`,
              {
                waitUntil: "load",
                timeout: 30000,
              }
            );
          }
        }
      } catch (error) {
        console.log("  ⚠️  Could not navigate to timeline tab, continuing...");
      }
    }

    // Wait for timeline page to load
    console.log("  ⏳ Waiting for Timeline page to load...");
    try {
      // Wait for tab navigation to be visible
      const tabNav = page.locator('nav[aria-label="Timeline tabs"]').first();
      await tabNav.waitFor({ state: "visible", timeout: 10000 });
      await delay(1000);
      console.log("  ✅ Timeline page loaded");
    } catch (error) {
      console.log(`  ⚠️  Timeline page wait timeout: ${error instanceof Error ? error.message : String(error)}`);
      await delay(2000);
    }

    // Click on Insights tab
    console.log("  📊 Clicking on Insights tab...");
    try {
      // Find the Insights tab button - it has text "Insights" and TrendingUp icon
      const insightsTab = page
        .locator('button:has-text("Insights"), button:has([class*="TrendingUp"])')
        .first();
      
      if (await insightsTab.isVisible({ timeout: 5000 })) {
        await insightsTab.scrollIntoViewIfNeeded();
        await delay(300);
        await insightsTab.hover({ timeout: 1000 }).catch(() => {});
        await delay(300);
        await insightsTab.click();
        await delay(1000); // Wait for tab switch animation
        console.log("  ✅ Insights tab clicked");
      } else {
        // Try alternative selector - button that sets activeTab to 'insights'
        const insightsTabAlt = page
          .locator('nav[aria-label="Timeline tabs"] button')
          .filter({ hasText: /Insights/i })
          .first();
        
        if (await insightsTabAlt.isVisible({ timeout: 5000 })) {
          await insightsTabAlt.scrollIntoViewIfNeeded();
          await delay(300);
          await insightsTabAlt.hover({ timeout: 1000 }).catch(() => {});
          await delay(300);
          await insightsTabAlt.click();
          await delay(1000);
          console.log("  ✅ Insights tab clicked (alternative selector)");
        } else {
          throw new Error("Could not find Insights tab button");
        }
      }
    } catch (error) {
      console.log(
        `  ⚠️  Could not click Insights tab: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }

    // Wait for Insights content to load
    console.log("  ⏳ Waiting for Insights content to load...");
    try {
      // Wait for MetricsDashboard component to be visible
      // It should contain metrics or dashboard content
      const insightsContent = page
        .locator('[class*="MetricsDashboard"], [class*="metrics"], h2:has-text("Timeline")')
        .first();
      
      await insightsContent.waitFor({ state: "visible", timeout: 10000 });
      await delay(2000); // Wait for content to fully render
      console.log("  ✅ Insights content loaded");
    } catch (error) {
      console.log(
        `  ⚠️  Insights content wait timeout, continuing anyway: ${error instanceof Error ? error.message : String(error)}`
      );
      await delay(2000);
    }

    // Show results for 10 seconds
    console.log("  ⏸️  Showing Insights results for 10 seconds...");
    await delay(10000);

    const duration = Date.now() - startTime;
    console.log(`✅ Timeline Insights scene completed in ${(duration / 1000).toFixed(1)}s`);

    return {
      success: true,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Timeline Insights scene failed:", error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
