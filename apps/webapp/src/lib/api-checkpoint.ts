/**
 * API client functions for checkpoint operations
 */

import { apiUrls } from "./utils";

export interface AnalyzeCheckpointInput {
  imageUrl: string;
  contentType: string;
  location?: string;
  checkpointId: string;
  userId: string;
  propertyId: string;
}

/**
 * Trigger AI analysis for a checkpoint
 */
export async function analyzeCheckpoint(input: AnalyzeCheckpointInput) {
  const response = await fetch(apiUrls.analyzeCheckpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to trigger analysis: ${response.statusText}`);
  }

  return response.json();
}

export interface CompareCheckpointsInput {
  image1Url: string;
  image2Url: string;
  contentType1: string;
  contentType2: string;
  location?: string;
}

/**
 * Compare two checkpoints
 */
export async function compareCheckpoints(input: CompareCheckpointsInput) {
  const response = await fetch(apiUrls.compareCheckpoints(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to compare checkpoints: ${response.statusText}`);
  }

  return response.json();
}
