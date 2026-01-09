/**
 * Direct test of zoom processor
 */

import * as fs from 'fs';
import * as path from 'path';
import { applyZoomEffects } from './zoom-processor';
import { ZoomTrigger } from './zoom-tracker';

async function main() {
  const recordingsDir = path.join(__dirname, '../../recordings');
  
  // Input files
  const eventsPath = path.join(recordingsDir, 'zoom-events-2026-01-18T14-33-36.json');
  const inputVideoPath = path.join(recordingsDir, 'webapp-recording-2026-01-18T14-33-36.webm');
  const outputVideoPath = path.join(recordingsDir, 'webapp-recording-zoomed-test.webm');

  // Read triggers
  const eventsData = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'));
  const triggers: ZoomTrigger[] = eventsData.triggers;

  console.log(`📊 Found ${triggers.length} trigger(s)`);

  // Apply zoom effects
  await applyZoomEffects(inputVideoPath, outputVideoPath, triggers, {
    videoWidth: 1920,
    videoHeight: 1080,
    fps: 30,
    zoomLevel: 1.8,
  });

  console.log('\n✅ Test completed!');
}

main().catch(console.error);
