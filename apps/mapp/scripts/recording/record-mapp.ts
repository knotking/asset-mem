import * as path from 'path';
import * as fs from 'fs';
import { config } from './config';
import { ensureOutputDir } from './helpers';
import {
  checkMaestroInstalled,
  getIOSSimulatorId,
  getAndroidEmulatorId,
  startIOSScreenRecording,
  startAndroidScreenRecording,
  runMaestroFlow,
  launchExpoGo,
  type MaestroConfig,
  type MaestroFlowResult,
} from './maestro-helpers';
import * as readline from 'readline';

// Narration text for each scene (max 500 characters)
const narrationTexts: Record<string, string> = {
  Login:
    'Sign in to your HomeGeek AI account and access all your properties and AI-powered insights. The mobile app provides a seamless authentication experience with support for email and Google sign-in.',
  Dashboard:
    'View all your properties in one place. The mobile dashboard gives you quick access to property details, recent activity, and easy navigation to manage your home maintenance needs.',
  'Property Details':
    'Explore comprehensive property information including documents, checkpoints, and chat history. Navigate between different tabs to access all property-related features.',
  Chat: 'Engage with our AI assistant directly from your mobile device. Ask questions about property maintenance, get recommendations, and receive real-time responses with detailed analysis and actionable insights.',
  Timeline:
    "Track your property's condition over time with visual checkpoints. View historical maintenance records, compare different time periods, and monitor changes in your property's condition.",
};

/**
 * Prompts the user to select which scenes to record
 */
function promptSceneSelection(): Promise<Set<string>> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('\n📋 Select scenes to record:');
    console.log('  1. Login');
    console.log('  2. Dashboard');
    console.log('  3. Property Details');
    console.log('  4. Chat');
    console.log('  5. Timeline');
    console.log('  6. All of the above');
    console.log('\nEnter scene numbers (comma-separated, e.g., 1,2,3 or 6 for all):');

    rl.question('> ', (answer) => {
      rl.close();

      const selected = new Set<string>();
      const input = answer.trim().toLowerCase();

      if (input === '6' || input === 'all') {
        selected.add('Login');
        selected.add('Dashboard');
        selected.add('Property Details');
        selected.add('Chat');
        selected.add('Timeline');
      } else {
        const numbers = input.split(',').map((n) => n.trim());
        for (const num of numbers) {
          switch (num) {
            case '1':
              selected.add('Login');
              break;
            case '2':
              selected.add('Dashboard');
              break;
            case '3':
              selected.add('Property Details');
              break;
            case '4':
              selected.add('Chat');
              break;
            case '5':
              selected.add('Timeline');
              break;
          }
        }
      }

      resolve(selected);
    });
  });
}

/**
 * Prompts the user to select platform
 */
function promptPlatform(): Promise<'ios' | 'android'> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('\n📱 Select platform:');
    console.log('  1. iOS');
    console.log('  2. Android');
    console.log('\nEnter choice (1 or 2):');

    rl.question('> ', (answer) => {
      rl.close();

      const input = answer.trim();
      const platform = input === '1' ? 'ios' : 'android';

      console.log(`  ✅ Selected: ${platform === 'ios' ? 'iOS' : 'Android'}`);
      resolve(platform);
    });
  });
}

async function main() {
  console.log('📱 Starting Mobile App Recording with Maestro');
  console.log('═══════════════════════════════════════\n');

  // Debug: Check if config loaded correctly
  console.log(`🔍 Config check:`);
  console.log(`   Email: ${config.email ? config.email.substring(0, 3) + '***' : 'NOT SET'}`);
  console.log(`   Password: ${config.password ? '***' : 'NOT SET'}`);
  console.log(`   Output Dir: ${config.outputDir}\n`);

  // Check if Maestro is installed
  const maestroInstalled = await checkMaestroInstalled();
  if (!maestroInstalled) {
    console.error('❌ Maestro is not installed!');
    console.error('\nPlease install Maestro:');
    console.error('  curl -Ls "https://get.maestro.mobile.dev" | bash');
    console.error('\nOr visit: https://maestro.mobile.dev');
    process.exit(1);
  }

  console.log('✅ Maestro is installed\n');

  // Prompt for platform
  const platform = await promptPlatform();

  // Prompt for scenes
  const selectedScenes = await promptSceneSelection();

  if (selectedScenes.size === 0) {
    console.log('\n⚠️  No scenes selected. Exiting...');
    return;
  }

  console.log(`\n✅ Selected scenes: ${Array.from(selectedScenes).join(', ')}`);

  // For Expo Go, use the Expo Go bundle ID
  const appId = 'host.exp.Exponent';
  console.log(`\n📱 Using Expo Go (appId: ${appId})`);

  // Check if Expo dev server URL is provided
  const expoUrl = process.env.EXPO_URL;
  if (expoUrl) {
    console.log(`  📱 Expo URL: ${expoUrl}`);
  } else {
    console.log(`  💡 Using default Expo URL: exp://localhost:8081`);
    console.log(`  💡 Set EXPO_URL env var to use a different URL`);
  }

  // Get device ID
  let deviceId: string | undefined;
  if (platform === 'ios') {
    console.log('  🔍 Looking for iOS simulator...');
    deviceId = (await getIOSSimulatorId()) || undefined;
    if (deviceId) {
      console.log(`  ✅ Using iOS Simulator: ${deviceId}`);
    } else {
      console.error('  ❌ No iOS simulator found!');
      console.error('  💡 Please:');
      console.error('     1. Open Xcode');
      console.error('     2. Go to Window > Devices and Simulators');
      console.error('     3. Start an iOS Simulator');
      console.error('     Or run: xcrun simctl boot <device-id>');
      process.exit(1);
    }
  } else {
    deviceId = (await getAndroidEmulatorId()) || undefined;
    if (deviceId) {
      console.log(`  📱 Android Emulator ID: ${deviceId}`);
    } else {
      console.log('  ⚠️  No Android emulator found, using default');
    }
  }

  ensureOutputDir();

  // Generate timestamp for file names
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const videoFileName = `mapp-recording-${platform}-${timestamp}.mp4`;
  const narrationFileName = `mapp-narration-data-${timestamp}.json`;
  const videoPath = path.join(config.outputDir, videoFileName);
  // Get flows directory - when running with tsx, __dirname is available
  const flowsDir = path.join(__dirname, 'maestro', 'flows');

  // Maestro configuration
  const maestroConfig: MaestroConfig = {
    appId,
    platform,
    deviceId,
    email: config.email,
    password: config.password,
    flowsDir,
  };

  let screenRecording: { process: any; stop: () => Promise<void> } | null = null;
  const sceneResults: Array<{ name: string; result: MaestroFlowResult; narration?: string }> = [];

  try {
    // Launch Expo Go app first
    console.log('\n🚀 Launching Expo Go app...');
    console.log('  💡 Make sure Expo dev server is running (npm run dev)');
    console.log('  💡 Or provide EXPO_URL environment variable');

    // Get Expo URL from environment or use default
    // Default to the production project URL
    // You can override with EXPO_URL env var (e.g., from expo start output)
    const expoUrl = process.env.EXPO_URL || 'exp://u.expo.dev';
    console.log(`  📱 Using Expo URL: ${expoUrl}`);
    console.log(`  📱 Target: homegeekai account, @homegeekai/homegeekai-prod project`);

    await launchExpoGo(maestroConfig, expoUrl);

    // Run setup flow to ensure correct account and project are selected
    console.log('\n🔧 Setting up Expo Go (selecting account and project)...');
    const setupFlowPath = path.join(flowsDir, 'expo-setup.yaml');
    if (fs.existsSync(setupFlowPath)) {
      const setupResult = await runMaestroFlow(setupFlowPath, maestroConfig);
      if (setupResult.success) {
        console.log('  ✅ Expo Go setup completed');
      } else {
        console.warn('  ⚠️  Expo Go setup had issues, continuing anyway...');
      }
    } else {
      console.log('  ℹ️  Setup flow not found, skipping account/project selection');
    }

    // Check if user is already logged in
    console.log('\n🔍 Checking login status...');
    const checkLoginFlowPath = path.join(flowsDir, 'check-login.yaml');
    let isLoggedIn = false;
    if (fs.existsSync(checkLoginFlowPath)) {
      const checkLoginResult = await runMaestroFlow(checkLoginFlowPath, maestroConfig);
      // If check-login succeeds (finds "Property AI Agent"), user is already logged in
      isLoggedIn = checkLoginResult.success;
      if (isLoggedIn) {
        console.log('  ✅ User is already logged in, skipping login flow');
      } else {
        console.log('  ℹ️  User is not logged in, login flow will run');
      }
    }

    // Start screen recording
    console.log(`\n📹 Starting screen recording: ${videoFileName}`);
    if (platform === 'ios') {
      screenRecording = await startIOSScreenRecording(videoPath, deviceId);
    } else {
      screenRecording = await startAndroidScreenRecording(videoPath, deviceId);
    }
    console.log('  ✅ Screen recording started');

    // Build scenes array
    const scenes: Array<{ name: string; flowFile: string }> = [];

    // Only add Login scene if user is not already logged in
    if (selectedScenes.has('Login') && !isLoggedIn) {
      scenes.push({ name: 'Login', flowFile: 'login.yaml' });
    } else if (selectedScenes.has('Login') && isLoggedIn) {
      console.log('  ⏭️  Skipping Login scene (already logged in)');
    }
    if (selectedScenes.has('Dashboard')) {
      scenes.push({ name: 'Dashboard', flowFile: 'dashboard.yaml' });
    }
    if (selectedScenes.has('Property Details')) {
      scenes.push({ name: 'Property Details', flowFile: 'property-details.yaml' });
    }
    if (selectedScenes.has('Chat')) {
      scenes.push({ name: 'Chat', flowFile: 'chat.yaml' });
    }
    if (selectedScenes.has('Timeline')) {
      scenes.push({ name: 'Timeline', flowFile: 'timeline.yaml' });
    }

    // Run scenes
    console.log('\n🎬 Starting scene recording...');
    console.log('═══════════════════════════════════════\n');

    for (const scene of scenes) {
      const flowPath = path.join(flowsDir, scene.flowFile);

      if (!fs.existsSync(flowPath)) {
        console.error(`  ❌ Flow file not found: ${flowPath}`);
        continue;
      }

      console.log(`\n${'─'.repeat(50)}`);
      console.log(`🎬 Scene: ${scene.name}`);

      const result = await runMaestroFlow(flowPath, maestroConfig);
      const narration = narrationTexts[scene.name] || '';

      sceneResults.push({
        name: scene.name,
        result,
        narration,
      });

      if (!result.success) {
        console.warn(`  ⚠️  Scene "${scene.name}" had issues: ${result.error}`);
      } else {
        console.log(`  ✅ Scene completed in ${(result.duration / 1000).toFixed(1)}s`);
      }

      // Small delay between scenes
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Stop screen recording
    console.log('\n⏹️  Stopping screen recording...');
    if (screenRecording) {
      await screenRecording.stop();
      console.log('  ✅ Screen recording stopped');
    }

    // Wait for video to be finalized
    console.log('\n⏳ Finalizing video...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Generate narration data
    const narrationData = {
      platform,
      appId,
      timestamp: new Date().toISOString(),
      scenes: sceneResults.map(({ name, result, narration }) => ({
        name,
        duration: result.duration,
        narration: narration || '',
      })),
    };

    const narrationPath = path.join(config.outputDir, narrationFileName);
    fs.writeFileSync(narrationPath, JSON.stringify(narrationData, null, 2));
    console.log(`  ✅ Narration data saved: ${narrationFileName}`);

    // Print summary
    console.log('\n═══════════════════════════════════════');
    console.log('📊 Mobile Recording Summary');
    console.log('═══════════════════════════════════════');

    let totalDuration = 0;
    for (const { name, result } of sceneResults) {
      const status = result.success ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(1);
      console.log(`${status} ${name}: ${duration}s`);
      totalDuration += result.duration;
    }

    console.log(`\n⏱️  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`📹 Video saved to: ${videoPath}`);
    console.log(`📱 Platform: ${platform}`);
    console.log(`📱 App ID: ${appId}`);
    console.log('\n✅ Mobile recording completed successfully!');
  } catch (error) {
    console.error('\n❌ Mobile recording failed:', error);

    // Stop screen recording if still running
    if (screenRecording) {
      try {
        await screenRecording.stop();
      } catch (stopError) {
        console.error('Error stopping screen recording:', stopError);
      }
    }

    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
