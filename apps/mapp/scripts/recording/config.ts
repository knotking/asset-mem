import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory of this config file
// tsx supports ES modules, so we can use import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.recording if it exists
// Try multiple possible locations:
// 1. Relative to config file: apps/mapp/.env.recording
// 2. Relative to cwd: .env.recording (if running from apps/mapp)
const possiblePaths = [
  path.join(__dirname, '../../.env.recording'), // From config.ts location
  path.join(process.cwd(), '.env.recording'), // From current working directory
];

let result: dotenv.DotenvConfigOutput | null = null;
let loadedPath: string | null = null;

for (const envPath of possiblePaths) {
  result = dotenv.config({ path: envPath });
  if (!result.error && result.parsed) {
    loadedPath = envPath;
    break;
  }
}

if (!loadedPath || result?.error) {
  console.warn(`⚠️  Could not load .env.recording from any of these paths:`);
  possiblePaths.forEach(p => console.warn(`   - ${p}`));
  if (result?.error) {
    console.warn(`   Last error: ${result.error.message}`);
  }
  console.warn(`   Current working directory: ${process.cwd()}`);
  console.warn(`   Config file directory: ${__dirname}`);
} else {
  console.log(`✅ Loaded .env.recording from ${loadedPath}`);
  console.log(`   Found variables: ${Object.keys(result.parsed || {}).join(', ')}`);
}

export interface RecordingConfig {
  email: string;
  password: string;
  outputDir: string;
}

export const config: RecordingConfig = {
  email: process.env.RECORDING_EMAIL || '',
  password: process.env.RECORDING_PASSWORD || '',
  outputDir: process.env.RECORDING_OUTPUT_DIR || path.join(process.cwd(), 'recordings'),
};

// Validate required configuration
if (!config.email || !config.password) {
  console.warn('⚠️  RECORDING_EMAIL and RECORDING_PASSWORD not set in .env.recording');
  console.warn('   Create .env.recording file with:');
  console.warn('   RECORDING_EMAIL=your@email.com');
  console.warn('   RECORDING_PASSWORD=yourpassword');
}
