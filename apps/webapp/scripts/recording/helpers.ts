import { Page, BrowserContext } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { config } from "./config";

export interface NarrationSectionTiming {
  id: string;
  label: string;
  narration: string;
  startOffsetMs: number;
  endOffsetMs: number;
}

export interface SceneResult {
  success: boolean;
  duration: number;
  error?: string;
  /** Optional wait segment to cut from video (offsets in ms from scene start). */
  waitCut?: { startOffsetMs: number; endOffsetMs: number };
  /** Optional multiple wait segments to cut from video (offsets in ms from scene start). */
  waitCuts?: Array<{ startOffsetMs: number; endOffsetMs: number }>;
  /** Per-section avatar narration aligned to on-screen moments (e.g. landing page). */
  narrationSections?: NarrationSectionTiming[];
}

/**
 * Authenticate user and save session state
 */
export async function authenticate(
  page: Page,
  context: BrowserContext
): Promise<boolean> {
  try {
    console.log("🔐 Authenticating...");

    // Navigate to login page
    await page.goto(`${config.baseUrl}/login`, { waitUntil: "networkidle" });
    await page.waitForSelector(config.selectors.login.emailInput, {
      timeout: 10000,
    });

    // Fill in credentials
    await page.fill(config.selectors.login.emailInput, config.email);
    await page.fill(config.selectors.login.passwordInput, config.password);

    // Submit form
    await page.click(config.selectors.login.submitButton);

    // Wait for navigation to /home
    await page.waitForURL("**/home**", { timeout: 15000 });

    // Wait a bit for the page to fully load
    await page.waitForLoadState("networkidle");

    // Save session state
    await saveSession(context);

    console.log("✅ Authentication successful");
    return true;
  } catch (error) {
    console.error("❌ Authentication failed:", error);
    return false;
  }
}

/**
 * Load saved session state
 */
export async function loadSession(context: BrowserContext): Promise<boolean> {
  try {
    const sessionPath = config.sessionStoragePath;

    if (!fs.existsSync(sessionPath)) {
      console.log("📝 No saved session found, will authenticate");
      return false;
    }

    const sessionData = fs.readFileSync(sessionPath, "utf-8");
    const session = JSON.parse(sessionData);

    // Restore cookies and storage
    await context.addCookies(session.cookies);
    await context.addInitScript((storage) => {
      if (storage.localStorage) {
        for (const [key, value] of Object.entries(storage.localStorage)) {
          window.localStorage.setItem(key, value as string);
        }
      }
      if (storage.sessionStorage) {
        for (const [key, value] of Object.entries(storage.sessionStorage)) {
          window.sessionStorage.setItem(key, value as string);
        }
      }
    }, session.storage);

    console.log("✅ Session loaded");
    return true;
  } catch (error) {
    console.error("⚠️  Failed to load session:", error);
    return false;
  }
}

/**
 * Save browser context state
 */
export async function saveSession(context: BrowserContext): Promise<void> {
  try {
    const sessionPath = config.sessionStoragePath;
    const sessionDir = path.dirname(sessionPath);

    // Ensure directory exists
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const cookies = await context.cookies();
    const pages = context.pages();
    const page = pages[0] || (await context.newPage());

    // Get storage state
    const storage = await page.evaluate(() => {
      return {
        localStorage: { ...window.localStorage },
        sessionStorage: { ...window.sessionStorage },
      };
    });

    const sessionData = {
      cookies,
      storage,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
    console.log("💾 Session saved");
  } catch (error) {
    console.error("⚠️  Failed to save session:", error);
  }
}

/**
 * Wait for navigation with timeout
 */
export async function waitForNavigation(
  page: Page,
  urlPattern: string | RegExp,
  timeout: number = config.timing.navigationWait
): Promise<boolean> {
  try {
    await page.waitForURL(urlPattern, { timeout });
    return true;
  } catch (error) {
    console.warn(`⚠️  Navigation timeout for pattern: ${urlPattern}`);
    return false;
  }
}

/**
 * Smooth scroll to element
 */
export async function scrollSmoothly(
  page: Page,
  selector: string,
  options: { behavior?: "smooth" | "auto" } = {}
): Promise<void> {
  await page.evaluate(
    ({ selector, behavior }) => {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView({
          behavior: behavior || "smooth",
          block: "center",
        });
      }
    },
    { selector, behavior: options.behavior || "smooth" }
  );
  await page.waitForTimeout(config.timing.scrollDelay);
}

/**
 * Scroll page smoothly
 */
export async function scrollPage(
  page: Page,
  direction: "down" | "up" = "down",
  distance: number = 500
): Promise<void> {
  await page.evaluate(
    ({ direction, distance }) => {
      window.scrollBy({
        top: direction === "down" ? distance : -distance,
        left: 0,
        behavior: "smooth",
      });
    },
    { direction, distance }
  );
  await page.waitForTimeout(config.timing.scrollDelay);
}

/**
 * Hover over element and wait
 */
export async function hoverAndWait(
  page: Page,
  selector: string,
  waitTime: number = config.timing.hoverDelay
): Promise<void> {
  try {
    await page.hover(selector);
    await page.waitForTimeout(waitTime);
  } catch (error) {
    console.warn(`⚠️  Could not hover over: ${selector}`);
  }
}

/**
 * Wait for element with multiple selector attempts
 */
export async function waitForSelectorWithFallback(
  page: Page,
  selectors: string[],
  timeout: number = 10000
): Promise<boolean> {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      continue;
    }
  }
  return false;
}

/**
 * Take screenshot
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  fullPage: boolean = false
): Promise<string> {
  const screenshotDir = path.join(config.outputDir, "screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const screenshotPath = path.join(screenshotDir, `${name}-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);
  return screenshotPath;
}

/**
 * Wait for a delay
 */
export async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Click with retry - Enhanced for demo with hover before click and delay after
 */
export async function clickWithRetry(
  page: Page,
  selector: string,
  retries: number = 3,
  timeout: number = 5000
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const element = page.locator(selector).first();
      await element.waitFor({ state: "visible", timeout });

      // Scroll element into view for better visibility
      await element.scrollIntoViewIfNeeded();
      await delay(200);

      // Hover before click for better UX visibility in demo
      try {
        await element.hover({ timeout: 1000 });
        await delay(300); // Brief pause to show hover state
      } catch (error) {
        // If hover fails, continue to click anyway
      }

      // Perform the click
      await element.click({ delay: 50 }); // Small delay before click for visibility

      // Add delay after click to show result (important for demo)
      await delay(400);

      return true;
    } catch (error) {
      if (i === retries - 1) {
        console.warn(
          `⚠️  Failed to click after ${retries} attempts: ${selector}`
        );
        return false;
      }
      await delay(1000);
    }
  }
  return false;
}

/**
 * Enhanced click function for demo - includes hover, delay, and visual feedback
 * Use this for better UX visibility in recordings
 * Can be used with a locator or selector string
 */
export async function enhancedClick(
  page: Page,
  elementOrSelector: any | string,
  options: {
    hoverDelay?: number;
    clickDelay?: number;
    afterClickDelay?: number;
  } = {}
): Promise<void> {
  const hoverDelay = options.hoverDelay ?? 300;
  const clickDelay = options.clickDelay ?? 50;
  const afterClickDelay = options.afterClickDelay ?? 400;

  try {
    // Get locator from selector string or use provided locator
    const element =
      typeof elementOrSelector === "string"
        ? page.locator(elementOrSelector).first()
        : elementOrSelector;

    // Wait for element to be visible
    await element.waitFor({ state: "visible", timeout: 5000 });

    // Scroll element into view for better visibility
    await element.scrollIntoViewIfNeeded();
    await delay(200);

    // Hover before click for better UX visibility
    try {
      await element.hover({ timeout: 1000 });
      await delay(hoverDelay); // Pause to show hover state
    } catch (error) {
      // If hover fails, continue to click anyway
    }

    // Perform the click with a small delay
    await element.click({ delay: clickDelay });

    // Add delay after click to show result (important for demo)
    await delay(afterClickDelay);
  } catch (error) {
    // Re-throw to let caller handle
    throw error;
  }
}

/**
 * Fill input with retry
 */
export async function fillWithRetry(
  page: Page,
  selector: string,
  value: string,
  retries: number = 3,
  timeout: number = 5000
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      await page.waitForSelector(selector, { timeout });
      await page.fill(selector, value);
      // Add small delay after filling for better visibility
      await delay(300);
      return true;
    } catch (error) {
      if (i === retries - 1) {
        console.warn(
          `⚠️  Failed to fill after ${retries} attempts: ${selector}`
        );
        return false;
      }
      await delay(1000);
    }
  }
  return false;
}

/**
 * Wait for element to be visible
 */
export async function waitForVisible(
  page: Page,
  selector: string,
  timeout: number = 10000
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { state: "visible", timeout });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Type text with human-like delays
 */
export async function typeHumanLike(
  page: Page,
  selector: string,
  text: string,
  options: { delay?: number } = {}
): Promise<void> {
  const delay = options.delay || 50;
  await page.focus(selector);
  await page.fill(selector, ""); // Clear first

  for (const char of text) {
    await page.type(selector, char, { delay });
  }
}

/**
 * Scroll chat area to top (excluding sidebar)
 * Specifically targets ChatList ScrollArea component
 */
export async function scrollChatToTop(page: Page): Promise<void> {
  try {
    console.log("  🔍 Preparing to scroll chat area to top...");
    await delay(800);
    
    let scrollAttempted = false;
    let retries = 0;
    const maxRetries = 5;

    while (!scrollAttempted && retries < maxRetries) {
      await delay(200);
      
      const scrollResult = await page.evaluate(() => {
        let mainChatViewport: HTMLElement | null = null;

        // Strategy 1: Find ChatList ScrollArea specifically
        // ChatList has: <ScrollArea className="h-full w-full">
        //   -> <ScrollAreaPrimitive.Viewport> (data-radix-scroll-area-viewport)
        //     -> <div className="p-4 sm:p-6">
        //       -> <div className="flex flex-col gap-4">
        const scrollAreaRoots = document.querySelectorAll(
          '[data-radix-scroll-area-root]'
        );

        for (const root of Array.from(scrollAreaRoots)) {
          const rootElement = root as HTMLElement;
          const rootClasses = rootElement.classList?.toString() || "";
          
          // ChatList ScrollArea has "h-full w-full" classes
          const matchesChatListPattern = rootClasses.includes("h-full") && rootClasses.includes("w-full");
          
          if (matchesChatListPattern) {
            // Find the viewport inside this root
            const viewport = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            if (viewport) {
              // Check if it contains ChatList structure: div.p-4.sm:p-6 > div.flex.flex-col.gap-4
              const hasChatListStructure = viewport.querySelector(
                'div[class*="p-4"][class*="sm:p-6"] > div[class*="flex"][class*="flex-col"][class*="gap-4"]'
              ) || viewport.querySelector('div[class*="flex"][class*="flex-col"][class*="gap-4"]');
              
              // Also check for chat messages
              const hasChatMessages = viewport.querySelector(
                '[class*="ChatMessage"], [class*="chat-message"], [role="article"]'
              );
              
              if (hasChatListStructure || hasChatMessages) {
                // Verify not in sidebar
                let checkParent: HTMLElement | null = viewport;
                let foundAside = false;
                
                while (checkParent && checkParent !== document.body) {
                  const tagName = checkParent.tagName || "";
                  const classList = checkParent.classList?.toString() || "";
                  
                  if (tagName === "ASIDE" || 
                      classList.includes("sidebar") || 
                      classList.includes("session-sidebar") ||
                      checkParent.getAttribute('data-testid') === 'session-sidebar') {
                    foundAside = true;
                    break;
                  }
                  checkParent = checkParent.parentElement;
                }
                
                if (!foundAside) {
                  mainChatViewport = viewport;
                  console.log('Found ChatList ScrollArea viewport');
                  break;
                }
              }
            }
          }
        }

        // Strategy 2: Find by walking up from the chat list structure div
        if (!mainChatViewport) {
          const chatListDiv = document.querySelector('div[class*="flex"][class*="flex-col"][class*="gap-4"]');
          if (chatListDiv) {
            let parent: HTMLElement | null = chatListDiv.parentElement;
            let depth = 0;
            
            while (parent && depth < 10) {
              // Check if this is a ScrollArea viewport
              if (parent.getAttribute('data-radix-scroll-area-viewport')) {
                // Verify not in sidebar
                let checkParent: HTMLElement | null = parent;
                let foundAside = false;
                
                while (checkParent && checkParent !== document.body) {
                  const tagName = checkParent.tagName || "";
                  const classList = checkParent.classList?.toString() || "";
                  
                  if (tagName === "ASIDE" || 
                      classList.includes("sidebar") || 
                      classList.includes("session-sidebar")) {
                    foundAside = true;
                    break;
                  }
                  checkParent = checkParent.parentElement;
                }
                
                if (!foundAside) {
                  mainChatViewport = parent;
                  console.log('Found viewport by walking up from chat list div');
                  break;
                }
              }
              
              parent = parent.parentElement;
              depth++;
            }
          }
        }

        // Strategy 3: Find any ScrollArea viewport with chat messages (fallback)
        if (!mainChatViewport) {
          const allViewports = document.querySelectorAll(
            '[data-radix-scroll-area-viewport]'
          );

          for (const viewport of Array.from(allViewports)) {
            const element = viewport as HTMLElement;
            
            const hasChatListStructure = element.querySelector(
              'div[class*="flex"][class*="flex-col"][class*="gap-4"], div[class*="p-4"][class*="sm:p-6"]'
            );
            const hasChatMessages = element.querySelector(
              '[class*="ChatMessage"], [class*="chat-message"], [role="article"]'
            );
            
            if (hasChatListStructure || hasChatMessages) {
              let checkParent: HTMLElement | null = element;
              let foundAside = false;
              
              while (checkParent && checkParent !== document.body) {
                const tagName = checkParent.tagName || "";
                const classList = checkParent.classList?.toString() || "";
                
                if (tagName === "ASIDE" || 
                    classList.includes("sidebar") || 
                    classList.includes("session-sidebar")) {
                  foundAside = true;
                  break;
                }
                checkParent = checkParent.parentElement;
              }
              
              if (!foundAside) {
                mainChatViewport = element;
                console.log('Found viewport via fallback strategy');
                break;
              }
            }
          }
        }

        // Scroll to top smoothly if viewport found
        if (mainChatViewport) {
          const currentScroll = mainChatViewport.scrollTop;
          console.log(`Current scroll position: ${currentScroll}`);
          
          if (currentScroll > 10) {
            const scrollDistance = currentScroll;
            const scrollSteps = 25;
            const stepSize = Math.max(30, scrollDistance / scrollSteps);
            let scrollPosition = currentScroll;
            let step = 0;

            const scrollInterval = setInterval(() => {
              step++;
              scrollPosition = Math.max(0, scrollPosition - stepSize);
              mainChatViewport!.scrollTop = scrollPosition;

              if (step >= scrollSteps || scrollPosition <= 5) {
                mainChatViewport!.scrollTop = 0;
                clearInterval(scrollInterval);
                console.log('Scroll to top completed');
              }
            }, 50);

            setTimeout(() => {
              clearInterval(scrollInterval);
              if (mainChatViewport) {
                mainChatViewport.scrollTop = 0;
                console.log('Scroll to top finalized');
              }
            }, 2000);
            
            return true;
          } else {
            mainChatViewport.scrollTop = 0;
            console.log('Already at top, set to 0');
            return true;
          }
        } else {
          console.log('No viewport found');
          return false;
        }
      });

      if (scrollResult) {
        scrollAttempted = true;
        console.log(`  ✅ Found and initiated scroll to top (attempt ${retries + 1})`);
      } else if (retries < maxRetries - 1) {
        await delay(1500);
        retries++;
        console.log(`  🔄 Retrying scroll to top (attempt ${retries + 1}/${maxRetries})...`);
      } else {
        break;
      }
    }

    if (scrollAttempted) {
      await delay(2500);
      console.log("  ✅ Scrolled to top of chat area");
    } else {
      console.log("  ⚠️  Could not find scrollable chat area after retries");
      // Fallback: try direct approach
      try {
        const scrollWorked = await page.evaluate(() => {
          const chatListContainer = document.querySelector('div[class*="flex"][class*="flex-col"][class*="gap-4"]');
          if (chatListContainer) {
            let parent: HTMLElement | null = chatListContainer.parentElement;
            while (parent && parent !== document.body) {
              if (parent.getAttribute('data-radix-scroll-area-viewport')) {
                let checkParent: HTMLElement | null = parent;
                let foundAside = false;
                while (checkParent && checkParent !== document.body) {
                  if (checkParent.tagName === "ASIDE" || 
                      checkParent.classList?.toString().includes("sidebar")) {
                    foundAside = true;
                    break;
                  }
                  checkParent = checkParent.parentElement;
                }
                if (!foundAside) {
                  parent.scrollTop = 0;
                  return true;
                }
              }
              parent = parent.parentElement;
            }
          }
          
          const mainElement = document.querySelector('main');
          if (mainElement) {
            const viewport = mainElement.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            if (viewport) {
              viewport.scrollTop = 0;
              return true;
            }
          }
          
          return false;
        });
        
        if (scrollWorked) {
          await delay(2000);
          console.log("  ✅ Scrolled to top using fallback method");
        }
      } catch (error) {
        console.log(`  ⚠️  Fallback scroll also failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    console.log(`  ⚠️  Error scrolling to top: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Ensure output directory exists
 */
export function ensureOutputDir(): void {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
}

/**
 * Scroll chat area to end (excluding sidebar)
 * This function finds the ScrollArea viewport inside <main> element, not <aside>
 */
export async function scrollChatToEnd(page: Page): Promise<void> {
  try {
    // Wait a moment for any DOM updates (e.g., accordion content rendering)
    // This is important after expanding an accordion as the scroll height changes
    console.log("  🔍 Preparing to scroll chat area...");
    await delay(800);
    
    // Try scrolling with retry to handle cases where scroll height changes after expansion
    let scrollAttempted = false;
    let retries = 0;
    const maxRetries = 5; // Increased retries

    while (!scrollAttempted && retries < maxRetries) {
      // Small delay to allow any pending DOM updates
      await delay(200);
      
      const scrollResult = await page.evaluate(() => {
        let mainChatViewport: HTMLElement | null = null;

            // Strategy 1: Find ScrollArea viewport that contains chat messages
            // Specifically look for ChatList structure: div with "flex flex-col gap-4" or "p-4 sm:p-6"
            const allViewports = document.querySelectorAll(
              '[data-radix-scroll-area-viewport]'
            );

            console.log(`Found ${allViewports.length} ScrollArea viewports`);

            for (const viewport of Array.from(allViewports)) {
              const element = viewport as HTMLElement;
              
              // Check if this viewport contains ChatList structure
              // ChatList structure: div.p-4.sm:p-6 > div.flex.flex-col.gap-4
              const hasChatListStructure = element.querySelector(
                'div[class*="flex"][class*="flex-col"][class*="gap-4"], div[class*="p-4"][class*="sm:p-6"]'
              );
              
              // Also check for chat content (accordions or chat messages)
              const hasAccordions = element.querySelector(
                '[role="button"][aria-expanded], [class*="AccordionTrigger"], [class*="AccordionContent"]'
              );
              const hasChatMessages = element.querySelector(
                '[class*="ChatMessage"], [class*="chat-message"], [role="article"]'
              );
              
              if (!hasChatListStructure && !hasAccordions && !hasChatMessages) {
                continue; // Skip viewports without chat content
              }
              
              // Verify it's NOT inside an <aside> element (sidebar)
              let checkParent: HTMLElement | null = element;
              let foundAside = false;
              
              while (checkParent && checkParent !== document.body) {
                const tagName = checkParent.tagName || "";
                const classList = checkParent.classList?.toString() || "";
                
                // Check for aside tag or sidebar classes
                if (tagName === "ASIDE" || 
                    classList.includes("sidebar") || 
                    classList.includes("session-sidebar") ||
                    checkParent.getAttribute('data-testid') === 'session-sidebar') {
                  foundAside = true;
                  break;
                }
                
                checkParent = checkParent.parentElement;
              }
              
              // Use this viewport if it has chat content and is NOT in aside
              if (!foundAside) {
                // Force layout recalculation
                const scrollHeight = element.scrollHeight;
                const clientHeight = element.clientHeight;
                
                console.log(`Found candidate viewport: hasChatListStructure=${!!hasChatListStructure}, hasAccordions=${!!hasAccordions}, scrollHeight=${scrollHeight}, clientHeight=${clientHeight}`);
                
                // Accept this viewport if it has chat content (even if not scrollable yet)
                // The scrollHeight might update after content renders
                if (scrollHeight >= clientHeight || hasChatListStructure || hasAccordions) {
                  mainChatViewport = element;
                  console.log(`Selected viewport for scrolling`);
                  break;
                }
              } else {
                console.log(`Skipped viewport (in sidebar)`);
              }
            }

        // Strategy 2: Find ScrollArea root with h-full w-full (ChatList pattern) and get its viewport
        if (!mainChatViewport) {
          // Look for ScrollArea root that matches ChatList pattern (h-full w-full)
          const scrollAreaRoots = document.querySelectorAll(
            '[data-radix-scroll-area-root]'
          );
          
          for (const root of Array.from(scrollAreaRoots)) {
            const rootElement = root as HTMLElement;
            const rootClasses = rootElement.classList?.toString() || "";
            
            // ChatList ScrollArea has "h-full w-full" classes
            const matchesChatListPattern = rootClasses.includes("h-full") && rootClasses.includes("w-full");
            
            // Find the viewport inside this root
            const viewport = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            if (viewport) {
              // Check if it contains chat list structure
              const hasChatListStructure = viewport.querySelector(
                'div[class*="flex"][class*="flex-col"][class*="gap-4"], div[class*="p-4"][class*="sm:p-6"]'
              );
              
              // Also check for accordions
              const hasAccordions = viewport.querySelector(
                '[role="button"][aria-expanded], [class*="AccordionTrigger"]'
              );
              
              if (hasChatListStructure || (matchesChatListPattern && hasAccordions)) {
                // Verify not in sidebar
                let checkParent: HTMLElement | null = viewport;
                let foundAside = false;
                
                while (checkParent && checkParent !== document.body) {
                  const tagName = checkParent.tagName || "";
                  const classList = checkParent.classList?.toString() || "";
                  
                  if (tagName === "ASIDE" || 
                      classList.includes("sidebar") || 
                      classList.includes("session-sidebar") ||
                      checkParent.getAttribute('data-testid') === 'session-sidebar') {
                    foundAside = true;
                    break;
                  }
                  checkParent = checkParent.parentElement;
                }
                
                if (!foundAside) {
                  mainChatViewport = viewport;
                  break;
                }
              }
            }
          }
        }

        // Strategy 3: Find by looking for main content area with overflow
        if (!mainChatViewport) {
          // Look for elements with overflow that contain chat content
          const candidates = document.querySelectorAll('main [class*="h-full"], main [class*="flex-1"]');
          
          for (const candidate of Array.from(candidates)) {
            const element = candidate as HTMLElement;
            const style = window.getComputedStyle(element);
            const hasOverflow = style.overflowY === 'auto' || style.overflowY === 'scroll';
            
            if (hasOverflow) {
              // Check if it contains chat list structure
              const hasChatContent = element.querySelector(
                'div[class*="flex"][class*="flex-col"][class*="gap-4"], [role="button"][aria-expanded], [class*="Accordion"]'
              );
              
              if (hasChatContent) {
                // Verify not in sidebar
                let checkParent: HTMLElement | null = element;
                let foundAside = false;
                
                while (checkParent && checkParent !== document.body) {
                  const tagName = checkParent.tagName || "";
                  if (tagName === "ASIDE") {
                    foundAside = true;
                    break;
                  }
                  checkParent = checkParent.parentElement;
                }
                
                if (!foundAside) {
                  mainChatViewport = element;
                  break;
                }
              }
            }
          }
        }

        // Strategy 4: Find by walking up from accordion to find ScrollArea viewport
        if (!mainChatViewport) {
          const accordionTrigger = document.querySelector(
            '[role="button"][aria-expanded], [class*="AccordionTrigger"]'
          ) as HTMLElement;
                
          if (accordionTrigger) {
            let parent: HTMLElement | null = accordionTrigger.parentElement;
            let depth = 0;
            
            while (parent && depth < 30) {
              // Check if this is a ScrollArea viewport
              if (parent.getAttribute('data-radix-scroll-area-viewport')) {
                // Verify not in sidebar
                let checkParent: HTMLElement | null = parent;
                let foundAside = false;
                
                while (checkParent && checkParent !== document.body) {
                  const tagName = checkParent.tagName || "";
                  const classList = checkParent.classList?.toString() || "";
                  
                  if (tagName === "ASIDE" || classList.includes("sidebar") || classList.includes("session-sidebar")) {
                    foundAside = true;
                    break;
                  }
                  checkParent = checkParent.parentElement;
                }
                
                if (!foundAside) {
                  mainChatViewport = parent;
                  break;
                }
              }
              
              // Also check for overflow styles
              const style = window.getComputedStyle(parent);
              const hasOverflow = style.overflowY === 'auto' || style.overflowY === 'scroll';
              
              if (hasOverflow) {
                // Verify not in sidebar
                let checkParent: HTMLElement | null = parent;
                let foundAside = false;
                
                while (checkParent && checkParent !== document.body) {
                  const tagName = checkParent.tagName || "";
                  if (tagName === "ASIDE") {
                    foundAside = true;
                    break;
                  }
                  checkParent = checkParent.parentElement;
                }
                
                if (!foundAside) {
                  mainChatViewport = parent;
                  break;
                }
              }
              
              parent = parent.parentElement;
              depth++;
            }
          }
        }

        // Scroll the main chat viewport if found
        if (mainChatViewport) {
          // Force layout recalculation
          const scrollHeight = mainChatViewport.scrollHeight;
          const clientHeight = mainChatViewport.clientHeight;
          const maxScroll = scrollHeight - clientHeight;
          const currentScroll = mainChatViewport.scrollTop;
          
          if (scrollHeight > clientHeight && currentScroll < maxScroll - 10) {
            // Scroll smoothly to bottom using intervals
            const scrollDistance = maxScroll - currentScroll;
            const scrollSteps = 25;
            const stepSize = Math.max(30, scrollDistance / scrollSteps);
            let scrollPosition = currentScroll;
            let step = 0;

            const scrollInterval = setInterval(() => {
              step++;
              scrollPosition = Math.min(maxScroll, scrollPosition + stepSize);
              mainChatViewport.scrollTop = scrollPosition;

              if (step >= scrollSteps || scrollPosition >= maxScroll - 5) {
                mainChatViewport.scrollTop = maxScroll;
                clearInterval(scrollInterval);
              }
            }, 50); // 50ms per step for smooth scrolling

            // Ensure scroll completes
            setTimeout(() => {
              clearInterval(scrollInterval);
              if (mainChatViewport) {
                mainChatViewport.scrollTop = mainChatViewport.scrollHeight;
              }
            }, 2000);
            
            return true; // Scroll initiated
          } else {
            // Already at bottom or not scrollable yet
            // Try scrolling to bottom anyway to ensure we're at the end
            mainChatViewport.scrollTop = mainChatViewport.scrollHeight;
            return true;
          }
        } else {
          // No viewport found
          return false;
        }
      });

      if (scrollResult) {
        scrollAttempted = true;
        console.log(`  ✅ Found and initiated scroll on chat viewport (attempt ${retries + 1})`);
      } else if (retries < maxRetries - 1) {
        // Wait longer for DOM to update, especially after accordion expansion
        await delay(1500);
        retries++;
        console.log(`  🔄 Retrying scroll (attempt ${retries + 1}/${maxRetries})...`);
      } else {
        break;
      }
    }

    if (scrollAttempted) {
      // Wait for smooth scroll animation to complete
      await delay(2500); // Increased wait time for scroll animation
      console.log("  ✅ Scrolled to bottom of chat area");
    } else {
      console.log("  ⚠️  Could not find scrollable chat area after retries");
      // Try scrolling using a more direct approach - find ChatList structure
      try {
        const scrollWorked = await page.evaluate(() => {
          // Try to find the ChatList ScrollArea viewport directly
          // Look for viewport that contains div with "flex flex-col gap-4" (ChatList structure)
          const chatListContainer = document.querySelector('div[class*="flex"][class*="flex-col"][class*="gap-4"]');
          if (chatListContainer) {
            // Walk up to find the ScrollArea viewport
            let parent: HTMLElement | null = chatListContainer.parentElement;
            while (parent && parent !== document.body) {
              if (parent.getAttribute('data-radix-scroll-area-viewport')) {
                // Verify not in sidebar
                let checkParent: HTMLElement | null = parent;
                let foundAside = false;
                while (checkParent && checkParent !== document.body) {
                  if (checkParent.tagName === "ASIDE" || 
                      checkParent.classList?.toString().includes("sidebar")) {
                    foundAside = true;
                    break;
                  }
                  checkParent = checkParent.parentElement;
                }
                if (!foundAside) {
                  parent.scrollTop = parent.scrollHeight;
                  return true;
                }
              }
              parent = parent.parentElement;
            }
          }
          
          // Fallback: try to find any ScrollArea viewport in main
          const mainElement = document.querySelector('main');
          if (mainElement) {
            const viewport = mainElement.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            if (viewport) {
              viewport.scrollTop = viewport.scrollHeight;
              return true;
            }
          }
          
          // Last resort: window scroll
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          return true;
        });
        
        if (scrollWorked) {
          await delay(2000);
          console.log("  ✅ Scrolled using alternative method");
        }
      } catch (error) {
        console.log(`  ⚠️  Alternative scroll also failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    console.log(
      `  ⚠️  Could not scroll chat area: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Scroll chat area partially in a specified direction.
 * @param page - Playwright page
 * @param direction - Direction to scroll: "down" (default) or "up"/"top"
 * @param percentage - Percentage of scroll distance to cover (0.0 to 1.0, default 0.7 for 70%)
 * @param scrollSteps - Number of steps for smooth scrolling (default 15)
 * @param stepDelay - Delay between steps in ms (default 80)
 */
export async function scrollChatPartially(
  page: Page,
  direction: "up" | "down" | "top" | "bottom" = "down",
  percentage: number = 0.7,
  scrollSteps: number = 15,
  stepDelay: number = 80
): Promise<void> {
  try {
    await delay(800); // Wait for DOM updates
    
    // Try container scroll method first (this worked before)
    let scrollAttempted = false;
    try {
      // Find the chat list container directly and scroll via closest viewport
      const chatListContainer = page
        .locator('div[class*="flex"][class*="flex-col"][class*="gap-4"]')
        .first();
      
      if (await chatListContainer.isVisible({ timeout: 3000 })) {
        // Hover to make scrollbar visible
        await chatListContainer.hover();
        await delay(300);
        
        // Find the viewport via closest and scroll it with smooth animation
        await chatListContainer.evaluate((el, params) => {
          const { dir, pct, steps, delayMs } = params;
          const viewport = el.closest('[data-radix-scroll-area-viewport]') as HTMLElement;
          if (!viewport) return false;
          
          const scrollHeight = viewport.scrollHeight;
          const clientHeight = viewport.clientHeight;
          const maxScroll = scrollHeight - clientHeight;
          const currentScroll = viewport.scrollTop;
          
          // Check if container is at top or bottom (with 10px threshold)
          const isAtTop = currentScroll <= 10;
          const isAtBottom = currentScroll >= maxScroll - 10;
          
          // Reverse direction based on current position
          let actualDir = dir;
          if (isAtBottom && (dir === "bottom" || dir === "down")) {
            // At bottom, scroll to top
            actualDir = "top";
          } else if (isAtTop && (dir === "top" || dir === "up")) {
            // At top, scroll to bottom
            actualDir = "bottom";
          }
          
          let targetScroll: number;
          if (actualDir === "top") {
            targetScroll = 0;
          } else if (actualDir === "bottom") {
            targetScroll = maxScroll;
          } else if (actualDir === "up") {
            targetScroll = Math.max(0, currentScroll * (1 - pct));
          } else {
            targetScroll = currentScroll + (maxScroll - currentScroll) * pct;
          }
          
          const scrollDistance = Math.abs(targetScroll - currentScroll);
          const stepSize = Math.max(20, scrollDistance / steps);
          let scrollPosition = currentScroll;
          let step = 0;
          
          const scrollInterval = setInterval(() => {
            step++;
            if (targetScroll < currentScroll) {
              scrollPosition = Math.max(targetScroll, scrollPosition - stepSize);
            } else {
              scrollPosition = Math.min(targetScroll, scrollPosition + stepSize);
            }
            viewport.scrollTop = scrollPosition;
            
            if (step >= steps || Math.abs(scrollPosition - targetScroll) < 5) {
              viewport.scrollTop = targetScroll;
              clearInterval(scrollInterval);
            }
          }, delayMs);
          
          // Ensure scroll completes
          setTimeout(() => {
            clearInterval(scrollInterval);
            viewport.scrollTop = targetScroll;
          }, steps * delayMs + 500);
          
          return true;
        }, {
          dir: direction,
          pct: percentage,
          steps: scrollSteps,
          delayMs: stepDelay,
        });
        
        scrollAttempted = true;
        await delay(scrollSteps * stepDelay + 500);
        console.log(`  ✅ Scrolled chat area ${direction} using container scroll method`);
      }
    } catch (containerErr) {
      console.log(`  ⚠️  Container scroll method failed: ${containerErr instanceof Error ? containerErr.message : String(containerErr)}, trying evaluate fallback...`);
    }
    
    // Fallback: Try evaluate method with retry logic (same as scrollChatToEnd)
    if (!scrollAttempted) {
      let retries = 0;
      const maxRetries = 5;

      while (!scrollAttempted && retries < maxRetries) {
        await delay(200);
        
        const scrollResult = await page.evaluate(
      (params: { dir: string; pct: number; steps: number; delayMs: number }) => {
        const { dir, pct, steps, delayMs } = params;
        let mainChatViewport: HTMLElement | null = null;

        // Strategy 1: Find ChatList ScrollArea specifically (same as scrollChatToTop)
        // ChatList has: <ScrollArea className="h-full w-full">
        //   -> <ScrollAreaPrimitive.Viewport> (data-radix-scroll-area-viewport)
        //     -> <div className="p-4 sm:p-6">
        //       -> <div className="flex flex-col gap-4">
        const scrollAreaRoots = document.querySelectorAll(
          '[data-radix-scroll-area-root]'
        );

        for (const root of Array.from(scrollAreaRoots)) {
          const rootElement = root as HTMLElement;
          const rootClasses = rootElement.classList?.toString() || "";
          
          // ChatList ScrollArea has "h-full w-full" classes
          const matchesChatListPattern = rootClasses.includes("h-full") && rootClasses.includes("w-full");
          
          if (matchesChatListPattern) {
            // Find the viewport inside this root
            const viewport = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            if (viewport) {
              // Check if it contains ChatList structure: div.p-4.sm:p-6 > div.flex.flex-col.gap-4
              const hasChatListStructure = viewport.querySelector(
                'div[class*="p-4"][class*="sm:p-6"] > div[class*="flex"][class*="flex-col"][class*="gap-4"]'
              ) || viewport.querySelector('div[class*="flex"][class*="flex-col"][class*="gap-4"]');
              
              // Also check for chat messages
              const hasChatMessages = viewport.querySelector(
                '[class*="ChatMessage"], [class*="chat-message"], [role="article"]'
              );
              
              if (hasChatListStructure || hasChatMessages) {
                // Verify not in sidebar
                let checkParent: HTMLElement | null = viewport;
                let foundAside = false;
                
                while (checkParent && checkParent !== document.body) {
                  const tagName = checkParent.tagName || "";
                  const classList = checkParent.classList?.toString() || "";
                  
                  if (tagName === "ASIDE" || 
                      classList.includes("sidebar") || 
                      classList.includes("session-sidebar") ||
                      checkParent.getAttribute('data-testid') === 'session-sidebar') {
                    foundAside = true;
                    break;
                  }
                  checkParent = checkParent.parentElement;
                }
                
                if (!foundAside) {
                  mainChatViewport = viewport;
                  break;
                }
              }
            }
          }
        }

        // Strategy 2: Find ScrollArea viewport that contains chat messages (same as scrollChatToEnd)
        if (!mainChatViewport) {
          const allViewports = document.querySelectorAll('[data-radix-scroll-area-viewport]');
          
          for (const viewport of Array.from(allViewports)) {
            const element = viewport as HTMLElement;
            
            // Check if this viewport contains ChatList structure
            const hasChatListStructure = element.querySelector(
              'div[class*="flex"][class*="flex-col"][class*="gap-4"], div[class*="p-4"][class*="sm:p-6"]'
            );
            
            // Also check for chat content
            const hasAccordions = element.querySelector(
              '[role="button"][aria-expanded], [class*="AccordionTrigger"], [class*="AccordionContent"]'
            );
            const hasChatMessages = element.querySelector(
              '[class*="ChatMessage"], [class*="chat-message"], [role="article"]'
            );
            
            if (!hasChatListStructure && !hasAccordions && !hasChatMessages) {
              continue; // Skip viewports without chat content
            }
            
            // Verify it's NOT inside an <aside> element (sidebar)
            let checkParent: HTMLElement | null = element;
            let foundAside = false;
            
            while (checkParent && checkParent !== document.body) {
              const tagName = checkParent.tagName || "";
              const classList = checkParent.classList?.toString() || "";
              
              if (tagName === "ASIDE" || 
                  classList.includes("sidebar") || 
                  classList.includes("session-sidebar") ||
                  checkParent.getAttribute('data-testid') === 'session-sidebar') {
                foundAside = true;
                break;
              }
              checkParent = checkParent.parentElement;
            }
            
            // Use this viewport if it has chat content and is NOT in aside
            if (!foundAside) {
              const scrollHeight = element.scrollHeight;
              const clientHeight = element.clientHeight;
              
              // Accept this viewport if it has chat content
              if (scrollHeight >= clientHeight || hasChatListStructure || hasAccordions) {
                mainChatViewport = element;
                break;
              }
            }
          }
        }

        // Strategy 3: Find by walking up from the chat list structure div
        if (!mainChatViewport) {
          const chatListDiv = document.querySelector('div[class*="flex"][class*="flex-col"][class*="gap-4"]');
          if (chatListDiv) {
            let parent: HTMLElement | null = chatListDiv.parentElement;
            let depth = 0;
            
            while (parent && depth < 10) {
              // Check if this is a ScrollArea viewport
              if (parent.getAttribute('data-radix-scroll-area-viewport')) {
                // Verify not in sidebar
                let checkParent: HTMLElement | null = parent;
                let foundAside = false;
                
                while (checkParent && checkParent !== document.body) {
                  const tagName = checkParent.tagName || "";
                  const classList = checkParent.classList?.toString() || "";
                  
                  if (tagName === "ASIDE" || 
                      classList.includes("sidebar") || 
                      classList.includes("session-sidebar")) {
                    foundAside = true;
                    break;
                  }
                  checkParent = checkParent.parentElement;
                }
                
                if (!foundAside) {
                  mainChatViewport = parent;
                  break;
                }
              }
              parent = parent.parentElement;
              depth++;
            }
          }
        }

        // Scroll the main chat viewport if found
        if (mainChatViewport) {
          // Force layout recalculation
          const scrollHeight = mainChatViewport.scrollHeight;
          const clientHeight = mainChatViewport.clientHeight;
          const maxScroll = scrollHeight - clientHeight;
          const currentScroll = mainChatViewport.scrollTop;

          // Check if container is at top or bottom (with 10px threshold)
          const isAtTop = currentScroll <= 10;
          const isAtBottom = currentScroll >= maxScroll - 10;
          
          // Reverse direction based on current position
          let actualDir = dir;
          if (isAtBottom && (dir === "bottom" || dir === "down")) {
            // At bottom, scroll to top
            actualDir = "top";
          } else if (isAtTop && (dir === "top" || dir === "up")) {
            // At top, scroll to bottom
            actualDir = "bottom";
          }

          const isScrollingUp = actualDir === "up" || actualDir === "top";
          const isScrollingDown = actualDir === "down" || actualDir === "bottom";

          if (isScrollingUp) {
            // Scroll up/top: scroll towards 0
            if (currentScroll > 10) {
              // Scroll to specified percentage from top (0 = top, 1.0 = current position)
              // For "top", scroll all the way to 0
              const targetScroll = actualDir === "top" ? 0 : currentScroll * (1 - pct);
              const scrollDistance = currentScroll - targetScroll;
              const stepSize = Math.max(20, scrollDistance / steps);
              let scrollPosition = currentScroll;
              let step = 0;

              const scrollInterval = setInterval(() => {
                step++;
                scrollPosition = Math.max(targetScroll, scrollPosition - stepSize);
                mainChatViewport!.scrollTop = scrollPosition;

                if (step >= steps || scrollPosition <= targetScroll + 5) {
                  mainChatViewport!.scrollTop = targetScroll;
                  clearInterval(scrollInterval);
                }
              }, delayMs);

              // Ensure scroll completes
              setTimeout(() => {
                clearInterval(scrollInterval);
                if (mainChatViewport) {
                  mainChatViewport.scrollTop = targetScroll;
                }
              }, steps * delayMs + 500);

              return true; // Scroll initiated
            } else {
              // Already at top, ensure we're at 0
              mainChatViewport.scrollTop = 0;
              return true;
            }
          } else if (isScrollingDown) {
            // Scroll down/bottom: scroll towards maxScroll
            if (scrollHeight > clientHeight && currentScroll < maxScroll - 10) {
              // Scroll to specified percentage of the way down
              // For "bottom", scroll all the way to maxScroll
              const targetScroll =
                actualDir === "bottom"
                  ? maxScroll
                  : currentScroll + (maxScroll - currentScroll) * pct;
              const scrollDistance = targetScroll - currentScroll;
              const stepSize = Math.max(20, scrollDistance / steps);
              let scrollPosition = currentScroll;
              let step = 0;

              const scrollInterval = setInterval(() => {
                step++;
                scrollPosition = Math.min(targetScroll, scrollPosition + stepSize);
                mainChatViewport!.scrollTop = scrollPosition;

                if (step >= steps || scrollPosition >= targetScroll - 5) {
                  mainChatViewport!.scrollTop = targetScroll;
                  clearInterval(scrollInterval);
                }
              }, delayMs);

              // Ensure scroll completes
              setTimeout(() => {
                clearInterval(scrollInterval);
                if (mainChatViewport) {
                  mainChatViewport.scrollTop = targetScroll;
                }
              }, steps * delayMs + 500);

              return true; // Scroll initiated
            } else {
              // Already at bottom or not scrollable yet
              // Try scrolling to target anyway
              const targetScroll = actualDir === "bottom" ? maxScroll : currentScroll + (maxScroll - currentScroll) * pct;
              mainChatViewport.scrollTop = targetScroll;
              return true;
            }
          }
        }
        return false;
      },
      {
        dir: direction,
        pct: percentage,
        steps: scrollSteps,
        delayMs: stepDelay,
      }
    );

      if (scrollResult) {
        scrollAttempted = true;
        console.log(`  ✅ Found and initiated scroll on chat viewport using evaluate (attempt ${retries + 1})`);
      } else if (retries < maxRetries - 1) {
        // Wait longer for DOM to update
        await delay(1500);
        retries++;
        console.log(`  🔄 Retrying scroll (attempt ${retries + 1}/${maxRetries})...`);
      } else {
        break;
      }
    }

      if (scrollAttempted) {
        // Wait for smooth scroll animation to complete
        await delay(scrollSteps * stepDelay + 500);
        console.log(`  ✅ Scrolled chat area ${direction} using evaluate fallback`);
      } else {
        console.log("  ⚠️  Could not scroll chat area with either method");
      }
    }
  } catch (error) {
    console.log(
      `  ⚠️  Could not scroll chat partially: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Find all accordion triggers in the chat area (excluding sidebar and user messages)
 */
export async function findAccordions(page: Page): Promise<Array<{
  trigger: any;
  title: string;
  value: string;
  isExpanded: boolean;
}>> {
  const allAccordionTriggers: Array<{
    trigger: any;
    title: string;
    value: string;
    isExpanded: boolean;
  }> = [];

  try {
    const allTriggers = await page
      .locator(
        '[class*="AccordionTrigger"], button[aria-expanded], [role="button"][aria-expanded]'
      )
      .all();

    console.log(`  🔍 Found ${allTriggers.length} potential accordion trigger(s)`);

    for (const trigger of allTriggers) {
      try {
        if (!(await trigger.isVisible({ timeout: 1000 }).catch(() => false))) {
          continue;
        }

        // Check if it's in an assistant message (not user message or sidebar)
        const isInAssistantMessage = await trigger
          .evaluate((el) => {
            let parent = el.parentElement;
            let depth = 0;
            let foundSidebar = false;
            let foundUserMessage = false;

            while (parent && depth < 15) {
              const classList = parent.classList?.toString() || "";
              const tagName = parent.tagName || "";
              const id = parent.id || "";

              if (
                tagName === "ASIDE" ||
                tagName === "HEADER" ||
                tagName === "NAV" ||
                classList.includes("sidebar") ||
                classList.includes("header") ||
                id.includes("sidebar") ||
                id.includes("header")
              ) {
                foundSidebar = true;
                break;
              }

              if (
                classList.includes("bg-secondary") &&
                (classList.includes("self-end") ||
                  classList.includes("justify-end"))
              ) {
                let checkParent = parent.parentElement;
                let checkDepth = 0;
                while (checkParent && checkDepth < 3) {
                  const checkClass =
                    checkParent.classList?.toString() || "";
                  if (
                    checkClass.includes("flex") &&
                    checkClass.includes("items-start") &&
                    checkClass.includes("justify-end")
                  ) {
                    foundUserMessage = true;
                    break;
                  }
                  checkParent = checkParent.parentElement;
                  checkDepth++;
                }
                if (foundUserMessage) break;
              }

              parent = parent.parentElement;
              depth++;
            }

            return !foundSidebar && !foundUserMessage;
          })
          .catch(() => true);

        // Get accordion title first to help with debugging
        const title = await trigger.textContent().catch(() => "");
        const ariaExpanded = await trigger.getAttribute("aria-expanded");
        const isExpanded = ariaExpanded === "true";
        
        // If not in assistant message, log for debugging but still include it if it has valid content
        if (!isInAssistantMessage) {
          // Check if it's definitely in sidebar/header - if so, skip it
          const isDefinitelyInSidebar = await trigger
            .evaluate((el) => {
              let parent = el.parentElement;
              let depth = 0;
              while (parent && depth < 10) {
                const tagName = parent.tagName || "";
                if (tagName === "ASIDE" || tagName === "HEADER" || tagName === "NAV") {
                  return true;
                }
                parent = parent.parentElement;
                depth++;
              }
              return false;
            })
            .catch(() => false);
          
          if (isDefinitelyInSidebar) {
            continue; // Skip sidebar accordions
          }
          // Otherwise, include it (might be in main content area with different structure)
        }

        // Infer accordion value from title text (more reliable than DOM traversal)
        let value = "";
        const titleLower = (title || "").toLowerCase();
        
        // Debug: log accordion found
        console.log(`  📋 Found accordion: "${title?.trim() || 'Unknown'}" (expanded: ${isExpanded}, inAssistant: ${isInAssistantMessage})`);
        
        if (
          titleLower.includes("coverage") ||
          titleLower.includes("coverage analysis")
        ) {
          value = "coverage";
        } else if (
          titleLower.includes("diy") ||
          titleLower.includes("diy recommendations")
        ) {
          value = "diy";
        } else if (
          titleLower.includes("service") ||
          titleLower.includes("service recommendations")
        ) {
          value = "service";
        } else if (
          titleLower.includes("cost") ||
          titleLower.includes("cost estimates")
        ) {
          value = "cost-estimates";
        }

        allAccordionTriggers.push({
          trigger,
          title: title?.trim() || "Unknown",
          value,
          isExpanded,
        });
      } catch (error) {
        continue;
      }
    }
  } catch (error) {
    console.log(
      `  ⚠️  Error finding accordions: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return allAccordionTriggers;
}

/**
 * Process a single accordion: expand, scroll, collapse
 * @param accordion - The accordion object with trigger, title, value, isExpanded
 * @param page - The Playwright page
 * @param options - Options for processing (collapseAfterScroll, waitAfterExpand, waitAfterScroll)
 */
export async function processAccordion(
  accordion: { trigger: any; title: string; value: string; isExpanded: boolean },
  page: Page,
  options: {
    collapseAfterScroll?: boolean;
    waitAfterExpand?: number;
    waitAfterScroll?: number;
  } = {}
): Promise<void> {
  const {
    collapseAfterScroll = true,
    waitAfterExpand = 2000,
    waitAfterScroll = 1000,
  } = options;

  try {
    if (!(await accordion.trigger.isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log(`  ⚠️  Accordion "${accordion.title}" no longer visible, skipping...`);
      return;
    }

    // Check if already expanded
    const ariaExpanded = await accordion.trigger.getAttribute("aria-expanded");
    if (ariaExpanded === "true") {
      console.log(`  ℹ️  Accordion "${accordion.title}" already expanded, scrolling...`);
      await delay(1000);
      
      // Scroll to end
      console.log(`  📜 Scrolling chat message area to the end...`);
      await scrollChatToEnd(page);
      
      // Wait a moment after scrolling
      await delay(waitAfterScroll);
      
      // Click to collapse the accordion if collapseAfterScroll is true
      if (collapseAfterScroll) {
        console.log(`  🔼 Collapsing accordion: ${accordion.title}...`);
        await accordion.trigger.scrollIntoViewIfNeeded();
        await delay(400);
        await accordion.trigger.click();
        await delay(600); // Wait for collapse animation
        console.log(`  ✅ Collapsed accordion: ${accordion.title}`);
      }
      return;
    }

    // Click to expand
    console.log(`  🔽 Expanding accordion: ${accordion.title}...`);
    await accordion.trigger.scrollIntoViewIfNeeded();
    await delay(400);
    
    await accordion.trigger.click();
    await delay(800); // Wait for expansion animation

    // Wait for accordion to be fully expanded
    console.log(`  ⏸️  Waiting for "${accordion.title}" to fully expand...`);
    await delay(1000); // Wait for expansion animation to complete
    
    // Verify accordion is expanded
    const isExpanded = await accordion.trigger.getAttribute("aria-expanded").catch(() => "false");
    if (isExpanded !== "true") {
      console.log(`  ⚠️  Accordion "${accordion.title}" did not expand, retrying click...`);
      await accordion.trigger.click();
      await delay(800);
    }
    
    // Wait for accordion content to render - check for content presence
    console.log(`  ⏳ Waiting for "${accordion.title}" content to render...`);
    let contentRendered = false;
    let renderChecks = 0;
    const maxRenderChecks = 15; // Wait up to 3 seconds (15 * 200ms)
    
    while (!contentRendered && renderChecks < maxRenderChecks) {
      await delay(200);
      
      const hasContent = await page.evaluate(() => {
        const expandedAccordion = document.querySelector('[role="button"][aria-expanded="true"]');
        if (!expandedAccordion) return false;
        
        // Check for visible content in the accordion
        let parent = expandedAccordion.parentElement;
        let depth = 0;
        while (parent && depth < 5) {
          const hasList = parent.querySelector('ul, ol, li') !== null;
          const hasContentDivs = Array.from(parent.querySelectorAll('div')).some(
            (div) => {
              const style = window.getComputedStyle(div);
              const text = div.textContent || '';
              return style.display !== 'none' && 
                     style.visibility !== 'hidden' && 
                     text.trim().length > 20;
            }
          );
          if (hasList || hasContentDivs) {
            return true;
          }
          parent = parent.parentElement;
          depth++;
        }
        return false;
      }).catch(() => true);
      
      if (hasContent || renderChecks >= 5) {
        // Content is rendered or we've waited enough (1 second minimum)
        contentRendered = true;
        if (hasContent) {
          console.log(`  ✅ Accordion "${accordion.title}" content rendered`);
        } else {
          console.log(`  ✅ Proceeding after minimum wait for "${accordion.title}"`);
        }
      }
      renderChecks++;
    }
    
    // Wait the configured time after expansion for visibility
    console.log(`  ⏸️  Waiting ${waitAfterExpand / 1000} seconds after "${accordion.title}" expansion...`);
    await delay(waitAfterExpand);
    
    // Additional wait to ensure browser has recalculated layout (scrollHeight might change)
    await delay(500);

    // Scroll to end after waiting - this will use requestAnimationFrame to ensure DOM is updated
    console.log(`  📜 Scrolling chat message area to the end...`);
    await scrollChatToEnd(page);
    
    // Wait a moment after scrolling
    await delay(waitAfterScroll);
    
    // Click on the same accordion again to collapse it if collapseAfterScroll is true
    if (collapseAfterScroll) {
      console.log(`  🔼 Collapsing accordion: ${accordion.title}...`);
      // Re-check if still expanded
      const currentAriaExpanded = await accordion.trigger.getAttribute("aria-expanded");
      if (currentAriaExpanded === "true") {
        // Accordion is expanded, click to collapse
        await accordion.trigger.scrollIntoViewIfNeeded();
        await delay(400);
        await accordion.trigger.click();
        await delay(600); // Wait for collapse animation
        console.log(`  ✅ Collapsed accordion: ${accordion.title}`);
      } else {
        console.log(`  ℹ️  Accordion "${accordion.title}" is not expanded, skipping collapse`);
      }
    }
  } catch (error) {
    console.log(
      `  ⚠️  Could not process accordion "${accordion.title}": ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

/**
 * Process all accordions in a specific order with expand, scroll, and collapse behavior
 * @param page - The Playwright page
 * @param options - Options for processing accordions
 */
export async function processAllAccordions(
  page: Page,
  options: {
    order?: string[]; // Order of accordion types to process (e.g., ["coverage", "diy", "service"])
    collapseAfterScroll?: boolean;
    waitAfterExpand?: number;
    waitAfterScroll?: number;
  } = {}
): Promise<void> {
  const {
    order = ["coverage", "diy", "service", "cost-estimates"],
    collapseAfterScroll = true,
    waitAfterExpand = 2000,
    waitAfterScroll = 1000,
  } = options;

  try {
    // Find all accordions
    const allAccordionTriggers = await findAccordions(page);
    console.log(`  📋 Found ${allAccordionTriggers.length} accordion(s)`);

    if (allAccordionTriggers.length === 0) {
      console.log("  ⚠️  No accordions found to process");
      return;
    }

    // Sort accordions by specified order
    const sortedAccordions = allAccordionTriggers.sort((a, b) => {
      const aIndex = order.indexOf(a.value) !== -1 ? order.indexOf(a.value) : 999;
      const bIndex = order.indexOf(b.value) !== -1 ? order.indexOf(b.value) : 999;
      return aIndex - bIndex;
    });

    // Process each accordion
    for (let i = 0; i < sortedAccordions.length; i++) {
      const accordion = sortedAccordions[i];
      try {
        await processAccordion(accordion, page, {
          collapseAfterScroll,
          waitAfterExpand,
          waitAfterScroll,
        });
      } catch (error) {
        console.log(
          `  ⚠️  Error processing accordion "${accordion.title}": ${error instanceof Error ? error.message : String(error)}`
        );
        continue;
      }
    }

    console.log(`  ✅ Finished processing all accordions`);
  } catch (error) {
    console.log(
      `  ⚠️  Error processing accordions: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

const CHECKPOINT_OPTIONAL_AGENTS = [
  { id: "coverage", label: "Coverage" },
  { id: "diy", label: "DIY" },
  { id: "service", label: "Service" },
  { id: "cost", label: "Cost" },
] as const;

const PRIMARY_AGENT_LABELS: Record<string, string> = {
  checkpoint: "Checkpoint",
  docs: "Docs",
  report: "Reports",
};

/** Locator for the open chat settings popover (test id + Radix fallback). */
export function getChatSettingsPopoverLocator(page: Page) {
  return page
    .locator('[data-testid="chat-settings-popover"]')
    .or(
      page
        .locator('[data-state="open"]')
        .filter({ has: page.getByRole("heading", { name: "Chat Settings" }) })
        .filter({ hasText: "Optional Agents" }),
    )
    .first();
}

async function isAgentToggleSelected(
  button: ReturnType<Page["locator"]>,
): Promise<boolean> {
  return button
    .evaluate((el) => el.classList.toString().includes("bg-primary"))
    .catch(() => false);
}

/** Open the chat settings popover from the composer settings bar. */
export async function openChatSettings(page: Page): Promise<boolean> {
  const agentSettingsSelectors = [
    '[data-testid="open-chat-settings"]',
    'button[aria-label="Open chat settings"]',
    'button[aria-label*="Open chat settings" i]',
    '[data-testid="open-chat-settings-agent"]',
  ];

  for (const selector of agentSettingsSelectors) {
    const settingsButton = page.locator(selector).first();
    if (await settingsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsButton.scrollIntoViewIfNeeded();
      await delay(300);
      await settingsButton.click();
      await delay(700);
      const popover = getChatSettingsPopoverLocator(page);
      if (await popover.isVisible({ timeout: 3000 }).catch(() => false)) {
        return true;
      }
    }
  }

  return false;
}

/** Select a primary agent inside an open chat settings popover. */
export async function selectPrimaryAgentInSettings(
  page: Page,
  agentId: keyof typeof PRIMARY_AGENT_LABELS,
): Promise<boolean> {
  const popover = getChatSettingsPopoverLocator(page);
  await popover.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});

  const label = PRIMARY_AGENT_LABELS[agentId];
  let button = popover.locator(`[data-testid="primary-agent-${agentId}"]`).first();
  if (!(await button.isVisible({ timeout: 1500 }).catch(() => false))) {
    button = popover.getByRole("button", { name: label, exact: true }).first();
  }

  if (!(await button.isVisible({ timeout: 2000 }).catch(() => false))) {
    console.log(`  ⚠️  Primary agent button not found: ${label}`);
    return false;
  }

  if (!(await isAgentToggleSelected(button))) {
    await button.scrollIntoViewIfNeeded();
    await delay(200);
    await button.click();
    await delay(400);
    console.log(`  ✅ Selected ${label} agent`);
  } else {
    console.log(`  ✅ ${label} agent already selected`);
  }

  return true;
}

export type CheckpointOptionalAgentId =
  (typeof CHECKPOINT_OPTIONAL_AGENTS)[number]["id"];

async function getOptionalAgentButton(
  popover: ReturnType<Page["locator"]>,
  id: CheckpointOptionalAgentId,
  label: string,
) {
  let button = popover.locator(`[data-testid="optional-agent-${id}"]`).first();
  if (!(await button.isVisible({ timeout: 1500 }).catch(() => false))) {
    button = popover.getByRole("button", { name: label, exact: true }).first();
  }
  return button;
}

/** Set checkpoint optional agents in an open chat settings popover. */
export async function enableCheckpointOptionalAgents(
  page: Page,
  enabledAgentIds: readonly CheckpointOptionalAgentId[] = CHECKPOINT_OPTIONAL_AGENTS.map(
    (agent) => agent.id,
  ),
): Promise<void> {
  const popover = getChatSettingsPopoverLocator(page);
  const popoverVisible = await popover
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (!popoverVisible) {
    console.log("  ⚠️  Chat settings popover is not visible");
    return;
  }

  const enabledSet = new Set(enabledAgentIds);

  for (const { id, label } of CHECKPOINT_OPTIONAL_AGENTS) {
    const button = await getOptionalAgentButton(popover, id, label);

    if (!(await button.isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log(`  ⚠️  Optional agent button not found: ${label}`);
      continue;
    }

    const shouldEnable = enabledSet.has(id);
    const isSelected = await isAgentToggleSelected(button);

    if (shouldEnable === isSelected) {
      console.log(`  ✅ ${label} already ${shouldEnable ? "enabled" : "disabled"}`);
      continue;
    }

    await button.scrollIntoViewIfNeeded();
    await delay(200);
    await button.click();
    await delay(300);
    console.log(`  ✅ ${shouldEnable ? "Enabled" : "Disabled"} ${label}`);
  }
}

/** Open the structured report sheet for the latest assistant message and scroll it. */
export async function openFullChatReportSheetAndScroll(page: Page): Promise<void> {
  console.log("  📄 Opening full report sheet...");
  const openButton = page.getByRole("button", { name: "Open full report" }).last();

  if (!(await openButton.isVisible({ timeout: 3000 }).catch(() => false))) {
    await openButton.scrollIntoViewIfNeeded().catch(() => {});
    await delay(400);
  }

  if (!(await openButton.isVisible({ timeout: 3000 }).catch(() => false))) {
    console.log("  ⚠️  Open full report button not found");
    return;
  }

  await openButton.click();
  await delay(700);

  const sheetScroll = page.locator('[role="dialog"] div.overflow-y-auto').last();
  if (!(await sheetScroll.isVisible({ timeout: 3000 }).catch(() => false))) {
    console.log("  ⚠️  Report sheet scroll area not found");
    await delay(5000);
    return;
  }

  console.log("  📜 Scrolling report sheet...");
  const steps = 10;
  for (let step = 1; step <= steps; step++) {
    await sheetScroll.evaluate((el, ratio) => {
      const maxScroll = el.scrollHeight - el.clientHeight;
      el.scrollTop = maxScroll * ratio;
    }, step / steps);
    await delay(150);
  }

  console.log("  ⏸️  Waiting 5 seconds with report sheet open...");
  await delay(5000);
}

/** Open the structured report sheet for the latest assistant message. */
export async function openFullChatReportSheet(page: Page): Promise<boolean> {
  console.log("  📄 Opening full report sheet...");
  const openButton = page
    .locator('[data-testid="open-full-report"]')
    .last()
    .or(page.getByRole("button", { name: "Open full report" }).last());

  if (!(await openButton.isVisible({ timeout: 3000 }).catch(() => false))) {
    await openButton.scrollIntoViewIfNeeded().catch(() => {});
    await delay(400);
  }

  if (!(await openButton.isVisible({ timeout: 3000 }).catch(() => false))) {
    console.log("  ⚠️  Open full report button not found");
    return false;
  }

  await openButton.click();
  await delay(700);

  const sheetScroll = page.locator('[role="dialog"] div.overflow-y-auto').last();
  const visible = await sheetScroll
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (!visible) {
    console.log("  ⚠️  Report sheet scroll area not found");
    return false;
  }

  return true;
}

/** Close the structured chat report sheet so property tabs are clickable again. */
export async function closeFullChatReportSheet(page: Page): Promise<void> {
  const openDialog = page.locator('[role="dialog"][data-state="open"]').last();
  const hasOpenDialog = await openDialog
    .isVisible({ timeout: 800 })
    .catch(() => false);

  if (!hasOpenDialog) {
    const anyDialog = await page
      .locator('[role="dialog"]')
      .last()
      .isVisible({ timeout: 300 })
      .catch(() => false);
    if (!anyDialog) return;
  }

  console.log("  ✖️  Closing chat report sheet...");

  const dialog = page.locator('[role="dialog"]').last();
  const closeButton = dialog.getByRole("button", { name: "Close" });

  if (await closeButton.isVisible({ timeout: 1500 }).catch(() => false)) {
    await closeButton.click();
  } else {
    await page.keyboard.press("Escape");
  }

  await dialog.waitFor({ state: "hidden", timeout: 5000 }).catch(async () => {
    await page.keyboard.press("Escape");
    await delay(300);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
  });

  await page
    .locator('[data-state="open"][aria-hidden="true"]')
    .first()
    .waitFor({ state: "hidden", timeout: 2000 })
    .catch(() => {});

  await delay(500);
  console.log("  ✅ Chat report sheet closed");
}

/** Scroll the open report sheet until Service Recommendations / save controls are in view. */
export async function scrollReportSheetToServiceProviders(page: Page): Promise<void> {
  const sheetScroll = page.locator('[role="dialog"] div.overflow-y-auto').last();
  if (!(await sheetScroll.isVisible({ timeout: 3000 }).catch(() => false))) {
    return;
  }

  const serviceHeading = page.getByText("Service Recommendations", { exact: true }).last();
  if (await serviceHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
    await serviceHeading.scrollIntoViewIfNeeded();
    await delay(400);
    return;
  }

  console.log("  📜 Scrolling report sheet toward service providers...");
  const steps = 12;
  for (let step = 1; step <= steps; step++) {
    await sheetScroll.evaluate((el, ratio) => {
      const maxScroll = el.scrollHeight - el.clientHeight;
      el.scrollTop = maxScroll * ratio;
    }, step / steps);
    await delay(120);

    if (await serviceHeading.isVisible({ timeout: 300 }).catch(() => false)) {
      await serviceHeading.scrollIntoViewIfNeeded();
      break;
    }
  }

  await delay(400);
}

/** Save up to `minCount` unsaved service providers from the open report sheet. */
export async function saveProvidersFromReportSheet(
  page: Page,
  minCount = 3,
): Promise<number> {
  const opened = await openFullChatReportSheet(page);
  if (!opened) return 0;

  await scrollReportSheetToServiceProviders(page);

  const sheet = page.locator('[role="dialog"]').last();
  let savedCount = 0;

  while (savedCount < minCount) {
    const saveButtons = sheet
      .locator('[data-testid="save-service-provider"][aria-label="Save provider"]')
      .or(sheet.getByRole("button", { name: "Save provider", exact: true }));

    const available = await saveButtons.count();
    if (available === 0) {
      if (savedCount === 0) {
        console.log("  ⚠️  No saveable providers found in report sheet");
      } else {
        console.log(
          `  ⚠️  Only ${savedCount} provider(s) available (wanted ${minCount})`,
        );
      }
      break;
    }

    const button = saveButtons.first();
    if (!(await button.isVisible({ timeout: 5000 }).catch(() => false))) {
      break;
    }

    await button.scrollIntoViewIfNeeded();
    await delay(300);
    await button.click();
    savedCount++;
    console.log(`  ❤️  Saved provider ${savedCount}/${minCount}`);

    const savedToast = page.getByText("Saved provider", { exact: true });
    const alreadySavedToast = page.getByText("Already in saved providers", {
      exact: true,
    });
    await Promise.race([
      savedToast.waitFor({ state: "visible", timeout: 5000 }),
      alreadySavedToast.waitFor({ state: "visible", timeout: 5000 }),
    ]).catch(() => {
      console.log("  ⚠️  Save toast not detected; continuing...");
    });

    await delay(800);
  }

  if (savedCount >= minCount) {
    console.log(`  ✅ Saved ${savedCount} providers`);
  }

  return savedCount;
}

/** Open the Details tab and launch the My pros sheet. */
export async function navigateToDetailsAndOpenMyPros(page: Page): Promise<void> {
  if (!page.url().includes("/properties/")) {
    throw new Error("Not on a property page");
  }

  await closeFullChatReportSheet(page);

  const propertyId = page.url().match(/\/properties\/([^/]+)/)?.[1];
  if (!propertyId) {
    throw new Error("Could not resolve property id from URL");
  }

  if (!page.url().includes("/details")) {
    const detailsTab = page.locator(config.selectors.propertyDetails.detailsTab).first();
    const tabVisible = await detailsTab.isVisible({ timeout: 3000 }).catch(() => false);

    if (tabVisible) {
      await detailsTab.click({ force: false, timeout: 5000 }).catch(async () => {
        console.log("  ⚠️  Details tab click blocked; navigating directly...");
        await page.goto(`${config.baseUrl}/home/properties/${propertyId}/details`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
      });
      await page.waitForURL("**/details**", { timeout: 15000 }).catch(async () => {
        console.log("  ⚠️  Details tab navigation timed out; using direct URL...");
        await page.goto(`${config.baseUrl}/home/properties/${propertyId}/details`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
      });
    } else {
      await page.goto(`${config.baseUrl}/home/properties/${propertyId}/details`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    }
  }

  await delay(1500);

  const myProsCard = page
    .locator('[data-testid="my-pros-card"]')
    .first()
    .or(page.getByRole("button", { name: /My pros/i }).first());

  await myProsCard.waitFor({ state: "visible", timeout: 10000 });
  await myProsCard.scrollIntoViewIfNeeded();
  await delay(300);
  await myProsCard.click();

  const sheetTitle = page.getByRole("heading", { name: "My pros" });
  await sheetTitle.waitFor({ state: "visible", timeout: 8000 }).catch(() => {
    console.log("  ⚠️  My pros sheet title not visible");
  });

  await delay(1000);
  console.log("  ✅ My pros sheet opened");
}

/** In-flight agent status copy (keep in sync with apps/webapp/src/lib/agent-display.ts). */
const AGENT_LOADING_TEXT =
  /Working on it|Understanding your request|Analyzing your checkpoints|Writing your summary|Finishing your analysis|Loading your checkpoints|Thinking|Executing/i;

/** Accordion section titles from StructuredResponse (checkpoint + all optional branches). */
const STRUCTURED_CHECKPOINT_OPTIONAL_SECTION_LABELS = [
  "Coverage Analysis",
  "DIY Recommendations",
  "Service Recommendations",
  "Cost Estimates",
] as const;

function chatSendButtonLocator(page: Page) {
  return page.getByRole("button", { name: "Send message" });
}

function chatStopButtonLocator(page: Page) {
  return page.getByRole("button", { name: "Stop processing" });
}

/** Agent turn started: composer swaps Send for Stop. */
export async function waitForChatProcessingToStart(
  page: Page,
  timeoutMs = 15000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await chatStopButtonLocator(page).isVisible().catch(() => false)) {
      return true;
    }
    await delay(300);
  }
  return false;
}

/**
 * Agent turn finished: Stop is hidden and Send is back.
 * Note: Send may still be disabled when the textarea is empty after submit.
 */
export async function isChatComposerIdleAfterProcessing(page: Page): Promise<boolean> {
  if (await chatStopButtonLocator(page).isVisible().catch(() => false)) {
    return false;
  }
  return chatSendButtonLocator(page).isVisible().catch(() => false);
}

/** True when Send is visible and not disabled (requires non-empty input). */
export async function isChatSendButtonEnabled(page: Page): Promise<boolean> {
  const sendButton = chatSendButtonLocator(page).first();
  if (!(await sendButton.isVisible().catch(() => false))) {
    return false;
  }
  return sendButton.isEnabled().catch(() => false);
}

export async function hasAgentResponseLoading(page: Page): Promise<boolean> {
  const hasSpinner = (await page.locator("[class*='animate-spin']").count()) > 0;
  const hasStatusText = (await page.getByText(AGENT_LOADING_TEXT).count()) > 0;
  return hasSpinner || hasStatusText;
}

export function messageLooksLikeAgentLoading(text: string | null | undefined): boolean {
  if (!text || text.trim().length <= 10) return true;
  return AGENT_LOADING_TEXT.test(text);
}

/** Checkpoint-mode chat turn is done when summary copy appears and loaders are gone. */
export async function isCheckpointChatResponseComplete(
  page: Page,
  messageText: string,
): Promise<boolean> {
  if (messageLooksLikeAgentLoading(messageText)) return false;
  const onPage = await page
    .getByText(/Checkpoints Analyzed/i)
    .isVisible()
    .catch(() => false);
  return onPage || /Checkpoints Analyzed/i.test(messageText);
}

async function structuredCheckpointSummaryVisible(
  page: Page,
  messageText?: string | null,
): Promise<boolean> {
  if (/Checkpoints Analyzed/i.test(messageText ?? "")) return true;
  if (await page.getByText(/Checkpoints Analyzed/i).isVisible().catch(() => false)) {
    return true;
  }
  return page.getByText("Checkpoint Summary", { exact: true }).isVisible().catch(() => false);
}

async function structuredOptionalSectionVisible(
  page: Page,
  label: string,
): Promise<boolean> {
  return page
    .getByRole("button", { name: label })
    .first()
    .isVisible()
    .catch(() => false);
}

/**
 * Full checkpoint StructuredResponse turn (summary + optional branches + synthesis).
 * Matches apps/webapp StructuredResponse accordion titles and branch badges.
 */
export async function isFullStructuredCheckpointAnalysisComplete(
  page: Page,
  messageText?: string | null,
): Promise<boolean> {
  if (messageLooksLikeAgentLoading(messageText)) return false;
  if (await hasAgentResponseLoading(page)) return false;

  if (!(await structuredCheckpointSummaryVisible(page, messageText))) {
    return false;
  }

  for (const label of STRUCTURED_CHECKPOINT_OPTIONAL_SECTION_LABELS) {
    if (!(await structuredOptionalSectionVisible(page, label))) {
      return false;
    }
  }

  const synthesisVisible = await page
    .getByRole("button", { name: /Summary & Next Steps/i })
    .isVisible()
    .catch(() => false);
  if (!synthesisVisible) return false;

  const analyzingBranch = await page
    .getByText("Analyzing…", { exact: true })
    .isVisible()
    .catch(() => false);
  const pendingBranch = await page
    .getByText("Pending", { exact: true })
    .isVisible()
    .catch(() => false);
  return !analyzingBranch && !pendingBranch;
}

/** Enter checkpoint compare selection mode (feature tip or Compare toolbar button). */
export async function activateCheckpointCompareMode(page: Page): Promise<boolean> {
  const startCompare = page.locator('button:has-text("Start compare mode")').first();
  if (await startCompare.isVisible({ timeout: 2000 }).catch(() => false)) {
    await enhancedClick(page, startCompare);
    await delay(500);
    return true;
  }

  const compareButton = page
    .locator('button:has-text("Compare"), button:has([class*="ArrowRightLeft"])')
    .first();
  if (await compareButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await enhancedClick(page, compareButton);
    await delay(500);
    return true;
  }

  return false;
}
