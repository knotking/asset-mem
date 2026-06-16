import * as path from 'path';
import * as fs from 'fs';
import { config, appIdForPlatform } from './config';
import { ensureOutputDir } from './helpers';
import {
  checkMaestroInstalled,
  getIOSSimulatorId,
  getAndroidEmulatorId,
  startIOSScreenRecording,
  startAndroidScreenRecording,
  runMaestroFlow,
  reloadDevClient,
  type MaestroConfig,
  type MaestroFlowResult,
} from './maestro-helpers';
import * as readline from 'readline';

const narrationTexts: Record<string, string> = {
  'Landing Page Static':
    'Welcome to AssetMem AI — your AI-powered home care platform. Track property condition with timeline checkpoints, chat with your documents, get repair guidance, and generate professional reports.',
  'Landing Page':
    'Welcome to AssetMem AI. Explore use cases, timeline checkpoints, document chat, and My pros. Generate shareable PDF reports and meet specialized AI agents — all in one home care platform.',
  Login:
    'Access your personalized AssetMem AI dashboard with secure authentication. Once logged in, unlock intelligent home maintenance tools from checkpoint analysis to document chat.',
  'Property Onboarding':
    'Add a new property in seconds — upload inspection reports, insurance papers, or photos. AI extracts key details and creates your property profile automatically.',
  Dashboard:
    'Your command center: view all properties, open a home, and jump into chat, timeline, or details.',
  'Timeline Checkpoint':
    'Document property condition with visual checkpoints — photos, AI scores, and a searchable timeline for every area of your home.',
  'Timeline Compare':
    'Compare two checkpoints side by side to see visual and semantic changes between visits.',
  'Timeline Insights':
    'Explore metrics and trends — condition scores, issue severity, and health index for your property.',
  'Timeline Reports':
    'Generate branded PDF reports from checkpoint photos — showings, move-in/out, or insurance documentation.',
  'Checkpoint Chat':
    'Ask the AI about your checkpoints with optional coverage and service agents enabled, then review the full structured report.',
  'Save Provider & My Pros':
    'Ask for local service pros, save your favorites from the chat report sheet, then find them again under My pros on the Details tab.',
  Details:
    'Manage property documents, open My pros, and access everything you need in the property Details hub.',
};

type SceneDef = { name: string; flowFile: string };

const ALL_SCENES: SceneDef[] = [
  { name: 'Landing Page Static', flowFile: 'landing-page-static.yaml' },
  { name: 'Landing Page', flowFile: 'landing-page.yaml' },
  { name: 'Login', flowFile: 'login.yaml' },
  { name: 'Property Onboarding', flowFile: 'property-onboarding.yaml' },
  { name: 'Dashboard', flowFile: 'dashboard.yaml' },
  { name: 'Timeline Checkpoint', flowFile: 'timeline-checkpoint.yaml' },
  { name: 'Timeline Compare', flowFile: 'timeline-compare.yaml' },
  { name: 'Timeline Insights', flowFile: 'timeline-insights.yaml' },
  { name: 'Timeline Reports', flowFile: 'timeline-reports.yaml' },
  { name: 'Checkpoint Chat', flowFile: 'checkpoint-chat.yaml' },
  { name: 'Save Provider & My Pros', flowFile: 'save-provider-my-pros.yaml' },
  { name: 'Details', flowFile: 'property-details.yaml' },
];

const SCENES_NEEDING_DASHBOARD = [
  'Property Onboarding',
  'Timeline Checkpoint',
  'Timeline Compare',
  'Timeline Insights',
  'Timeline Reports',
  'Checkpoint Chat',
  'Save Provider & My Pros',
  'Details',
];

const PROPERTY_SCENES = new Set([
  'Timeline Checkpoint',
  'Timeline Compare',
  'Timeline Insights',
  'Timeline Reports',
  'Checkpoint Chat',
  'Save Provider & My Pros',
  'Details',
]);

/** Scenes that must start on the public landing page (signed out). */
const SCENES_STARTING_AT_LANDING = new Set([
  'Landing Page Static',
  'Landing Page',
  'Login',
]);

function getScenePrepFlows(sceneName: string): string[] {
  if (sceneName === 'Landing Page Static' || sceneName === 'Landing Page') {
    return [];
  }

  if (sceneName === 'Login') {
    return ['prep/goto-login.yaml'];
  }

  if (sceneName === 'Dashboard' || sceneName === 'Property Onboarding') {
    return ['prep/authenticate.yaml'];
  }

  if (PROPERTY_SCENES.has(sceneName)) {
    return ['prep/authenticate.yaml', 'prep/goto-property.yaml'];
  }

  return [];
}

async function runScenePrep(
  sceneName: string,
  flowsDir: string,
  maestroConfig: MaestroConfig,
): Promise<boolean> {
  const prepFlows = getScenePrepFlows(sceneName);

  for (const prepFile of prepFlows) {
    const prepPath = path.join(flowsDir, prepFile);
    if (!fs.existsSync(prepPath)) {
      console.warn(`  ⚠️  Missing prep flow: ${prepPath}`);
      continue;
    }

    console.log(`  🧭 Prep: ${path.basename(prepFile)}`);
    const prepResult = await runMaestroFlow(prepPath, maestroConfig);
    if (!prepResult.success) {
      console.warn(`  ⚠️  Prep "${prepFile}" failed: ${prepResult.error ?? 'unknown error'}`);
      return false;
    }
  }

  return true;
}

function promptSceneSelection(): Promise<Set<string>> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log('\n📋 Select scenes to record (matches webapp record:webapp):');
    ALL_SCENES.forEach((scene, index) => {
      console.log(`  ${index + 1}. ${scene.name}`);
    });
    console.log(`  ${ALL_SCENES.length + 1}. All of the above`);
    console.log('\nEnter scene numbers (comma-separated, e.g. 1,2,3 or 13 for all):');

    rl.question('> ', (answer) => {
      rl.close();
      const selected = new Set<string>();
      const input = answer.trim().toLowerCase();

      if (input === String(ALL_SCENES.length + 1) || input === 'all') {
        ALL_SCENES.forEach((s) => selected.add(s.name));
      } else {
        for (const num of input.split(',').map((n) => n.trim())) {
          const idx = Number(num);
          if (idx >= 1 && idx <= ALL_SCENES.length) {
            selected.add(ALL_SCENES[idx - 1].name);
          }
        }
      }
      resolve(selected);
    });
  });
}

function promptPlatform(): Promise<'ios' | 'android'> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\n📱 Select platform:\n  1. iOS Simulator\n  2. Android Emulator\n');
    rl.question('> ', (answer) => {
      rl.close();
      resolve(answer.trim() === '2' ? 'android' : 'ios');
    });
  });
}

async function main() {
  console.log('📱 Starting Mobile App Recording (Maestro + dev client)');
  console.log('═══════════════════════════════════════\n');

  if (!(await checkMaestroInstalled())) {
    console.error('❌ Maestro is not installed. Run: curl -Ls "https://get.maestro.mobile.dev" | bash');
    process.exit(1);
  }

  const platform = await promptPlatform();
  const selectedScenes = await promptSceneSelection();
  if (selectedScenes.size === 0) {
    console.log('\n⚠️  No scenes selected.');
    return;
  }

  const appId = appIdForPlatform(platform);
  console.log(`\n✅ Selected scenes: ${Array.from(selectedScenes).join(', ')}`);
  console.log(`📱 Dev client appId: ${appId}`);
  console.log(`🔗 Deep link scheme: ${config.appScheme}://`);
  console.log('💡 Ensure the dev client is installed on the simulator and Metro is running (npm run dev)\n');

  let deviceId: string | undefined;
  if (platform === 'ios') {
    deviceId = (await getIOSSimulatorId()) || undefined;
    if (!deviceId) {
      console.error('❌ No iOS simulator found. Boot a simulator in Xcode first.');
      process.exit(1);
    }
  } else {
    deviceId = (await getAndroidEmulatorId()) || undefined;
  }

  ensureOutputDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const videoFileName = `mapp-recording-${platform}-${timestamp}.mp4`;
  const narrationFileName = `mapp-narration-data-${timestamp}.json`;
  const videoPath = path.join(config.outputDir, videoFileName);
  const flowsDir = path.join(__dirname, 'maestro', 'flows');

  const maestroConfig: MaestroConfig = {
    appId,
    appScheme: config.appScheme,
    platform,
    deviceId,
    email: config.email,
    password: config.password,
    flowsDir,
  };

  let screenRecording: { process: unknown; stop: () => Promise<void> } | null = null;
  const sceneResults: Array<{ name: string; result: MaestroFlowResult; narration?: string }> = [];

  try {
    console.log(`\n📹 Starting screen recording: ${videoFileName}`);
    screenRecording =
      platform === 'ios'
        ? await startIOSScreenRecording(videoPath, deviceId)
        : await startAndroidScreenRecording(videoPath, deviceId);

    const gotoLandingPath = path.join(flowsDir, 'prep/goto-landing.yaml');

    const scenes: SceneDef[] = [];

    if (selectedScenes.has('Landing Page Static')) {
      scenes.push(ALL_SCENES.find((s) => s.name === 'Landing Page Static')!);
    }
    if (selectedScenes.has('Landing Page')) {
      scenes.push(ALL_SCENES.find((s) => s.name === 'Landing Page')!);
    }

    if (selectedScenes.has('Login')) {
      scenes.push(ALL_SCENES.find((s) => s.name === 'Login')!);
    }

    if (selectedScenes.has('Property Onboarding')) {
      scenes.push(ALL_SCENES.find((s) => s.name === 'Property Onboarding')!);
    }

    const needsDashboard = SCENES_NEEDING_DASHBOARD.some((name) => selectedScenes.has(name));
    if (needsDashboard) {
      scenes.push(ALL_SCENES.find((s) => s.name === 'Dashboard')!);
    }

    for (const scene of ALL_SCENES) {
      if (
        selectedScenes.has(scene.name) &&
        scene.name !== 'Landing Page Static' &&
        scene.name !== 'Landing Page' &&
        scene.name !== 'Login' &&
        scene.name !== 'Property Onboarding' &&
        scene.name !== 'Dashboard'
      ) {
        scenes.push(scene);
      }
    }

    for (const scene of scenes) {
      const flowPath = path.join(flowsDir, scene.flowFile);
      if (!fs.existsSync(flowPath)) {
        console.error(`  ❌ Missing flow: ${flowPath}`);
        continue;
      }

      console.log(`\n${'─'.repeat(50)}\n🎬 Scene: ${scene.name}`);

      console.log('  🔄 Reloading app...');
      await reloadDevClient(maestroConfig);

      if (SCENES_STARTING_AT_LANDING.has(scene.name) && fs.existsSync(gotoLandingPath)) {
        console.log('  🧭 Prep: goto-landing.yaml');
        const landingPrep = await runMaestroFlow(gotoLandingPath, maestroConfig);
        if (!landingPrep.success) {
          console.warn(`  ⚠️  Landing prep failed: ${landingPrep.error ?? 'unknown error'}`);
        }
      }

      const prepOk = await runScenePrep(scene.name, flowsDir, maestroConfig);
      if (!prepOk) {
        console.warn(`  ⏭️  Skipping scene "${scene.name}" — prep failed`);
        sceneResults.push({
          name: scene.name,
          result: { success: false, duration: 0, error: 'Prep failed' },
          narration: narrationTexts[scene.name] || '',
        });
        continue;
      }

      const result = await runMaestroFlow(flowPath, maestroConfig);
      sceneResults.push({ name: scene.name, result, narration: narrationTexts[scene.name] || '' });

      if (!result.success) {
        console.warn(`  ⚠️  Scene "${scene.name}": ${result.error ?? 'issues'}`);
      } else {
        console.log(`  ✅ Completed in ${(result.duration / 1000).toFixed(1)}s`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (screenRecording) {
      console.log('\n⏹️  Stopping screen recording...');
      await screenRecording.stop();
    }
    await new Promise((r) => setTimeout(r, 3000));

    const narrationPath = path.join(config.outputDir, narrationFileName);
    fs.writeFileSync(
      narrationPath,
      JSON.stringify(
        {
          platform,
          appId,
          timestamp: new Date().toISOString(),
          scenes: sceneResults.map(({ name, result, narration }) => ({
            name,
            duration: result.duration,
            narration,
          })),
        },
        null,
        2,
      ),
    );

    console.log('\n═══════════════════════════════════════');
    console.log('📊 Mobile Recording Summary');
    console.log('═══════════════════════════════════════');
    let total = 0;
    for (const { name, result } of sceneResults) {
      console.log(`${result.success ? '✅' : '❌'} ${name}: ${(result.duration / 1000).toFixed(1)}s`);
      total += result.duration;
    }
    console.log(`\n⏱️  Total: ${(total / 1000).toFixed(1)}s`);
    console.log(`📹 Video: ${videoPath}`);
    console.log(`📝 Narration: ${narrationPath}`);
    console.log('\n✅ Mobile recording completed!');
  } catch (error) {
    console.error('\n❌ Recording failed:', error);
    if (screenRecording) {
      try {
        await screenRecording.stop();
      } catch {
        /* ignore */
      }
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
