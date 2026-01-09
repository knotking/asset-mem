/**
 * Test script to run FFmpeg with zoom effects
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnAsync } from './exec-helpers';
import { ZoomTrigger } from './zoom-tracker';

async function testFFmpeg() {
  // Read zoom events
  const eventsPath = path.join(__dirname, '../../recordings', 'zoom-events-2026-01-18T14-33-36.json');
  const eventsData = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'));
  const triggers: ZoomTrigger[] = eventsData.triggers;

  if (triggers.length === 0) {
    console.log('❌ No triggers found');
    process.exit(1);
  }

  console.log(`📊 Found ${triggers.length} trigger(s)`);

  // Use first trigger for testing
  const trigger = triggers[0];
  const start = trigger.startTime.toFixed(3);
  const end = trigger.endTime.toFixed(3);
  const x = trigger.centerX.toFixed(0);
  const y = trigger.centerY.toFixed(0);
  const zoom = trigger.zoomLevel.toFixed(2);

  console.log(`\n🎯 Testing with trigger:`);
  console.log(`   Time: ${start}s - ${end}s`);
  console.log(`   Position: (${x}, ${y})`);
  console.log(`   Zoom: ${zoom}x`);

  // Generate filter expressions
  const zoomedX = `${x}-(iw/${zoom}/2)`;
  const zoomedY = `${y}-(ih/${zoom}/2)`;
  const normalX = '0';
  const normalY = '0';
  
  // Build expressions with proper quoting (matching zoom-processor.ts)
  const zoomExpr = `between(t,${start},${end})?${zoom}:1`;
  const xExpr = `between(t,${start},${end})?(${zoomedX}):${normalX}`;
  const yExpr = `between(t,${start},${end})?(${zoomedY}):${normalY}`;

  // FFmpeg filter - expressions with special chars need quotes
  // Single quotes prevent FFmpeg from interpreting colons as parameter separators
  const filter = `[0:v]zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':s=1920x1080[outv]`;

  console.log(`\n📹 Filter expression:`);
  console.log(`   ${filter}`);

  // Run FFmpeg
  const inputPath = path.join(__dirname, '../../recordings', 'webapp-recording-2026-01-18T14-33-36.webm');
  const outputPath = path.join(__dirname, '../../recordings', 'webapp-recording-zoomed-test.webm');

  const args = [
    '-i', inputPath,
    '-filter_complex', filter,
    '-c:v', 'libvpx-vp9',
    '-pix_fmt', 'yuv420p',
    '-crf', '23',
    '-preset', 'medium',
    '-y',
    outputPath,
  ];

  console.log(`\n🚀 Running FFmpeg...`);

  try {
    await spawnAsync('ffmpeg', args, {
      maxBuffer: 10 * 1024 * 1024,
    });

    console.log(`\n✅ FFmpeg completed successfully!`);
    console.log(`   Output: ${outputPath}`);
  } catch (error: any) {
    console.error(`\n❌ FFmpeg failed: ${error.message}`);
    if (error.stderr) {
      console.error(`\nError output:\n${error.stderr.substring(0, 500)}`);
    }
    process.exit(1);
  }
}

testFFmpeg().catch(console.error);
