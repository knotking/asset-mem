/**
 * Cut Processor - Removes "waiting for AI response" segment from video using FFmpeg
 */

import { spawnAsync } from "./exec-helpers";
import * as path from "path";
import * as fs from "fs";

export interface WaitCutSegment {
  startSec: number;
  endSec: number;
}

/**
 * Removes the segment [startSec, endSec] from the video.
 * Produces output = [0, startSec) + [endSec, end].
 */
export async function applyWaitCut(
  inputPath: string,
  outputPath: string,
  segment: WaitCutSegment
): Promise<void> {
  await applyWaitCuts(inputPath, outputPath, [segment]);
}

/**
 * Removes multiple segments from the video.
 * Segments are sorted by start time and removed sequentially.
 * Produces output with all segments removed.
 */
export async function applyWaitCuts(
  inputPath: string,
  outputPath: string,
  segments: WaitCutSegment[]
): Promise<void> {
  if (segments.length === 0) {
    // No cuts needed, just copy the file
    fs.copyFileSync(inputPath, outputPath);
    return;
  }

  // Sort segments by start time
  const sortedSegments = [...segments].sort((a, b) => a.startSec - b.startSec);
  
  // Validate and merge overlapping segments
  const mergedSegments: WaitCutSegment[] = [];
  for (const segment of sortedSegments) {
    if (segment.startSec >= segment.endSec) {
      console.warn(`  ⚠️  Skipping invalid segment: start=${segment.startSec}s >= end=${segment.endSec}s`);
      continue;
    }
    
    if (mergedSegments.length === 0) {
      mergedSegments.push(segment);
    } else {
      const last = mergedSegments[mergedSegments.length - 1];
      // If segments overlap or are adjacent, merge them
      if (segment.startSec <= last.endSec) {
        last.endSec = Math.max(last.endSec, segment.endSec);
      } else {
        mergedSegments.push(segment);
      }
    }
  }
  
  console.log(`  📊 Processing ${mergedSegments.length} segment(s) to cut:`);
  mergedSegments.forEach((seg, i) => {
    console.log(`    ${i + 1}. ${seg.startSec.toFixed(2)}s - ${seg.endSec.toFixed(2)}s (${(seg.endSec - seg.startSec).toFixed(2)}s)`);
  });
  
  // Get video duration
  const duration = await getVideoDuration(inputPath);
  console.log(`  📹 Video duration: ${duration.toFixed(2)}s`);
  
  if (mergedSegments.length === 0) {
    console.log("  ℹ️  No valid segments to cut, copying original video");
    fs.copyFileSync(inputPath, outputPath);
    return;
  }
  
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const parts: string[] = [];
  const tempFiles: string[] = [];
  const listPath = path.join(dir, `${base}-cut-list.txt`);

  try {
    // Create parts: [0, seg1.start), [seg1.end, seg2.start), ..., [lastSeg.end, end]
    let currentStart = 0;
    
    for (let i = 0; i < mergedSegments.length; i++) {
      const segment = mergedSegments[i];
      
      // Validate segment bounds
      if (segment.startSec < 0) {
        console.warn(`  ⚠️  Segment ${i + 1} has negative start time, adjusting to 0`);
        segment.startSec = 0;
      }
      if (segment.endSec > duration) {
        console.warn(`  ⚠️  Segment ${i + 1} extends beyond video duration, adjusting to ${duration.toFixed(2)}s`);
        segment.endSec = duration;
      }
      
      // Part before this segment
      if (segment.startSec > currentStart && segment.startSec - currentStart > 0.1) {
        // Only create part if there's at least 0.1 seconds of content
        const partFile = path.join(dir, `${base}-cut-part-${i * 2}.webm`);
        tempFiles.push(partFile);
        const partDuration = segment.startSec - currentStart;
        console.log(`  ✂️  Creating part ${i * 2}: ${currentStart.toFixed(2)}s - ${segment.startSec.toFixed(2)}s (${partDuration.toFixed(2)}s)`);
        
        // Use -ss before -i for better accuracy with -c copy
        await spawnAsync("ffmpeg", [
          "-y",
          "-ss",
          String(currentStart),
          "-i",
          inputPath,
          "-t",
          String(partDuration),
          "-c",
          "copy",
          "-avoid_negative_ts",
          "make_zero",
          partFile,
        ]);
        parts.push(partFile);
      } else if (segment.startSec <= currentStart) {
        console.warn(`  ⚠️  Segment ${i + 1} overlaps with previous, skipping part creation`);
      }
      
      currentStart = Math.max(currentStart, segment.endSec);
    }
    
    // Final part: [lastSeg.end, end]
    if (currentStart < duration && duration - currentStart > 0.1) {
      const partFile = path.join(dir, `${base}-cut-part-final.webm`);
      tempFiles.push(partFile);
      const finalDuration = duration - currentStart;
      console.log(`  ✂️  Creating final part: ${currentStart.toFixed(2)}s - ${duration.toFixed(2)}s (${finalDuration.toFixed(2)}s)`);
      
      await spawnAsync("ffmpeg", [
        "-y",
        "-ss",
        String(currentStart),
        "-i",
        inputPath,
        "-c",
        "copy",
        "-avoid_negative_ts",
        "make_zero",
        partFile,
      ]);
      parts.push(partFile);
    }
    
    if (parts.length === 0) {
      console.warn("  ⚠️  No parts created, all content was cut. Creating empty video or copying original.");
      // If all content was cut, create a minimal video or just copy original
      fs.copyFileSync(inputPath, outputPath);
      return;
    }
    
    console.log(`  📋 Created ${parts.length} part(s) to concatenate`);

    // Create concat list
    const toConcatPath = (p: string) =>
      path.resolve(p).replace(/\\/g, "/");
    const listContent = parts
      .map((p) => `file '${toConcatPath(p).replace(/'/g, "'\\''")}'`)
      .join("\n");
    fs.writeFileSync(listPath, listContent, "utf8");
    tempFiles.push(listPath);

    console.log(`  🔗 Concatenating ${parts.length} part(s)...`);
    
    // Concatenate all parts
    await spawnAsync("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      "-avoid_negative_ts",
      "make_zero",
      outputPath,
    ]);
    
    // Verify output file was created and has content
    if (fs.existsSync(outputPath)) {
      const outputDuration = await getVideoDuration(outputPath).catch(() => 0);
      console.log(`  ✅ Cut video created: ${path.basename(outputPath)} (${outputDuration.toFixed(2)}s)`);
    } else {
      throw new Error("Output video file was not created");
    }
  } finally {
    // Clean up temp files
    for (const p of tempFiles) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Get video duration in seconds using ffprobe
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  try {
    const result = await spawnAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ]);
    return parseFloat(result.stdout.trim());
  } catch (error) {
    console.warn(`  ⚠️  Could not get video duration, using fallback: ${error instanceof Error ? error.message : String(error)}`);
    // Fallback: assume a large duration (will be trimmed by actual video length)
    return 3600; // 1 hour
  }
}
