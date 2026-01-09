import { Page } from "playwright";
import { config } from "../config";
import { SceneResult } from "../helpers";
import {
  scrollSmoothly,
  scrollPage,
  hoverAndWait,
  delay,
  clickWithRetry,
} from "../helpers";

export async function recordLandingPage(page: Page): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene 1: Landing Page");

    // Navigate to landing page
    await page.goto(config.baseUrl, { waitUntil: "networkidle" });
    await delay(1000); // Wait for page to settle

    // Wait a moment on hero section to show the main content
    console.log("  📜 Showing hero section...");
    await delay(2000);

    // Click on "Use Cases" navigation link
    console.log("  🔘 Clicking on Use Cases navigation link...");
    try {
      const useCasesLink = page.locator('a[href="#use-cases"]').first();
      await useCasesLink.waitFor({ state: "visible", timeout: 5000 });
      await useCasesLink.hover();
      await delay(500);
      await useCasesLink.click();
      await delay(2000); // Wait for smooth scroll to complete
      
      // Wait at Use Cases section
      await page.waitForSelector("#use-cases", { timeout: 3000 }).catch(() => {});
      console.log("  ⏸️  Showing Use Cases section...");
      await delay(3000);
    } catch (error) {
      console.log("  ⚠️  Could not click Use Cases link, using fallback scroll...");
      await scrollSmoothly(page, "#use-cases");
      await delay(3000);
    }

    // Click on "Features" navigation link
    console.log("  🔘 Clicking on Features navigation link...");
    try {
      const featuresLink = page.locator('a[href="#features"]').first();
      await featuresLink.waitFor({ state: "visible", timeout: 5000 });
      await featuresLink.hover();
      await delay(500);
      await featuresLink.click();
      await delay(2000); // Wait for smooth scroll to complete
      
      // Wait at Features section
      await page.waitForSelector("#features", { timeout: 3000 }).catch(() => {});
      console.log("  ⏸️  Showing Features section...");
      await delay(3000);
    } catch (error) {
      console.log("  ⚠️  Could not click Features link, using fallback scroll...");
      await scrollSmoothly(page, "#features");
      await delay(3000);
    }

    // Click on "AI Agents" navigation link
    console.log("  🔘 Clicking on AI Agents navigation link...");
    try {
      const aiAgentsLink = page.locator('a[href="#ai-agents"]').first();
      await aiAgentsLink.waitFor({ state: "visible", timeout: 5000 });
      await aiAgentsLink.hover();
      await delay(500);
      await aiAgentsLink.click();
      await delay(2000); // Wait for smooth scroll to complete
      
      // Wait at AI Agents section
      await page.waitForSelector("#ai-agents", { timeout: 3000 }).catch(() => {});
      console.log("  ⏸️  Showing AI Agents section...");
      await delay(3000);
    } catch (error) {
      console.log("  ⚠️  Could not click AI Agents link, using fallback scroll...");
      await scrollSmoothly(page, "#ai-agents");
      await delay(3000);
    }

    // Click on "Timeline" navigation link
    console.log("  🔘 Clicking on Timeline navigation link...");
    try {
      const timelineLink = page.locator('a[href="#timeline-feature"]').first();
      await timelineLink.waitFor({ state: "visible", timeout: 5000 });
      await timelineLink.hover();
      await delay(500);
      await timelineLink.click();
      await delay(2000); // Wait for smooth scroll to complete
      
      // Wait at Timeline section
      await page.waitForSelector("#timeline-feature", { timeout: 3000 }).catch(() => {});
      console.log("  ⏸️  Showing Timeline section...");
      await delay(3000);
    } catch (error) {
      console.log("  ⚠️  Could not click Timeline link, using fallback scroll...");
      await scrollSmoothly(page, "#timeline-feature");
      await delay(3000);
    }

    // Click on "How It Works" navigation link
    console.log("  🔘 Clicking on How It Works navigation link...");
    try {
      const howItWorksLink = page.locator('a[href="#how-it-works"]').first();
      await howItWorksLink.waitFor({ state: "visible", timeout: 5000 });
      await howItWorksLink.hover();
      await delay(500);
      await howItWorksLink.click();
      await delay(2000); // Wait for smooth scroll to complete
      
      // Wait at How It Works section
      await page.waitForSelector("#how-it-works", { timeout: 3000 }).catch(() => {});
      console.log("  ⏸️  Showing How It Works section...");
      await delay(3000);
    } catch (error) {
      console.log("  ⚠️  Could not click How It Works link, using fallback scroll...");
      await scrollSmoothly(page, "#how-it-works");
      await delay(3000);
    }

    // Scroll down slightly to show CTA section (after How It Works)
    console.log("  📜 Scrolling to CTA section...");
    await scrollPage(page, "down", 600);
    await delay(2000);

    // Final wait to show CTA section clearly
    console.log("  ⏸️  Showing CTA section...");
    await delay(3000);

    // Scroll back up to top to prepare for button click
    console.log("  📜 Scrolling back to top...");
    try {
      const homeLink = page.locator('a[href="#"], text="Home"').first();
      await homeLink.waitFor({ state: "visible", timeout: 3000 });
      await homeLink.hover();
      await delay(500);
      await homeLink.click();
      await delay(2000);
    } catch (error) {
      // Fallback to smooth scroll
      await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      await delay(2000);
    }

    // Click on "Sign In" button (or "Dashboard" if logged in)
    console.log("  🔘 Clicking on Sign In button...");
    let clicked = false;

    // Try to find and click "Sign In" button (or "Dashboard" if user is logged in)
    const signInSelectors = [
      'text="Sign In"',
      'text="Sign in"',
      'a[href="/login"]',
      'a[href*="/login"]',
      'button:has-text("Sign In")',
      'button:has-text("Sign in")',
      // Also check for Dashboard button (in case user is logged in)
      'text="Dashboard"',
      'a[href="/home"]',
      'a[href*="/home"]',
      config.selectors.landing.loginButton,
      config.selectors.landing.getStartedButton,
    ];

    for (const selector of signInSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 3000 })) {
          console.log(`  🖱️  Found button with selector: ${selector}`);
          await button.hover();
          await delay(500);
          // Click the button (clickWithRetry will handle retries if needed)
          await button.click();
          clicked = true;
          console.log("  ✅ Clicked Sign In/Dashboard button");
          break;
        }
      } catch (error) {
        // Try using clickWithRetry as fallback
        try {
          const success = await clickWithRetry(page, selector, 2, 3000);
          if (success) {
            clicked = true;
            console.log(
              `  ✅ Clicked Sign In/Dashboard button using retry (${selector})`
            );
            break;
          }
        } catch (retryError) {
          continue;
        }
      }
    }

    if (!clicked) {
      console.log(
        "  ⚠️  Could not find Sign In/Dashboard button, trying alternative approach..."
      );
      // Try using the configured selectors
      try {
        const loginButton = page
          .locator(config.selectors.landing.loginButton)
          .first();
        const getStartedButton = page
          .locator(config.selectors.landing.getStartedButton)
          .first();

        if (await loginButton.isVisible({ timeout: 2000 })) {
          await loginButton.click();
          clicked = true;
          console.log("  ✅ Clicked Sign In button");
        } else if (await getStartedButton.isVisible({ timeout: 2000 })) {
          await getStartedButton.click();
          clicked = true;
          console.log("  ✅ Clicked Get Started button");
        }
      } catch (error) {
        console.log("  ⚠️  Could not click button, continuing...");
      }
    }

    // If we clicked, wait for navigation to login page or dashboard
    if (clicked) {
      console.log("  ⏳ Waiting for navigation...");
      try {
        // Wait for either login or home page
        await Promise.race([
          page.waitForURL("**/login**", { timeout: 5000 }),
          page.waitForURL("**/home**", { timeout: 5000 }),
        ]).catch(() => {});
        await page.waitForLoadState("networkidle");
        await delay(1000);
      } catch (error) {
        console.log("  ⚠️  Navigation timeout, continuing...");
      }
    }

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
