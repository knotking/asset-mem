/**
 * API client functions for checkpoint operations
 */

import { apiUrls } from "./utils";
import { proxyFetchWithAuth } from "./correlation-id";
import { getFirebaseIdTokenForProxy } from "./proxy-auth";
import { createLogger, truncateId } from "./logger";

const log = createLogger("checkpoint");

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
  log.info("analysis.request", {
    checkpointId: truncateId(input.checkpointId),
    propertyId: truncateId(input.propertyId),
  });

  const response = await proxyFetchWithAuth(apiUrls.analyzeCheckpoint(), getFirebaseIdTokenForProxy, {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    log.error("analysis.failed", { status: response.status });
    throw new Error(`Failed to trigger analysis: ${response.statusText}`);
  }

  const result = await response.json();
  log.info("analysis.accepted", { checkpointId: truncateId(input.checkpointId) });
  return result;
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
  log.info("comparison.request");

  const response = await proxyFetchWithAuth(apiUrls.compareCheckpoints(), getFirebaseIdTokenForProxy, {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    log.error("comparison.failed", { status: response.status });
    throw new Error(`Failed to compare checkpoints: ${response.statusText}`);
  }

  log.info("comparison.complete");
  return response.json();
}
