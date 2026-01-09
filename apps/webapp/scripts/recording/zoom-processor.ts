/**
 * Zoom Processor - Applies zoom effects to video using FFmpeg
 */

import { spawnAsync } from './exec-helpers';
import { ZoomTrigger } from './zoom-tracker';
import * as path from 'path';
import * as fs from 'fs';

export interface ZoomProcessorConfig {
  videoWidth: number;
  videoHeight: number;
  fps: number;
  zoomLevel?: number;
  zoomInDuration?: number;
  zoomOutDuration?: number;
  easing?: 'linear' | 'easeInOut';
}

const DEFAULT_CONFIG: ZoomProcessorConfig = {
  videoWidth: 1920,
  videoHeight: 1080,
  fps: 30,
  zoomLevel: 1.8,
  zoomInDuration: 0.5,
  zoomOutDuration: 0.5,
  easing: 'easeInOut',
};

function generateZoomPanFilter(
  triggers: ZoomTrigger[],
  config: ZoomProcessorConfig
): string {
  if (triggers.length === 0) return '[0:v]copy[outv]';

  const { videoWidth, videoHeight, zoomLevel = 1.8 } = config;
  const sortedTriggers = [...triggers].sort((a, b) => a.startTime - b.startTime);

  let numSegments = 0;
  let currentTime = 0;
  for (const trigger of sortedTriggers) {
    if (trigger.startTime > currentTime) numSegments++;
    numSegments++;
    currentTime = trigger.endTime;
  }
  numSegments++;

  const filterParts: string[] = [];
  const segmentLabels: string[] = [];
  const splitLabels = Array.from({ length: numSegments }, (_, i) => `[v${i}]`).join('');
  filterParts.push(`[0:v]split=${numSegments}${splitLabels}`);

  let segIdx = 0;
  currentTime = 0;

  for (let i = 0; i < sortedTriggers.length; i++) {
    const trigger = sortedTriggers[i];

    if (trigger.startTime > currentTime) {
      filterParts.push(
        `[v${segIdx}]trim=start=${currentTime.toFixed(3)}:end=${trigger.startTime.toFixed(3)},setpts=PTS-STARTPTS,setsar=1:1[seg${segIdx}]`
      );
      segmentLabels.push(`[seg${segIdx}]`);
      segIdx++;
    }

    const IN = config.zoomInDuration || 0.5;
    const OUT = config.zoomOutDuration || 0.5;
    const Z = trigger.zoomLevel || zoomLevel;
    const D = (trigger.endTime - trigger.startTime).toFixed(3);
    const D_OUT = (trigger.endTime - trigger.startTime - OUT).toFixed(3);

    // NO PARENTHESES AT ALL except for conditions
    const z_in = "1+" + (Z - 1) + "*t/" + IN;
    const z_out = Z + "-" + (Z - 1) + "*(t-" + D_OUT + ")/" + OUT;
    const Z_expr = "(t<" + IN + ")*(" + z_in + ")+(t>=" + IN + ")*(t<=" + D_OUT + ")*" + Z + "+(t>" + D_OUT + ")*(" + z_out + ")";

    const RCX = Math.round(trigger.centerX);
    const RCY = Math.round(trigger.centerY);

    const W_expr = videoWidth + "*(" + Z_expr + ")";
    const H_expr = videoHeight + "*(" + Z_expr + ")";

    // Center crop coordinates
    const X_expr = RCX + "*(" + Z_expr + ")-" + (videoWidth / 2);
    const Y_expr = RCY + "*(" + Z_expr + ")-" + (videoHeight / 2);

    // Minimalistic safe clamping
    const X_safe = "max(0,min(" + X_expr + "," + W_expr + "-" + videoWidth + "))";
    const Y_safe = "max(0,min(" + Y_expr + "," + H_expr + "-" + videoHeight + "))";

    // IMPORTANT: Escape the commas in min() and max() manually with \
    const X_esc = X_safe.replace(/,/g, "\\,");
    const Y_esc = Y_safe.replace(/,/g, "\\,");

    filterParts.push(
      `[v${segIdx}]trim=start=${trigger.startTime.toFixed(3)}:end=${trigger.endTime.toFixed(3)},setpts=PTS-STARTPTS,scale=w='${W_expr}':h='${H_expr}':eval=frame,crop=${videoWidth}:${videoHeight}:x='${X_esc}':y='${Y_esc}',setsar=1:1[seg${segIdx}]`
    );
    segmentLabels.push(`[seg${segIdx}]`);
    segIdx++;
    currentTime = trigger.endTime;
  }

  filterParts.push(`[v${segIdx}]trim=start=${currentTime.toFixed(3)},setpts=PTS-STARTPTS,setsar=1:1[seg${segIdx}]`);
  segmentLabels.push(`[seg${segIdx}]`);
  filterParts.push(`${segmentLabels.join('')}concat=n=${segmentLabels.length}:v=1:a=0[outv]`);

  return filterParts.join(';');
}

export async function applyZoomEffects(
  inputVideoPath: string,
  outputVideoPath: string,
  triggers: ZoomTrigger[],
  config: ZoomProcessorConfig = DEFAULT_CONFIG
): Promise<void> {
  if (triggers.length === 0) {
    if (inputVideoPath !== outputVideoPath) fs.copyFileSync(inputVideoPath, outputVideoPath);
    return;
  }
  console.log(`  🎬 Applying ${triggers.length} premium zoom effect(s)...`);
  const filter = generateZoomPanFilter(triggers, config);
  const codec = 'libx264';
  const ffmpegArgs = ['-i', inputVideoPath, '-filter_complex', filter, '-map', '[outv]', '-c:v', codec, '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'medium', '-y', outputVideoPath];
  try {
    await spawnAsync('ffmpeg', ffmpegArgs, { maxBuffer: 20 * 1024 * 1024 });
    console.log(`  ✅ Zoom effects applied successfully`);
  } catch (error: any) {
    console.error(`  ❌ FFmpeg failed: ${error.message}`);
    throw error;
  }
}
