import { Page, BrowserContext } from "playwright";
import { config } from "../config";
import { SceneResult } from "../helpers";
import { saveSession, delay, clickWithRetry, fillWithRetry } from "../helpers";

export async function recordLogin(
  page: Page,
  context: BrowserContext
): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene 2: Login");

    // Navigate to login page
    await page.goto(`${config.baseUrl}/login`, { waitUntil: "networkidle" });
    await delay(1000);

    // Fill in email
    console.log("  ✍️  Filling email...");
    await fillWithRetry(page, config.selectors.login.emailInput, config.email);
    await delay(500);

    // Fill in password
    console.log("  ✍️  Filling password...");
    await fillWithRetry(
      page,
      config.selectors.login.passwordInput,
      config.password
    );
    await delay(500);

    // Click submit button
    console.log("  🔘 Clicking submit...");
    await clickWithRetry(page, config.selectors.login.submitButton);

    // Wait for navigation to /home
    console.log("  ⏳ Waiting for redirect...");
    await page.waitForURL("**/home**", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Set theme to dark after login, before property selection
    console.log("  🌙 Checking current theme...");

    // First check if theme is already dark
    const isAlreadyDark = await page.evaluate(() => {
      // Check if dark class is on html element
      const hasDarkClass = document.documentElement.classList.contains("dark");
      // Check localStorage
      const storedTheme = localStorage.getItem("theme");
      // Check if system prefers dark (if theme is set to system)
      const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

      return (
        hasDarkClass ||
        storedTheme === "dark" ||
        (storedTheme === "system" && systemPrefersDark)
      );
    });

    if (isAlreadyDark) {
      console.log("  ✅ Theme is already dark, no need to change");
    } else {
      console.log("  🌙 Setting theme to dark...");

      // Try clicking the theme toggle button first (most reliable with next-themes)
      let themeSet = false;
      try {
        // Wait a moment for the page to fully load
        await delay(1000);

        // Look for theme toggle button in the header
        // The ThemeToggle component has a button with Sun/Moon icons
        const themeToggleSelectors = [
          'button:has([class*="Moon"]):not([class*="Sun"])', // Moon icon (dark mode indicator)
          'button:has([class*="Sun"])', // Sun icon (light mode indicator)
          'button[aria-label*="theme" i]',
          'button[aria-label*="Toggle theme"]',
        ];

        for (const selector of themeToggleSelectors) {
          try {
            const themeToggleButton = page.locator(selector).first();
            if (await themeToggleButton.isVisible({ timeout: 3000 })) {
              console.log(
                `  🔘 Found theme toggle button with selector: ${selector}`
              );
              await themeToggleButton.click();
              await delay(400); // Wait for dropdown to open

              // Look for "Dark" option in the dropdown menu
              const darkOption = page.locator('text="Dark"').first();
              if (await darkOption.isVisible({ timeout: 2000 })) {
                await darkOption.click();
                await delay(600); // Wait for theme to apply
                themeSet = true;
                console.log("  ✅ Theme set to dark via toggle button");
                break;
              } else {
                // If "Dark" option not found, close dropdown and try next selector
                await page.keyboard.press("Escape");
                await delay(200);
              }
            }
          } catch (error) {
            continue;
          }
        }
      } catch (toggleError) {
        console.log(
          `  ⚠️  Could not set theme via toggle button: ${toggleError instanceof Error ? toggleError.message : String(toggleError)}`
        );
      }

      // Fallback: Set theme programmatically via localStorage and DOM manipulation
      if (!themeSet) {
        try {
          console.log("  🔄 Trying programmatic theme setting...");
          await page.evaluate(() => {
            // next-themes stores theme in localStorage with key 'theme'
            localStorage.setItem("theme", "dark");

            // Add 'dark' class to html element (next-themes uses attribute="class")
            document.documentElement.classList.add("dark");
            document.documentElement.setAttribute("data-theme", "dark");

            // Trigger a custom event that might be listened to
            window.dispatchEvent(new Event("storage"));
          });

          // Wait for theme to apply
          await delay(800);

          // Verify theme was set by checking if dark class is present
          const hasDarkClass = await page.evaluate(() => {
            return document.documentElement.classList.contains("dark");
          });

          if (hasDarkClass) {
            themeSet = true;
            console.log("  ✅ Theme set to dark programmatically");
          } else {
            console.log("  ⚠️  Theme may not have been applied correctly");
          }
        } catch (error) {
          console.log(
            `  ⚠️  Programmatic theme setting failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    } // End of else block for theme setting

    // Save session (user is already authenticated)
    await saveSession(context);

    const duration = Date.now() - startTime;
    console.log(`✅ Scene 2 completed in ${(duration / 1000).toFixed(1)}s`);

    return {
      success: true,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Scene 2 failed:", error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
