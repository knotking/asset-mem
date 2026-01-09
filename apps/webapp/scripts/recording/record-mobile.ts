import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config } from './config';
import { ensureOutputDir, loadSession, authenticate, saveSession } from './helpers';
import { recordLandingPage } from './scenes/landing-page';
import { recordLogin } from './scenes/login';
import { recordDashboard } from './scenes/dashboard';
import { recordAIChat } from './scenes/ai-chat';
import { recordTimeline } from './scenes/timeline';
import { recordDocuments } from './scenes/documents';
import * as path from 'path';

async function main() {
  console.log('📱 Starting Mobile Emulation Recording');
  console.log('═══════════════════════════════════════\n');
  
  ensureOutputDir();
  
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    // Launch browser
    console.log('🚀 Launching browser with mobile emulation...');
    browser = await chromium.launch({
      headless: false,
      slowMo: 100,
    });
    
    // Create context with mobile device emulation
    const mobileDevice = config.devices.mobile;
    context = await browser.newContext({
      ...mobileDevice,
      recordVideo: {
        dir: config.outputDir,
        size: {
          width: mobileDevice.viewport.width,
          height: mobileDevice.viewport.height,
        },
      },
    });
    
    page = await context.newPage();
    
    // Try to load saved session
    const sessionLoaded = await loadSession(context);
    
    // Record all scenes (same as webapp but with mobile viewport)
    const scenes = [
      { name: 'Landing Page', fn: () => recordLandingPage(page!) },
      { name: 'Login', fn: () => recordLogin(page!, context!) },
      { name: 'Dashboard', fn: () => recordDashboard(page!) },
      { name: 'AI Chat', fn: () => recordAIChat(page!) },
      { name: 'Timeline', fn: () => recordTimeline(page!) },
      { name: 'Documents', fn: () => recordDocuments(page!) },
    ];
    
    const results: Array<{ name: string; result: any }> = [];
    
    for (const scene of scenes) {
      console.log(`\n${'─'.repeat(50)}`);
      const result = await scene.fn();
      results.push({ name: scene.name, result });
      
      if (!result.success) {
        console.warn(`⚠️  Scene "${scene.name}" had issues: ${result.error}`);
      }
      
      // Small delay between scenes
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    
    // Save session
    if (context) {
      await saveSession(context);
    }
    
    // Close browser
    await context.close();
    await browser.close();
    
    // Wait for video to be finalized
    console.log('\n⏳ Finalizing video...');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Print summary
    console.log('\n═══════════════════════════════════════');
    console.log('📊 Mobile Recording Summary');
    console.log('═══════════════════════════════════════');
    
    let totalDuration = 0;
    for (const { name, result } of results) {
      const status = result.success ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(1);
      console.log(`${status} ${name}: ${duration}s`);
      totalDuration += result.duration;
    }
    
    console.log(`\n⏱️  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`📹 Video saved to: ${config.outputDir}`);
    console.log(`📱 Device: ${mobileDevice.name}`);
    console.log('\n✅ Mobile recording completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Mobile recording failed:', error);
    
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
  console.error('Fatal error:', error);
  process.exit(1);
});

