/**
 * Zoom Processor - Applies zoom effects to video using FFmpeg
 */

import { spawnAsync } from './exec-helpers';
import { ZoomTrigger } from './zoom-tracker';
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
  zoomLevel: 1.2,
  zoomInDuration: 0.35,
  zoomOutDuration: 0.35,
  easing: 'easeInOut',
};

/** Escape commas inside a filter option expression (commas separate filters). */
function escFilterCommas(expr: string): string {
  return expr.replace(/,/g, '\\,');
}

/**
 * Zoom level over time for one trigger segment (seconds since segment start).
 * Uses if() so FFmpeg's expression parser accepts it reliably.
 */
function buildZoomLevelExpr(
  zoomIn: number,
  zoomOut: number,
  targetZoom: number,
  segmentDuration: number
): string {
  const holdEnd = Math.max(zoomIn, segmentDuration - zoomOut).toFixed(3);
  const zIn = `1+${(targetZoom - 1).toFixed(4)}*t/${zoomIn}`;
  const zOut = `${targetZoom}-${(targetZoom - 1).toFixed(4)}*(t-${holdEnd})/${zoomOut}`;
  return `if(lt(t,${zoomIn}),${zIn},if(lte(t,${holdEnd}),${targetZoom},${zOut}))`;
}

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

  for (const trigger of sortedTriggers) {
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
    const segmentDuration = trigger.endTime - trigger.startTime;
    const RCX = Math.round(trigger.centerX);
    const RCY = Math.round(trigger.centerY);

    const zExpr = buildZoomLevelExpr(IN, OUT, Z, segmentDuration);
    const wExpr = escFilterCommas(`${videoWidth}*(${zExpr})`);
    const hExpr = escFilterCommas(`${videoHeight}*(${zExpr})`);
    const xExpr = escFilterCommas(
      `max(0,min(${RCX}*(${zExpr})-${videoWidth / 2},iw-${videoWidth}))`
    );
    const yExpr = escFilterCommas(
      `max(0,min(${RCY}*(${zExpr})-${videoHeight / 2},ih-${videoHeight}))`
    );

    filterParts.push(
      `[v${segIdx}]trim=start=${trigger.startTime.toFixed(3)}:end=${trigger.endTime.toFixed(3)},setpts=PTS-STARTPTS,scale=w='${wExpr}':h='${hExpr}':eval=frame,crop=${videoWidth}:${videoHeight}:x='${xExpr}':y='${yExpr}',setsar=1:1[seg${segIdx}]`
    );
    segmentLabels.push(`[seg${segIdx}]`);
    segIdx++;
    currentTime = trigger.endTime;
  }

  filterParts.push(
    `[v${segIdx}]trim=start=${currentTime.toFixed(3)},setpts=PTS-STARTPTS,setsar=1:1[seg${segIdx}]`
  );
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
  const isWebm = outputVideoPath.toLowerCase().endsWith('.webm');
  const codec = isWebm ? 'libvpx-vp9' : 'libx264';
  const ffmpegArgs = [
    '-i',
    inputVideoPath,
    '-filter_complex',
    filter,
    '-map',
    '[outv]',
    '-c:v',
    codec,
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '23',
    '-preset',
    isWebm ? 'good' : 'medium',
    '-an',
    '-y',
    outputVideoPath,
  ];
  try {
    await spawnAsync('ffmpeg', ffmpegArgs, { maxBuffer: 20 * 1024 * 1024 });
    console.log(`  ✅ Zoom effects applied successfully`);
  } catch (error: unknown) {
    const err = error as { message?: string; stderr?: string; code?: number };
    console.error(`  ❌ FFmpeg failed: ${err.message ?? error}`);
    if (err.stderr) {
      const tail = err.stderr.trim().split('\n').slice(-8).join('\n');
      console.error(`  FFmpeg output:\n${tail}`);
    }
    throw error;
  }
}
