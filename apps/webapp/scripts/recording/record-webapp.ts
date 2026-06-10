import { chromium, Browser, BrowserContext, Page } from "playwright";
import { config } from "./config";
import { ensureOutputDir, authenticate, saveSession, delay } from "./helpers";
import { recordLandingPage } from "./scenes/landing-page";
import { recordLogin } from "./scenes/login";
import { recordDashboard } from "./scenes/dashboard";
import { recordTimelineCheckpoint } from "./scenes/timeline-checkpoint";
import { recordTimelineCompare } from "./scenes/timeline-compare";
import { recordTimelineInsights } from "./scenes/timeline-insights";
import { recordTimelineReports } from "./scenes/timeline-reports";
import { recordCheckpointChat } from "./scenes/checkpoint-chat";
import { recordPropertyDetails } from "./scenes/property-details";
import { recordPropertyOnboarding } from "./scenes/property-onboarding";
import { ZoomTracker } from "./zoom-tracker";
import { applyZoomEffects } from "./zoom-processor";
import {
  applyWaitCut,
  applyWaitCuts,
  type WaitCutSegment,
} from "./cut-processor";
import * as path from "path";
import * as readline from "readline";
import * as fs from "fs";

// Narration text for each scene (max 500 characters)
const narrationTexts: Record<string, string> = {
  "Landing Page":
    "Welcome to AssetMem AI. Explore use cases, an integrated platform with timeline checkpoints, document chat, and My pros. Generate shareable PDF reports for showings, move-in/out, and insurance claims. Meet specialized AI agents, see timeline tracking, docs chat for inspection reports, and transparent pricing — all in one home care platform.",
  Login:
    "Access your personalized AssetMem AI dashboard with secure authentication. Once logged in, you'll unlock a world of intelligent home maintenance tools, from AI-powered diagnostics to comprehensive property tracking. Your journey to smarter home management begins here.",
  "Property Onboarding":
    "Watch how easy it is to add a new property to your account! Simply click 'Add New Property', select your property type, and upload documents like inspection reports, insurance papers, or property photos. Our AI instantly analyzes your documents, extracts key information like property address, and creates your property profile automatically. Within seconds, your property is ready for AI-powered maintenance assistance.",
  Dashboard:
    "Your command center awaits! The dashboard provides a comprehensive overview of all your properties.",
  "Timeline Checkpoint":
    "Create a comprehensive checkpoint to document your property's current condition. Capture detailed photos, add descriptions, and record specific locations. This powerful feature enables you to track changes over time, identify maintenance needs, and build a complete history of your property's condition. Perfect for inspections, before-and-after comparisons, and long-term maintenance planning.",
  "Timeline Compare":
    "Witness the power of side-by-side comparison! Select multiple checkpoints and watch our AI analyze the differences between them. The system highlights changes, detects deterioration, and provides intelligent insights about what's improved or needs attention. This visual comparison tool helps you make informed decisions about maintenance priorities and track property condition evolution over time.",
  "Timeline Insights":
    "Explore the insights dashboard, where data transforms into actionable intelligence. View comprehensive metrics, trends, and analytics about your property's condition. See patterns emerge, identify areas requiring attention, and gain predictive insights.",
  "Timeline Reports":
    "Turn checkpoint photos into branded PDF reports. Pick a purpose — showing snapshot, move-in/move-out comparison, or insurance documentation — preview sections and layout, then download or share a frozen-in-time report your contractors and adjusters can trust.",
  "Checkpoint Chat":
    "Engage with our AI assistant to get instant answers about your checkpoints. Simply ask questions like 'What checkpoints do I have?' or 'What's their current status?' and watch as the AI provides detailed, contextual responses. The assistant understands your property's history, analyzes checkpoint data, and delivers intelligent insights tailored to your specific situation.",
  Details:
    "Navigate to the property details section, your comprehensive information hub. Manage files, review history, and access everything you need to maintain complete control over your property's documentation and records. Ready to transform how you manage your home? Get started at asset-mem.com. Thank you for watching!",
};

/**
 * Prompts the user to select which scenes to record
 * @returns Promise<Set<string>> - Set of selected scene names
 */
function promptSceneSelection(): Promise<Set<string>> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n📋 Select scenes to record:");
    console.log("  1. Landing Page");
    console.log("  2. Property Onboarding (Add New Property)");
    console.log("  3. Timeline Checkpoint (Create Checkpoint)");
    console.log("  4. Timeline Compare (Compare Checkpoints)");
    console.log("  5. Timeline Insights (View Insights Dashboard)");
    console.log("  6. Checkpoint Chat (Ask about checkpoints)");
    console.log("  7. Timeline Reports (PDF report wizard)");
    console.log("  8. Details (Property Details)");
    console.log("  9. All of the above");
    console.log(
      "\nEnter scene numbers (comma-separated, e.g., 1,2,3 or 9 for all):",
    );

    rl.question("> ", (answer) => {
      rl.close();

      const selected = new Set<string>();
      const input = answer.trim().toLowerCase();

      if (input === "9" || input === "all") {
        selected.add("Landing Page");
        selected.add("Property Onboarding");
        selected.add("Timeline Checkpoint");
        selected.add("Timeline Compare");
        selected.add("Timeline Insights");
        selected.add("Checkpoint Chat");
        selected.add("Timeline Reports");
        selected.add("Details");
      } else {
        // Parse comma-separated numbers
        const numbers = input.split(",").map((n) => n.trim());
        for (const num of numbers) {
          switch (num) {
            case "1":
              selected.add("Landing Page");
              break;
            case "2":
              selected.add("Property Onboarding");
              break;
            case "3":
              selected.add("Timeline Checkpoint");
              break;
            case "4":
              selected.add("Timeline Compare");
              break;
            case "5":
              selected.add("Timeline Insights");
              break;
            case "6":
              selected.add("Checkpoint Chat");
              break;
            case "7":
              selected.add("Timeline Reports");
              break;
            case "8":
              selected.add("Details");
              break;
            case "9":
              selected.add("Landing Page");
              selected.add("Property Onboarding");
              selected.add("Timeline Checkpoint");
              selected.add("Timeline Compare");
              selected.add("Timeline Insights");
              selected.add("Checkpoint Chat");
              selected.add("Timeline Reports");
              selected.add("Details");
              break;
          }
        }
      }

      resolve(selected);
    });
  });
}

async function main() {
  console.log("🎬 Starting Webapp Recording");
  console.log("═══════════════════════════════════════\n");

  // Prompt user to select scenes to record BEFORE launching browser
  const selectedScenes = await promptSceneSelection();

  if (selectedScenes.size === 0) {
    console.log("\n⚠️  No scenes selected. Exiting...");
    return;
  }

  console.log(`\n✅ Selected scenes: ${Array.from(selectedScenes).join(", ")}`);
  console.log(
    "\n📝 Note: Login (and Dashboard if needed) will run automatically as prerequisites\n",
  );

  const zoomEnabled =
    process.argv.includes("--zoom") || config.zoomEffects.enabled;
  if (zoomEnabled) {
    console.log("🔍 Click zoom post-processing: enabled\n");
  } else {
    console.log(
      "⏭️  Click zoom post-processing: disabled (pass --zoom or set RECORDING_ZOOM_ENABLED=true to enable)\n",
    );
  }

  ensureOutputDir();

  // Generate timestamp for file names
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5); // Format: YYYY-MM-DDTHH-MM-SS
  const videoFileName = `webapp-recording-${timestamp}.webm`;
  const narrationFileName = `narration-data-${timestamp}.json`;
  const videoPath = path.join(config.outputDir, videoFileName);

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let zoomTracker: ZoomTracker | null = null;

  try {
    // Launch browser with video recording
    console.log("🚀 Launching browser...");
    browser = await chromium.launch({
      headless: false, // Show browser for recording
      slowMo: 250, // Increased slowMo (250ms) for more visible and deliberate actions in demo
    });

    // Create context with video recording enabled
    console.log(`  📹 Video will be saved as: ${videoFileName}`);
    context = await browser.newContext({
      viewport: {
        width: config.videoSettings.width,
        height: config.videoSettings.height,
      },
      recordVideo: {
        dir: config.outputDir,
        size: {
          width: config.videoSettings.width,
          height: config.videoSettings.height,
        },
      },
      // Use realistic user agent
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      // Disable touch for better mouse visibility
      hasTouch: false,
    });

    // Inject CSS and JavaScript for enhanced click indicators on all pages
    console.log(
      "  🎨 Injecting CSS and JS for enhanced click UX (applies to all pages)...",
    );

    // Set dark theme immediately via init script (before page loads)
    // This prevents the flash of light theme before next-themes hydrates
    await context.addInitScript(() => {
      // Set theme in localStorage before page loads
      if (typeof Storage !== "undefined") {
        localStorage.setItem("theme", "dark");
      }
      // Apply dark class immediately to prevent flash
      if (document.documentElement) {
        document.documentElement.classList.add("dark");
        document.documentElement.setAttribute("data-theme", "dark");
      }
    });

    // CSS for enhanced cursor and click indicators
    const clickIndicatorCSS = `*{cursor:url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='12' fill='%233b82f6' opacity='0.9' stroke='white' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='4' fill='white'/%3E%3C/svg%3E") 16 16,auto !important}.playwright-click-indicator{position:fixed;width:40px;height:40px;border:4px solid #3b82f6;border-radius:50%;pointer-events:none;z-index:99999;transform:translate(-50%,-50%);animation:clickPulse .8s ease-out forwards;box-shadow:0 0 20px rgba(59,130,246,.6)}@keyframes clickPulse{0%{transform:translate(-50%,-50%) scale(.6);opacity:1;border-width:4px}50%{transform:translate(-50%,-50%) scale(1.2);opacity:.8;border-width:3px}100%{transform:translate(-50%,-50%) scale(1.8);opacity:0;border-width:2px}}.playwright-hover-indicator{position:fixed;width:30px;height:30px;border:3px solid #10b981;border-radius:50%;pointer-events:none;z-index:99998;transform:translate(-50%,-50%);opacity:.7;box-shadow:0 0 15px rgba(16,185,129,.5);transition:opacity .2s ease}`;

    await context.addInitScript((css) => {
      const style = document.createElement("style");
      style.textContent = css;
      if (document.head) {
        document.head.appendChild(style);
      } else {
        document.addEventListener("DOMContentLoaded", () => {
          if (document.head) document.head.appendChild(style);
        });
      }
    }, clickIndicatorCSS);

    // Add JavaScript to show click indicators on mouse clicks (applies to all pages)
    await context.addInitScript(() => {
      // Wait for DOM to be ready
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initClickIndicators);
      } else {
        initClickIndicators();
      }

      function initClickIndicators() {
        // Create click indicator element
        const clickIndicator = document.createElement("div");
        clickIndicator.className = "playwright-click-indicator";
        clickIndicator.style.display = "none";
        document.body.appendChild(clickIndicator);

        // Create hover indicator element
        const hoverIndicator = document.createElement("div");
        hoverIndicator.className = "playwright-hover-indicator";
        hoverIndicator.style.display = "none";
        document.body.appendChild(hoverIndicator);

        // Track mouse position
        let mouseX = 0;
        let mouseY = 0;

        document.addEventListener("mousemove", (e) => {
          mouseX = e.clientX;
          mouseY = e.clientY;
          hoverIndicator.style.left = mouseX + "px";
          hoverIndicator.style.top = mouseY + "px";
        });

        // Show click indicator on click
        document.addEventListener("click", (e) => {
          clickIndicator.style.left = e.clientX + "px";
          clickIndicator.style.top = e.clientY + "px";
          clickIndicator.style.display = "block";
          clickIndicator.style.animation = "none";
          // Trigger reflow to restart animation
          void clickIndicator.offsetWidth;
          clickIndicator.style.animation = "clickPulse 0.8s ease-out forwards";

          // Hide after animation
          setTimeout(() => {
            clickIndicator.style.display = "none";
          }, 800);
        });

        // Show hover indicator on interactive elements
        document.addEventListener("mouseover", (e) => {
          const target = e.target;
          if (
            target &&
            (target.tagName === "BUTTON" ||
              target.tagName === "A" ||
              target.onclick !== null ||
              target.closest("button") !== null ||
              target.closest("a") !== null ||
              target.getAttribute("role") === "button")
          ) {
            hoverIndicator.style.display = "block";
            hoverIndicator.style.left = mouseX + "px";
            hoverIndicator.style.top = mouseY + "px";
            hoverIndicator.style.opacity = "0.7";
          }
        });

        document.addEventListener("mouseout", () => {
          hoverIndicator.style.opacity = "0";
          setTimeout(() => {
            hoverIndicator.style.display = "none";
          }, 200);
        });
      }
    });

    page = await context.newPage();
    console.log(
      "  ✅ CSS and click indicators injected (applies to all pages)",
    );

    // Initialize zoom tracker for Cursorful-style zoom effects (optional)
    if (zoomEnabled) {
      zoomTracker = new ZoomTracker();
      const recordingContext = context;

      // Track clicks using DOM event listeners (captures both Playwright and user clicks)
      // Playwright's page.click() dispatches real DOM click events, which we capture here
      await context.addInitScript((startTime: number) => {
        // Store start time for reference
        (window as any).__zoomTrackerStartTime = startTime;

        // Store click events in a global array that Playwright can read later
        (window as any).__zoomTrackerClicks =
          (window as any).__zoomTrackerClicks || [];

        // Track all click events in the page (captures programmatic clicks from Playwright too)
        document.addEventListener(
          "click",
          (event: MouseEvent) => {
            const clickData = {
              x: event.clientX,
              y: event.clientY,
              time: Date.now() - (window as any).__zoomTrackerStartTime,
            };
            (window as any).__zoomTrackerClicks.push(clickData);
          },
          true,
        ); // Use capture phase to catch all clicks
      }, Date.now());

      // Periodically read click events from all pages and track them
      const clickSyncInterval = setInterval(async () => {
        try {
          const pages = recordingContext.pages();
          for (const page of pages) {
            try {
              const clicks = await page.evaluate(() => {
                const clicks = (window as any).__zoomTrackerClicks || [];
                // Clear the array after reading to avoid duplicates
                (window as any).__zoomTrackerClicks = [];
                return clicks;
              });

              for (const click of clicks) {
                zoomTracker!.trackClick(click.x, click.y);
              }
            } catch (error) {
              // Page might be closed, ignore
            }
          }
        } catch (error) {
          // Context might be closed, ignore
        }
      }, 500); // Sync every 500ms

      // Store interval ID for cleanup
      (context as any).__zoomTrackerInterval = clickSyncInterval;
    }

    // Build scenes array with prerequisites first
    const scenes: Array<{ name: string; fn: () => Promise<any> }> = [];

    // Landing Page is optional - only add if selected
    if (selectedScenes.has("Landing Page")) {
      scenes.push({ name: "Landing Page", fn: () => recordLandingPage(page!) });
    }

    // Login is needed for authenticated scenes
    const scenesNeedingLogin = [
      "Property Onboarding",
      "Timeline Checkpoint",
      "Timeline Compare",
      "Timeline Insights",
      "Checkpoint Chat",
      "Timeline Reports",
      "Details",
    ];
    const hasScenesNeedingLogin = scenesNeedingLogin.some((sceneName) =>
      selectedScenes.has(sceneName),
    );

    // Add Login when later scenes require authentication
    if (hasScenesNeedingLogin) {
      scenes.push({ name: "Login", fn: () => recordLogin(page!, context!) });
    }

    // Property Onboarding only needs Landing Page and Login (it navigates to dashboard itself)
    // Add it right after Login if selected
    if (selectedScenes.has("Property Onboarding")) {
      scenes.push({
        name: "Property Onboarding",
        fn: () => recordPropertyOnboarding(page!),
      });
    }

    // Dashboard is needed for other scenes (but not for Property Onboarding)
    // Only add Dashboard if there are other scenes that need it
    const scenesNeedingDashboard = [
      "Timeline Checkpoint",
      "Timeline Compare",
      "Timeline Insights",
      "Checkpoint Chat",
      "Timeline Reports",
      "Details",
    ];
    const hasScenesNeedingDashboard = scenesNeedingDashboard.some((sceneName) =>
      selectedScenes.has(sceneName),
    );

    if (hasScenesNeedingDashboard) {
      scenes.push({ name: "Dashboard", fn: () => recordDashboard(page!) });
    }

    // Add selected scenes in order (excluding Property Onboarding which was already added)
    // Order: Timeline Checkpoint -> Timeline Compare -> Timeline Insights -> Checkpoint Chat -> Details
    // Timeline Checkpoint should run BEFORE Timeline Compare if both are selected
    // Timeline Compare should run BEFORE Timeline Insights
    // Timeline Insights should run AFTER Timeline Compare
    // Checkpoint Chat should run AFTER Timeline Insights
    // Details should run AFTER Checkpoint Chat
    if (selectedScenes.has("Timeline Checkpoint")) {
      scenes.push({
        name: "Timeline Checkpoint",
        fn: () => recordTimelineCheckpoint(page!),
      });
    }
    if (selectedScenes.has("Timeline Compare")) {
      scenes.push({
        name: "Timeline Compare",
        fn: () => recordTimelineCompare(page!),
      });
    }
    if (selectedScenes.has("Timeline Insights")) {
      scenes.push({
        name: "Timeline Insights",
        fn: () => recordTimelineInsights(page!),
      });
    }
    if (selectedScenes.has("Timeline Reports")) {
      scenes.push({
        name: "Timeline Reports",
        fn: () => recordTimelineReports(page!),
      });
    }
    if (selectedScenes.has("Checkpoint Chat")) {
      scenes.push({
        name: "Checkpoint Chat",
        fn: () => recordCheckpointChat(page!),
      });
    }
    if (selectedScenes.has("Details")) {
      scenes.push({
        name: "Details",
        fn: () => recordPropertyDetails(page!),
      });
    }

    const results: Array<{ name: string; result: any }> = [];
    const sceneData: Array<{
      name: string;
      startTime: number;
      duration: number;
      narration: string;
    }> = [];

    const recordingStartTime = Date.now();

    for (const scene of scenes) {
      console.log(`\n${"─".repeat(50)}`);
      const sceneStartTime = (Date.now() - recordingStartTime) / 1000; // in seconds
      const result = await scene.fn();

      const sceneDuration = result.duration / 1000; // in seconds

      sceneData.push({
        name: scene.name,
        startTime: sceneStartTime,
        duration: sceneDuration,
        narration: narrationTexts[scene.name] || "",
      });

      results.push({ name: scene.name, result });

      if (!result.success) {
        console.warn(`⚠️  Scene "${scene.name}" had issues: ${result.error}`);
        // Continue with next scene
      }

      // Small delay between scenes
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Collect all wait-cut segments from scenes (for post-process)
    const waitCutSegments: WaitCutSegment[] = [];

    // Checkpoint Chat (single wait cut)
    const cpIdx = results.findIndex((r) => r.name === "Checkpoint Chat");
    if (cpIdx >= 0 && results[cpIdx].result?.waitCut && sceneData[cpIdx]) {
      const sceneStart = sceneData[cpIdx].startTime;
      const w = results[cpIdx].result.waitCut;
      waitCutSegments.push({
        startSec: sceneStart + w.startOffsetMs / 1000,
        endSec: sceneStart + w.endOffsetMs / 1000,
      });
    }

    // Details (multiple wait cuts - initial navigation and signout)
    const detailsIdx = results.findIndex((r) => r.name === "Details");
    if (
      detailsIdx >= 0 &&
      results[detailsIdx].result?.waitCuts &&
      Array.isArray(results[detailsIdx].result.waitCuts) &&
      sceneData[detailsIdx]
    ) {
      const sceneStart = sceneData[detailsIdx].startTime;
      const cuts = results[detailsIdx].result.waitCuts;
      for (const cut of cuts) {
        waitCutSegments.push({
          startSec: sceneStart + cut.startOffsetMs / 1000,
          endSec: sceneStart + cut.endOffsetMs / 1000,
        });
      }
      console.log(
        `\n📊 Collected ${cuts.length} wait cut segment(s) from Details scene`,
      );
    }

    // Save session after recording
    if (context) {
      await saveSession(context);

      // Final sync of click events before closing
      if (zoomEnabled && zoomTracker) {
        try {
          const pages = context.pages();
          for (const page of pages) {
            try {
              const clicks = await page.evaluate(() => {
                const clicks = (window as any).__zoomTrackerClicks || [];
                (window as any).__zoomTrackerClicks = [];
                return clicks;
              });

              for (const click of clicks) {
                zoomTracker.trackClick(click.x, click.y);
              }
            } catch (error) {
              // Page might be closed, ignore
            }
          }
        } catch (error) {
          // Ignore
        }
      }

      // Clean up click sync interval
      if ((context as any).__zoomTrackerInterval) {
        clearInterval((context as any).__zoomTrackerInterval);
      }
    }

    // Close browser
    await context.close();
    await browser.close();

    // Wait a bit for video to be finalized
    console.log("\n⏳ Finalizing video...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Rename the video file to use timestamp
    // Playwright generates a video file in the output directory, we need to find and rename it
    try {
      const files = fs.readdirSync(config.outputDir);
      const videoFile = files.find((file) => file.endsWith(".webm"));
      if (videoFile) {
        const oldVideoPath = path.join(config.outputDir, videoFile);
        // Only rename if it's different from our target name
        if (videoFile !== videoFileName) {
          fs.renameSync(oldVideoPath, videoPath);
          console.log(`  ✅ Renamed video file to: ${videoFileName}`);
        }
      } else {
        console.log("  ⚠️  Could not find generated video file to rename");
      }
    } catch (error) {
      console.log(
        `  ⚠️  Could not rename video file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Apply zoom effects if enabled and FFmpeg is available
    let videoAfterZoom = videoPath;
    if (zoomEnabled && zoomTracker) {
      console.log("\n🎬 Processing zoom effects...");
      try {
        const triggers = zoomTracker.findZoomTriggers(
          config.zoomEffects.zoomDurationSec,
          config.zoomEffects.zoomLevel,
          config.zoomEffects.minGapBetweenZoomsSec,
          {
            width: config.videoSettings.width,
            height: config.videoSettings.height,
          },
        );

        if (triggers.length > 0) {
          console.log(`  📊 Found ${triggers.length} zoom trigger(s)`);

          // Save events metadata for debugging
          const eventsPath = path.join(
            config.outputDir,
            `zoom-events-${timestamp}.json`,
          );
          await zoomTracker.saveEvents(eventsPath);
          console.log(`  💾 Zoom events saved: ${path.basename(eventsPath)}`);

          const zoomedVideoPath = path.join(
            config.outputDir,
            `webapp-recording-zoomed-${timestamp}.webm`,
          );

          await applyZoomEffects(videoPath, zoomedVideoPath, triggers, {
            videoWidth: config.videoSettings.width,
            videoHeight: config.videoSettings.height,
            fps: config.videoSettings.fps,
          });

          videoAfterZoom = zoomedVideoPath;
          console.log(
            `  ✅ Zoomed video saved: ${path.basename(zoomedVideoPath)}`,
          );
        } else {
          console.log(
            "  ℹ️  No zoom triggers found (need 2+ clicks within 3 seconds)",
          );
        }
      } catch (error) {
        const err = error as { message?: string; stderr?: string };
        console.warn(
          `  ⚠️  Zoom processing failed: ${err.message ?? String(error)}`,
        );
        if (err.stderr) {
          const tail = err.stderr.trim().split("\n").slice(-6).join("\n");
          console.warn(`     FFmpeg: ${tail}`);
        }
        console.warn(`     Ensure FFmpeg is installed: brew install ffmpeg`);
      }
    }

    // Remove "waiting for AI response" segments (cut from zoomed video if available, else original)
    let finalVideoPath = videoAfterZoom; // Track the final video path
    if (waitCutSegments.length > 0) {
      console.log(
        `\n✂️  Removing ${waitCutSegments.length} wait segment(s) from recording...`,
      );
      try {
        const cutVideoPath = path.join(
          config.outputDir,
          videoAfterZoom !== videoPath
            ? `webapp-recording-zoomed-cut-${timestamp}.webm`
            : `webapp-recording-cut-${timestamp}.webm`,
        );
        await applyWaitCuts(videoAfterZoom, cutVideoPath, waitCutSegments);
        finalVideoPath = cutVideoPath; // Update final video path
        console.log(`  ✅ Cut video saved: ${path.basename(cutVideoPath)}`);
      } catch (err) {
        console.warn(
          `  ⚠️  Wait-cut failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        console.warn(`     Ensure FFmpeg is installed: brew install ffmpeg`);
      }
    }

    // Print summary
    console.log("\n═══════════════════════════════════════");
    console.log("📊 Recording Summary");
    console.log("═══════════════════════════════════════");

    let totalDuration = 0;
    for (const { name, result } of results) {
      const status = result.success ? "✅" : "❌";
      const duration = (result.duration / 1000).toFixed(1);
      console.log(`${status} ${name}: ${duration}s`);
      totalDuration += result.duration;
    }

    console.log(`\n⏱️  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`📹 Video saved to: ${finalVideoPath}`);

    // Save narration data for avatar platforms (Google Vids, D-ID, etc.)
    const narrationData = {
      videoPath: finalVideoPath,
      scenes: sceneData,
      metadata: {
        totalDuration: totalDuration / 1000,
        recordedAt: new Date().toISOString(),
        videoSettings: config.videoSettings,
      },
    };

    const narrationPath = path.join(config.outputDir, narrationFileName);
    fs.writeFileSync(narrationPath, JSON.stringify(narrationData, null, 2));

    console.log(`\n📝 Narration data saved: ${narrationPath}`);
    console.log(
      `   This file contains scene timings and narration text for each scene.`,
    );
    console.log(
      `   You can use this with Google Vids or other avatar platforms.`,
    );

    console.log("\n✅ Recording completed successfully!");
  } catch (error) {
    console.error("\n❌ Recording failed:", error);

    if (context) {
      await saveSession(context);
    }

    if (browser) {
      await browser.close();
    }

    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
