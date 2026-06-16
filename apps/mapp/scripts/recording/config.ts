import * as dotenv from 'dotenv';
import * as path from 'path';

const possiblePaths = [
  path.join(__dirname, '../../.env.recording'),
  path.join(process.cwd(), '.env.recording'),
];

for (const envPath of possiblePaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error && result.parsed) {
    console.log(`✅ Loaded .env.recording from ${envPath}`);
    break;
  }
}

export interface RecordingConfig {
  email: string;
  password: string;
  outputDir: string;
  /** iOS dev client bundle identifier (default: com.assetmem.staging). */
  iosAppId: string;
  /** Android dev client application id. */
  androidAppId: string;
  /** Deep link scheme (default: assetmem). */
  appScheme: string;
}

export const config: RecordingConfig = {
  email: process.env.RECORDING_EMAIL || '',
  password: process.env.RECORDING_PASSWORD || '',
  outputDir: process.env.RECORDING_OUTPUT_DIR || path.join(process.cwd(), 'recordings'),
  iosAppId: process.env.RECORDING_IOS_APP_ID || 'com.assetmem.staging',
  androidAppId: process.env.RECORDING_ANDROID_APP_ID || 'com.assetmem.staging',
  appScheme: process.env.RECORDING_APP_SCHEME || 'assetmem',
};

if (!config.email || !config.password) {
  console.warn('⚠️  RECORDING_EMAIL and RECORDING_PASSWORD not set in .env.recording');
}

export function appIdForPlatform(platform: 'ios' | 'android'): string {
  return platform === 'ios' ? config.iosAppId : config.androidAppId;
}
