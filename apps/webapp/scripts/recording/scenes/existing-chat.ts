import { Page } from "playwright";
import { config } from "../config";
import { SceneResult } from "../helpers";
import {
  delay,
  typeHumanLike,
  clickWithRetry,
  waitForVisible,
  scrollChatToEnd,
  findAccordions,
  processAllAccordions,
} from "../helpers";

export async function recordExistingChat(page: Page): Promise<SceneResult> {
  const startTime = Date.now();

  try {
    console.log("🎬 Scene 4: Existing Chat Session");

    // Ensure we're on a property chat page
    if (!page.url().includes("/properties/")) {
      throw new Error("Not on a property page");
    }

    // Navigate to chat tab if not already there
    if (!page.url().includes("/chat")) {
      try {
        const chatTab = page
          .locator(config.selectors.propertyDetails.chatTab)
          .first();
        if (await chatTab.isVisible()) {
          await chatTab.click();
          await page.waitForURL("**/chat**", { timeout: 5000 });
        }
      } catch (error) {
        // Try navigating directly
        const currentUrl = page.url();
        const propertyId = currentUrl.match(/\/properties\/([^\/]+)/)?.[1];
        if (propertyId) {
          await page.goto(
            `${config.baseUrl}/home/properties/${propertyId}/chat`,
            {
              waitUntil: "networkidle",
            }
          );
        }
      }
    }

    await page.waitForLoadState("networkidle");
    await delay(2000);

    // Step 1: Find and click an existing session from the sidebar
    console.log("  📋 Looking for existing chat session in sidebar...");
    try {
      // Get current session ID from URL
      const currentUrl = page.url();
      const currentSessionId = currentUrl.match(/\/chat\/([^\/\?]+)/)?.[1];

      // Wait for sidebar to be visible
      console.log("  ⏳ Waiting for sidebar to load...");
      await page.waitForSelector('aside', { timeout: 10000 }).catch(() => {
        console.log("  ⚠️  Sidebar not found after 10 seconds, continuing...");
      });

      // Wait for sessions to load - check for loading skeletons or actual sessions
      console.log("  ⏳ Waiting for sessions to load...");
      let sessionsLoaded = false;
      let waitCount = 0;
      const maxWaitCount = 20; // Wait up to 20 seconds

      while (!sessionsLoaded && waitCount < maxWaitCount) {
        waitCount++;
        
        // Check if loading skeletons are gone (sessions are loaded)
        const skeletons = await page.locator('[class*="Skeleton"]').all();
        const hasSkeletons = skeletons.length > 0 && await skeletons[0].isVisible().catch(() => false);
        
        // Check if we have session items in the sidebar
        const sessionItems = await page
          .locator('aside [role="button"][tabindex="0"]:has(svg), aside div[role="button"]:has([class*="group"]):has(svg)')
          .all();
        
        const visibleSessions = [];
        for (const item of sessionItems) {
          const isVisible = await item.isVisible({ timeout: 500 }).catch(() => false);
          if (isVisible) {
            visibleSessions.push(item);
          }
        }

        // If we have visible sessions and no loading skeletons (or skeletons are gone), sessions are loaded
        if (visibleSessions.length > 0 && !hasSkeletons) {
          sessionsLoaded = true;
          console.log(`  ✅ Found ${visibleSessions.length} session(s) loaded`);
          break;
        }

        // Also check for "No sessions yet" message - means loading is complete but no sessions
        const noSessionsMessage = await page
          .locator('text="No sessions yet"')
          .isVisible({ timeout: 500 })
          .catch(() => false);
        
        if (noSessionsMessage) {
          console.log("  ⚠️  No existing sessions found in sidebar");
          sessionsLoaded = true;
          break;
        }

        if (waitCount % 5 === 0) {
          console.log(`  ⏳ Still waiting for sessions to load... (${waitCount}s elapsed)`);
        }

        await delay(1000);
      }

      if (!sessionsLoaded) {
        console.log("  ⚠️  Sessions may still be loading, but continuing with search...");
      }

      await delay(1000); // Additional wait to ensure DOM is stable

      // Find all session items in the sidebar
      // Sessions are: div[role="button"][tabIndex="0"] with class "group flex items-center..." containing MessageSquare icon
      let sessionItem = null;
      let foundSession = false;

      console.log("  🔍 Searching for session items in sidebar...");
      
      // Strategy 1: Find sessions by structure - role="button", tabIndex="0", contains MessageSquare icon, in sidebar
      try {
        // Try multiple selectors to find session items
        const sessionSelectors = [
          'aside [role="button"][tabindex="0"]:has(svg)',
          'aside div[role="button"]:has([class*="group"]):has(svg)',
          'aside [role="button"]:has([class*="rounded-lg"]):has([class*="cursor-pointer"])',
          'aside [role="button"]:has-text("Chat")',
        ];

        let allSessionItems: any[] = [];

        for (const selector of sessionSelectors) {
          try {
            const items = await page.locator(selector).all();
            for (const item of items) {
              const isVisible = await item.isVisible({ timeout: 1000 }).catch(() => false);
              if (isVisible) {
                allSessionItems.push(item);
              }
            }
          } catch (error) {
            continue;
          }
        }

        // Remove duplicates by comparing element handles
        const uniqueSessionItems = [];
        const seenHandles = new Set();
        for (const item of allSessionItems) {
          try {
            const handle = await item.evaluateHandle((el: Element) => el);
            const handleString = handle.toString();
            if (!seenHandles.has(handleString)) {
              seenHandles.add(handleString);
              uniqueSessionItems.push(item);
            }
          } catch (error) {
            // If we can't get handle, still include it (might be different)
            uniqueSessionItems.push(item);
          }
        }

        console.log(`  📋 Found ${uniqueSessionItems.length} potential session item(s)`);

        for (const item of uniqueSessionItems) {
          try {
            // Verify it's in the sidebar (not in main content)
            const isInSidebar = await item.evaluate((el: Element) => {
              let parent = el.parentElement;
              let depth = 0;
              while (parent && depth < 15) {
                const tagName = parent.tagName || "";
                const classList = parent.classList?.toString() || "";
                if (tagName === "ASIDE" || classList.includes("sidebar") || classList.includes("session-sidebar")) {
                  return true;
                }
                if (tagName === "MAIN") {
                  return false; // Not in sidebar
                }
                parent = parent.parentElement;
                depth++;
              }
              return false;
            }).catch(() => false);

            if (!isInSidebar) {
              continue; // Skip items not in sidebar
            }

            // Check if it has session-like content (MessageSquare icon and text)
            const hasSessionContent = await item.evaluate((el: Element) => {
              const text = el.textContent?.trim() || "";
              const hasIcon = el.querySelector('svg') !== null;
              // Check if text looks like a session name (not empty, not just "Chat")
              const hasValidText = text.length > 3 && !text.toLowerCase().includes("no sessions");
              return (hasIcon && hasValidText) || (hasIcon && text.length > 0);
            }).catch(() => false);

            if (!hasSessionContent) {
              continue; // Skip items without session content
            }

            // Check if it's the currently active session
            const isActive = await item.evaluate((el: Element) => {
              const classList = el.classList?.toString() || "";
              return classList.includes("bg-sidebar-accent") || 
                     classList.includes("bg-accent") ||
                     classList.includes("bg-primary");
            }).catch(() => false);

            // Get session name for logging
            const sessionName = await item.evaluate((el: Element) => {
              const text = el.textContent?.trim() || "";
              return text.split('\n')[0]; // Get first line (session name)
            }).catch(() => "Unknown");

            console.log(`  📝 Found session: "${sessionName}" (active: ${isActive})`);

            // Priority 1: Look for session with "DoorPaintDamage" in name
            if (sessionName.toLowerCase().includes("doorpaintdamage")) {
              sessionItem = item;
              foundSession = true;
              console.log(`  ✅ Selected session with DoorPaintDamage: "${sessionName}"`);
              break;
            }
          } catch (error) {
            console.log(`  ⚠️  Error processing session item: ${error instanceof Error ? error.message : String(error)}`);
            continue;
          }
        }

        // If we still haven't found DoorPaintDamage session, try to find it in remaining sessions
        if (!foundSession && uniqueSessionItems.length > 0) {
          console.log("  🔍 Looking for session with DoorPaintDamage in name...");
          for (const item of uniqueSessionItems) {
            try {
              const sessionName = await item.evaluate((el: Element) => {
                return el.textContent?.trim() || "Unknown";
              }).catch(() => "Unknown");

              if (sessionName.toLowerCase().includes("doorpaintdamage")) {
                sessionItem = item;
                foundSession = true;
                console.log(`  ✅ Selected session with DoorPaintDamage: "${sessionName}"`);
                break;
              }
            } catch (error) {
              continue;
            }
          }
        }

        // If still not found, try to find active session
        if (!foundSession && uniqueSessionItems.length > 0) {
          console.log("  🔍 DoorPaintDamage session not found, selecting active session...");
          for (const item of uniqueSessionItems) {
            try {
              const isActive = await item.evaluate((el: Element) => {
                const classList = el.classList?.toString() || "";
                return classList.includes("bg-sidebar-accent") || 
                       classList.includes("bg-accent") ||
                       classList.includes("bg-primary");
              }).catch(() => false);

              if (isActive) {
                const sessionName = await item.evaluate((el: Element) => {
                  return el.textContent?.trim() || "Unknown";
                }).catch(() => "Unknown");

                sessionItem = item;
                foundSession = true;
                console.log(`  ✅ Selected active session: "${sessionName}"`);
                break;
              }
            } catch (error) {
              continue;
            }
          }
          
          // If still no active session found, select the first one
          if (!foundSession) {
            console.log("  🔍 No active session found, selecting first available session...");
            try {
              const firstItem = uniqueSessionItems[0];
              const sessionName = await firstItem.evaluate((el: Element) => {
                return el.textContent?.trim() || "Unknown";
              }).catch(() => "Unknown");
              sessionItem = firstItem;
              foundSession = true;
              console.log(`  ✅ Selected first session: "${sessionName}"`);
            } catch (error) {
              console.log(`  ⚠️  Could not select session: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      } catch (error) {
        console.log(`  ⚠️  Error finding sessions: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Strategy 2: Fallback - use page.evaluate to find sessions directly in DOM
      if (!foundSession) {
        console.log("  🔍 Trying alternative DOM-based approach to find sessions...");
        try {
          const sessionData = await page.evaluate(() => {
            // Find all divs with role="button" in aside elements
            const aside = document.querySelector('aside');
            if (!aside) return null;

            const allButtons = Array.from(aside.querySelectorAll('div[role="button"][tabindex="0"]'));
            const sessionButtons = allButtons
              .map((el, originalIndex) => {
                // Check if it has MessageSquare icon and text (session item)
                const hasIcon = el.querySelector('svg') !== null;
                const text = el.textContent?.trim() || "";
                const hasValidText = text.length > 3 && !text.toLowerCase().includes("no sessions");
                
                if (hasIcon && hasValidText) {
                  const classList = el.classList?.toString() || "";
                  const isActive = classList.includes("bg-sidebar-accent") || 
                                 classList.includes("bg-accent") ||
                                 classList.includes("bg-primary");
                  return {
                    isActive,
                    text: text.split('\n')[0] || text.substring(0, 50),
                    index: originalIndex,
                  };
                }
                return null;
              })
              .filter((s): s is { index: number; isActive: boolean; text: string } => s !== null);

            return sessionButtons.length > 0 ? sessionButtons : null;
          });

          if (sessionData && sessionData.length > 0) {
            console.log(`  📋 Found ${sessionData.length} session(s) via DOM query:`);
            sessionData.forEach((s, i) => {
              console.log(`    ${i + 1}. "${s.text}" (active: ${s.isActive}, index: ${s.index})`);
            });

            // Determine which session to select - prioritize DoorPaintDamage session
            let sessionToSelect: { text: string; index: number } | null = null;

            // Strategy 1: Find session with "DoorPaintDamage" in name
            const doorPaintDamageSession = sessionData.find((s) => 
              s.text.toLowerCase().includes("doorpaintdamage")
            );
            if (doorPaintDamageSession) {
              sessionToSelect = { text: doorPaintDamageSession.text, index: doorPaintDamageSession.index };
              console.log(`  🎯 Strategy: Selecting session with DoorPaintDamage: "${sessionToSelect.text}"`);
            } else {
              // Strategy 2: Find first active session
              const activeSession = sessionData.find((s) => s.isActive);
              if (activeSession) {
                sessionToSelect = { text: activeSession.text, index: activeSession.index };
                console.log(`  🎯 Strategy: No DoorPaintDamage session found, selecting active session: "${sessionToSelect.text}"`);
              } else if (sessionData.length > 0) {
                // No active session found, select the first one
                sessionToSelect = { text: sessionData[0].text, index: sessionData[0].index };
                console.log(`  🎯 Strategy: No active session found, selecting first session: "${sessionToSelect.text}"`);
              }
            }

            // Actually select the session - prefer text-based selection over index
            if (sessionToSelect) {
              console.log(`  🔍 Locating session: "${sessionToSelect.text}"...`);
              
              // Strategy: Use text-based selector first (more reliable)
              try {
                // Clean up the text for selector (take first line, remove special chars)
                const cleanText = sessionToSelect.text.trim().split('\n')[0].replace(/["']/g, "").substring(0, 50);
                console.log(`  🔍 Trying to find session by text: "${cleanText}"...`);
                
                // Try exact text match first
                const sessionByText = page.locator(`aside div[role="button"][tabindex="0"]:has-text("${cleanText}")`).first();
                const isVisible = await sessionByText.isVisible({ timeout: 3000 }).catch(() => false);
                
                if (isVisible) {
                  sessionItem = sessionByText;
                  foundSession = true;
                  console.log(`  ✅ Found session by text selector: "${sessionToSelect.text}"`);
                } else {
                  // Fallback: Get all buttons and find by text content
                  console.log(`  🔄 Text selector not visible, trying text content match...`);
                  const allSessionButtons = await page.locator(`aside div[role="button"][tabindex="0"]`).all();
                  console.log(`  📊 Total session buttons found: ${allSessionButtons.length}`);
                  
                  for (const button of allSessionButtons) {
                    try {
                      const buttonText = await button.textContent().catch(() => "");
                      if (buttonText && (
                        buttonText.includes(cleanText.substring(0, 20)) ||
                        cleanText.includes(buttonText.trim().split('\n')[0].substring(0, 20))
                      )) {
                        const isVisible = await button.isVisible({ timeout: 2000 }).catch(() => false);
                        if (isVisible) {
                          sessionItem = button;
                          foundSession = true;
                          console.log(`  ✅ Found session by text content match: "${sessionToSelect.text}"`);
                          break;
                        }
                      }
                    } catch (error) {
                      continue;
                    }
                  }
                  
                  // If still not found by text, try by index as last resort
                  if (!foundSession && allSessionButtons.length > sessionToSelect.index) {
                    console.log(`  🔄 Trying index-based selection as fallback (index: ${sessionToSelect.index})...`);
                    const targetButton = allSessionButtons[sessionToSelect.index];
                    const isVisible = await targetButton.isVisible({ timeout: 2000 }).catch(() => false);
                    if (isVisible) {
                      sessionItem = targetButton;
                      foundSession = true;
                      console.log(`  ✅ Found session by index: "${sessionToSelect.text}"`);
                    }
                  }
                }
              } catch (error) {
                console.log(`  ⚠️  Text-based selection failed: ${error instanceof Error ? error.message : String(error)}`);
              }
            } else {
              console.log(`  ⚠️  Could not determine which session to select`);
              // Final fallback: just select the first session from the list
              if (sessionData.length > 0) {
                console.log(`  🔄 Final fallback: selecting first session from list...`);
                const firstSessionData = sessionData[0];
                const cleanText = firstSessionData.text.trim().split('\n')[0].replace(/["']/g, "").substring(0, 50);
                
                try {
                  const sessionByText = page.locator(`aside div[role="button"][tabindex="0"]:has-text("${cleanText}")`).first();
                  const isVisible = await sessionByText.isVisible({ timeout: 2000 }).catch(() => false);
                  if (isVisible) {
                    sessionItem = sessionByText;
                    foundSession = true;
                    console.log(`  ✅ Selected first session via text selector: "${firstSessionData.text}"`);
                  } else {
                    // Last resort: just get first button
                    const allSessionButtons = await page.locator(`aside div[role="button"][tabindex="0"]`).all();
                    if (allSessionButtons.length > 0) {
                      const firstButton = allSessionButtons[0];
                      const isVisible = await firstButton.isVisible({ timeout: 2000 }).catch(() => false);
                      if (isVisible) {
                        sessionItem = firstButton;
                        foundSession = true;
                        console.log(`  ✅ Selected first button as final fallback`);
                      }
                    }
                  }
                } catch (error) {
                  console.log(`  ⚠️  Final fallback also failed: ${error instanceof Error ? error.message : String(error)}`);
                }
              }
            }
          }
        } catch (error) {
          console.log(`  ⚠️  DOM-based approach failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (foundSession && sessionItem) {
        console.log("  ✅ Found existing session, attempting to click...");
        try {
          // Get session name before clicking for logging
          const sessionName = await sessionItem.textContent().catch(() => "Unknown");
          console.log(`  🎯 About to click on session: "${sessionName?.substring(0, 50) || 'Unknown'}"`);
          
          // Ensure element is visible and clickable
          await sessionItem.scrollIntoViewIfNeeded();
          await delay(400);
          
          // Hover first to ensure it's interactive
          await sessionItem.hover({ timeout: 2000 }).catch(() => {
            console.log("  ⚠️  Could not hover on session, continuing...");
          });
          await delay(200);
          
          // Click the session
          await sessionItem.click({ timeout: 3000 });
          console.log("  ✅ Clicked on session");
          await delay(1500); // Wait for navigation and chat to load

          // Wait for URL to change (session ID should be different)
          await page.waitForLoadState("networkidle");
          await delay(2000);
          
          const newUrl = page.url();
          if (newUrl !== currentUrl) {
            console.log(`  ✅ Navigated to session: ${newUrl}`);
          } else {
            console.log("  ⚠️  URL did not change, but continuing...");
          }
        } catch (error) {
          console.log(`  ⚠️  Error clicking session: ${error instanceof Error ? error.message : String(error)}`);
          console.log("  🔄 Trying alternative click method...");
          
          // Alternative: Try clicking by text content
          try {
            const sessionName = await sessionItem.textContent().catch(() => "");
            if (sessionName) {
              const sessionText = sessionName.trim().split('\n')[0] || sessionName.substring(0, 30);
              console.log(`  🔍 Trying to find and click session by text: "${sessionText}"`);
              
              const sessionByText = page.locator(`aside div[role="button"]:has-text("${sessionText}")`).first();
              const isVisible = await sessionByText.isVisible({ timeout: 2000 }).catch(() => false);
              
              if (isVisible) {
                await sessionByText.scrollIntoViewIfNeeded();
                await delay(400);
                await sessionByText.click({ timeout: 3000 });
                console.log(`  ✅ Clicked session by text: "${sessionText}"`);
                await delay(1500);
                await page.waitForLoadState("networkidle");
                await delay(2000);
              }
            }
          } catch (error2) {
            console.log(`  ⚠️  Alternative click method also failed: ${error2 instanceof Error ? error2.message : String(error2)}`);
            console.log("  ℹ️  Continuing with current session...");
          }
        }
      } else {
        console.log("  ⚠️  No existing session found or could not select one, using current session...");
        console.log("  ℹ️  This session may not have any other sessions, or they may still be loading.");
      }
    } catch (error) {
      console.log(
        `  ⚠️  Could not find/click existing session: ${error instanceof Error ? error.message : String(error)}`
      );
      console.log("  ℹ️  Continuing with current session...");
    }

    // Step 2: Wait for chat messages to load
    console.log("  ⏳ Waiting for chat messages to load...");
    await page.waitForLoadState("networkidle");
    await delay(2000);

    // Step 3: Find and expand accordions (similar to AI Chat scene)
    console.log("  🔍 Looking for accordion messages in the conversation...");

    // Wait for accordions to be visible
    let accordionsFound = false;
    const accordionWaitStart = Date.now();
    let checkCount = 0;

    // Wait up to 30 seconds for accordions
    while (!accordionsFound && (Date.now() - accordionWaitStart) < 30000) {
      try {
        checkCount++;
        const elapsedSeconds = ((Date.now() - accordionWaitStart) / 1000).toFixed(0);

        if (checkCount % 3 === 0) {
          console.log(`  ⏳ Still waiting for accordions... (${elapsedSeconds}s elapsed)`);
        }

        // Look for accordions in assistant messages
        const allAccordionTriggers = await page
          .locator(
            '[class*="AccordionTrigger"]:visible, button[aria-expanded]:visible, [role="button"][aria-expanded]:visible'
          )
          .all();

        if (allAccordionTriggers.length > 0) {
          // Verify they're in assistant messages, not user messages or sidebar
          for (const trigger of allAccordionTriggers) {
            const isVisible = await trigger.isVisible({ timeout: 500 }).catch(() => false);
            if (!isVisible) continue;

            const isInAssistantMessage = await trigger
              .evaluate((el) => {
                let parent = el.parentElement;
                let depth = 0;
                let foundSidebar = false;
                let foundUserMessage = false;

                while (parent && depth < 15) {
                  const classList = parent.classList?.toString() || "";
                  const tagName = parent.tagName || "";

                  if (tagName === "ASIDE" || classList.includes("sidebar")) {
                    foundSidebar = true;
                    break;
                  }

                  if (
                    classList.includes("bg-secondary") &&
                    (classList.includes("self-end") || classList.includes("justify-end"))
                  ) {
                    foundUserMessage = true;
                    break;
                  }

                  parent = parent.parentElement;
                  depth++;
                }

                return !foundSidebar && !foundUserMessage;
              })
              .catch(() => true);

            if (isInAssistantMessage) {
              accordionsFound = true;
              const totalElapsed = ((Date.now() - accordionWaitStart) / 1000).toFixed(1);
              console.log(`  ✅ Found accordion(s) (after ${totalElapsed}s)`);
              break;
            }
          }
        }

        if (accordionsFound) break;

        await delay(1000);
      } catch (error) {
        await delay(1000);
      }
    }

    if (!accordionsFound) {
      console.log("  ⚠️  No accordions found in this session, skipping accordion expansion...");
      const duration = Date.now() - startTime;
      return {
        success: true,
        duration,
      };
    }

    // Step 4: Find all accordions and process them one by one (expand, scroll, collapse)
    console.log("  📂 Processing accordions one by one...");

    try {
      // Use common helper function to process all accordions
      await processAllAccordions(page, {
        order: ["triage", "coverage", "diy", "service", "cost-estimates"],
        collapseAfterScroll: true,
        waitAfterExpand: 2000,
        waitAfterScroll: 1000,
      });
    } catch (error) {
      console.log(
        `  ⚠️  Error handling accordions: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Ensure scene runs for at least 15 seconds
    const elapsedTime = Date.now() - startTime;
    const minDuration = 15000;
    if (elapsedTime < minDuration) {
      const remainingTime = minDuration - elapsedTime;
      console.log(
        `  ⏸️  Waiting for minimum duration (${(remainingTime / 1000).toFixed(1)}s remaining)...`
      );
      await delay(remainingTime);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Scene 4 completed in ${(duration / 1000).toFixed(1)}s`);

    return {
      success: true,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Scene 4 failed:", error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
