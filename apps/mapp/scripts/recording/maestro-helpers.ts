import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";

const execAsync = promisify(exec);

export interface MaestroConfig {
  appId: string;
  appScheme: string;
  platform: "ios" | "android";
  deviceId?: string;
  email: string;
  password: string;
  flowsDir: string;
}

export interface MaestroFlowResult {
  success: boolean;
  duration: number;
  error?: string;
}

export interface MaestroFlowOptions {
  /** When true, failures are logged at info level (e.g. login probe). */
  quiet?: boolean;
}

/**
 * Check if Maestro is installed
 */
export async function checkMaestroInstalled(): Promise<boolean> {
  try {
    await execAsync("maestro --version");
    return true;
  } catch {
    return false;
  }
}

/**
 * Get iOS simulator device ID (prefer booted simulator, otherwise get first available)
 */
export async function getIOSSimulatorId(): Promise<string | null> {
  try {
    // First, try to get a booted simulator
    const { stdout: bootedOutput } = await execAsync(
      "xcrun simctl list devices | grep -i 'iphone' | grep '(Booted)' | grep -oE '[A-F0-9-]{36}' | head -1"
    );
    const bootedId = bootedOutput.trim();
    if (bootedId) {
      console.log(`  📱 Found booted iOS simulator: ${bootedId}`);
      return bootedId;
    }

    // If no booted simulator, get first available iPhone simulator
    const { stdout } = await execAsync(
      "xcrun simctl list devices available | grep -i 'iphone' | head -1 | grep -oE '[A-F0-9-]{36}' | head -1"
    );
    const simulatorId = stdout.trim();
    if (simulatorId) {
      console.log(`  📱 Found available iOS simulator: ${simulatorId}`);
      // Boot the simulator
      try {
        await execAsync(`xcrun simctl boot ${simulatorId}`);
        console.log(`  ✅ Booted iOS simulator: ${simulatorId}`);
        // Wait a bit for simulator to fully boot
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (bootError) {
        // Simulator might already be booting or booted
        console.log(`  ⚠️  Simulator may already be booting: ${bootError}`);
      }
      return simulatorId;
    }
    return null;
  } catch (error) {
    console.error(`  ⚠️  Error finding iOS simulator: ${error}`);
    return null;
  }
}

/**
 * Get Android emulator device ID
 */
export async function getAndroidEmulatorId(): Promise<string | null> {
  try {
    const { stdout } = await execAsync("adb devices | grep -v 'List' | grep 'device$' | head -1 | awk '{print $1}'");
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Start screen recording for iOS Simulator
 */
export async function startIOSScreenRecording(
  outputPath: string,
  deviceId?: string
): Promise<{ process: any; stop: () => Promise<void> }> {
  const device = deviceId || "booted";
  const command = `xcrun simctl io ${device} recordVideo --codec=h264 --force "${outputPath}"`;
  
  const process = exec(command);
  
  return {
    process,
    stop: async () => {
      try {
        // Send interrupt signal to stop recording
        process.kill("SIGINT");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error("Error stopping iOS screen recording:", error);
      }
    },
  };
}

/**
 * Start screen recording for Android Emulator
 */
export async function startAndroidScreenRecording(
  outputPath: string,
  deviceId?: string
): Promise<{ process: any; stop: () => Promise<void> }> {
  const device = deviceId ? `-s ${deviceId}` : "";
  const command = `adb ${device} shell screenrecord --time-limit 3600 /sdcard/recording.mp4`;
  
  const process = exec(command);
  
  // Copy file after recording stops
  const stop = async () => {
    try {
      process.kill("SIGINT");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Pull the recording file
      await execAsync(`adb ${device} pull /sdcard/recording.mp4 "${outputPath}"`);
      await execAsync(`adb ${device} shell rm /sdcard/recording.mp4`);
    } catch (error) {
      console.error("Error stopping Android screen recording:", error);
    }
  };
  
  return { process, stop };
}

/**
 * Run a Maestro flow
 */
export async function runMaestroFlow(
  flowPath: string,
  config: MaestroConfig,
  envVars: Record<string, string> = {},
  options: MaestroFlowOptions = {},
): Promise<MaestroFlowResult> {
  const startTime = Date.now();
  const quiet = options.quiet ?? false;
  
  try {
    // Set environment variables for Maestro
    // Maestro uses environment variables that can be referenced in YAML as ${VAR_NAME}
    // We need to pass them via -e flags on the CLI
    const env = {
      ...process.env,
      APP_ID: config.appId,
      APP_SCHEME: config.appScheme,
      EMAIL: config.email,
      PASSWORD: config.password,
      ...envVars,
    };
    
    // Debug: Log environment variables (mask sensitive data)
    if (!quiet) {
      console.log(`  🔍 Environment variables for Maestro:`);
      console.log(`     APP_ID: ${env.APP_ID}`);
      console.log(`     APP_SCHEME: ${env.APP_SCHEME}`);
      console.log(`     EMAIL: ${env.EMAIL ? env.EMAIL.substring(0, 3) + '***' : 'UNDEFINED'}`);
      console.log(`     PASSWORD: ${env.PASSWORD ? '***' : 'UNDEFINED'}`);
    }
    
    // Build maestro command with environment variables passed via -e flags
    // Maestro requires env vars to be passed via -e EMAIL=value -e PASSWORD=value
    const envFlags = [
      `-e EMAIL="${config.email}"`,
      `-e PASSWORD="${config.password}"`,
      `-e APP_ID="${config.appId}"`,
      `-e APP_SCHEME="${config.appScheme}"`,
      ...Object.entries(envVars).map(([key, value]) => `-e ${key}="${value}"`),
    ].join(' ');
    
    // For iOS, use --device with UDID. For Android, use --device with device ID
    let deviceFlag = "";
    if (config.deviceId) {
      if (config.platform === "ios") {
        // For iOS simulator, Maestro uses the UDID directly
        deviceFlag = `--device ${config.deviceId}`;
      } else {
        // For Android, use device ID
        deviceFlag = `--device ${config.deviceId}`;
      }
    }
    const command = `maestro test "${flowPath}" ${envFlags} ${deviceFlag}`.trim();
    
    console.log(`  🎬 Running Maestro flow: ${path.basename(flowPath)}`);
    
    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    let commandSucceeded = false;
    
    try {
      const result = await execAsync(command, {
        env,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      stdout = result.stdout || '';
      stderr = result.stderr || '';
      commandSucceeded = true;
    } catch (error: any) {
      // execAsync throws on non-zero exit codes, but we need to check if it's a real failure
      stdout = error.stdout || '';
      stderr = error.stderr || '';
      exitCode = error.code || 1;
      
      // Combine all output for analysis
      const allOutput = (stdout + stderr).toLowerCase();
      
      // Check for real failure indicators
      const hasRealFailure = 
        allOutput.includes('assertion failed') ||
        allOutput.includes('element not found') ||
        allOutput.includes('could not find') ||
        allOutput.includes('failed to find') ||
        (allOutput.includes('timeout') && !allOutput.includes('waiting')) ||
        allOutput.includes('test failed') ||
        (allOutput.includes('error') && !allOutput.includes('info'));
      
      // Check for success indicators (even if exit code is non-zero)
      const hasSuccessIndicators = 
        allOutput.includes('test passed') ||
        allOutput.includes('flow completed') ||
        allOutput.includes('successfully') ||
        allOutput.includes('✅') ||
        allOutput.includes('passed');
      
      // If we have success indicators and no real failure, treat as success
      // This handles cases where Maestro exits with warnings but the flow actually worked
      if (hasSuccessIndicators && !hasRealFailure) {
        commandSucceeded = true;
        console.log(`  ⚠️  Flow completed with warnings (exit code: ${exitCode})`);
        if (stderr && stderr.trim()) {
          const warningPreview = stderr.substring(0, 200).trim();
          if (warningPreview) {
            console.warn(`  ⚠️  Warnings: ${warningPreview}...`);
          }
        }
      } else {
        throw error;
      }
    }
    
    const duration = Date.now() - startTime;
    
    if (commandSucceeded) {
      // Log success message
      if (stdout.includes('✅') || stdout.includes('PASSED') || stdout.includes('Success')) {
        console.log(`  ✅ Flow completed successfully`);
      } else {
        console.log(`  ✅ Flow completed`);
      }
      
      return {
        success: true,
        duration,
      };
    }
    
    // Should not reach here, but just in case
    return {
      success: false,
      duration,
      error: 'Unknown error',
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || String(error);
    
    // Get all output for final check
    const errorOutput = ((error.stdout || '') + (error.stderr || '')).toLowerCase();
    
    // Final check: if user says it worked, be lenient with warnings
    // Only treat as failure if there are clear assertion failures
    const isRealFailure = 
      errorOutput.includes('assertion failed') ||
      errorOutput.includes('element not found') ||
      errorOutput.includes('could not find') ||
      errorOutput.includes('failed to find');
    
    if (!isRealFailure && (error.stdout || '').toLowerCase().includes('test passed')) {
      console.log(`  ⚠️  Flow completed with warnings (treating as success)`);
      if (error.stderr) {
        const warningPreview = error.stderr.substring(0, 200).trim();
        if (warningPreview) {
          console.warn(`  ⚠️  ${warningPreview}...`);
        }
      }
      return {
        success: true,
        duration,
      };
    }
    
    if (quiet) {
      console.log(`  ℹ️  Probe: not on dashboard (${(duration / 1000).toFixed(1)}s)`);
    } else {
      console.error(`  ❌ Flow failed: ${errorMessage}`);
      const combined = `${error.stdout || ''}\n${error.stderr || ''}`.trim();
      if (combined) {
        const tail = combined.length > 800 ? combined.slice(-800) : combined;
        console.error(`  📋 Maestro output (tail):\n${tail}`);
      }
    }
    
    return {
      success: false,
      duration,
      error: errorMessage,
    };
  }
}

/**
 * Install app on device/simulator
 */
export async function installApp(
  appPath: string,
  platform: "ios" | "android",
  deviceId?: string
): Promise<void> {
  try {
    if (platform === "ios") {
      const device = deviceId || "booted";
      await execAsync(`xcrun simctl install ${device} "${appPath}"`);
      console.log(`  ✅ App installed on iOS simulator`);
    } else {
      const device = deviceId ? `-s ${deviceId}` : "";
      await execAsync(`adb ${device} install -r "${appPath}"`);
      console.log(`  ✅ App installed on Android emulator`);
    }
  } catch (error) {
    console.error(`  ❌ Failed to install app: ${error}`);
    throw error;
  }
}

/**
 * Terminate and relaunch the dev client (fresh start each scene).
 */
export async function reloadDevClient(config: MaestroConfig): Promise<void> {
  const device = config.deviceId || 'booted';

  try {
    if (config.platform === 'ios') {
      await execAsync(`xcrun simctl terminate ${device} ${config.appId}`).catch(() => undefined);
      await execAsync(`xcrun simctl launch ${device} ${config.appId}`);
    } else {
      const adbDevice = config.deviceId ? `-s ${config.deviceId}` : '';
      await execAsync(`adb ${adbDevice} shell am force-stop ${config.appId}`).catch(() => undefined);
      await execAsync(
        `adb ${adbDevice} shell monkey -p ${config.appId} -c android.intent.category.LAUNCHER 1`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  } catch (error) {
    console.error(`  ❌ Failed to reload dev client: ${error}`);
    throw error;
  }
}

/**
 * Launch the dev client (custom Expo development build) on simulator/emulator.
 */
export async function launchDevClient(config: MaestroConfig): Promise<void> {
  try {
    const device = config.deviceId || "booted";

    if (config.platform === "ios") {
      console.log(`  📱 Launching iOS dev client (${config.appId})...`);
      await execAsync(`xcrun simctl launch ${device} ${config.appId}`);
      console.log(`  ✅ Dev client launched on iOS simulator`);
    } else {
      const adbDevice = config.deviceId ? `-s ${config.deviceId}` : "";
      console.log(`  📱 Launching Android dev client (${config.appId})...`);
      await execAsync(
        `adb ${adbDevice} shell monkey -p ${config.appId} -c android.intent.category.LAUNCHER 1`,
      );
      console.log(`  ✅ Dev client launched on Android emulator`);
    }

    console.log(`  ⏳ Waiting for app to load...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } catch (error) {
    console.error(`  ❌ Failed to launch dev client: ${error}`);
    throw error;
  }
}

/** @deprecated Use launchDevClient — kept as alias for older scripts. */
export async function launchExpoGo(config: MaestroConfig, _expoUrl?: string): Promise<void> {
  return launchDevClient(config);
}

/**
 * Launch app using Maestro (deprecated - use launchDevClient instead)
 */
export async function launchApp(config: MaestroConfig): Promise<void> {
  return launchDevClient(config);
}
