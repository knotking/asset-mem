/**
 * API client functions for checkpoint operations
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.homegeekpro.com';

/**
 * Trigger AI analysis for a checkpoint
 */
export async function analyzeCheckpoint(checkpointId: string, mediaGsURI: string) {
  const response = await fetch(`${API_URL}/analyze-checkpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      checkpointId,
      mediaGsURI,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to trigger analysis: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Compare two checkpoints
 */
export async function compareCheckpoints(checkpointId1: string, checkpointId2: string) {
  const response = await fetch(`${API_URL}/compare-checkpoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      checkpointId1,
      checkpointId2,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to compare checkpoints: ${response.statusText}`);
  }

  return response.json();
}

