// API utilities for checkpoint operations

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export interface AnalyzeCheckpointInput {
  imageUrl: string;
  contentType: string;
  location?: string;
  checkpointId: string;
  userId: string;
  propertyId: string;
}

export interface CompareCheckpointsInput {
  image1Url: string;
  image2Url: string;
  contentType1: string;
  contentType2: string;
  location?: string;
}

export interface CompareCheckpointsOutput {
  summary: string;
  similarityScore: number;
  semanticChanges: string[];
  regions: Array<{
    description: string;
    changeType: 'added' | 'removed' | 'modified';
    severity: 'minor' | 'moderate' | 'major' | 'critical';
    confidence: number;
    bbox?: { x: number; y: number; width: number; height: number };
  }>;
}

export async function analyzeCheckpoint(input: AnalyzeCheckpointInput): Promise<void> {
  try {
    const url = `${API_BASE_URL}/analyze-checkpoint`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Failed to analyze checkpoint, status: ${response.status}, body: ${errorBody}`
      );
    }

    // Returns 202 Accepted - analysis is async via Pub/Sub
    return;
  } catch (error) {
    console.error('Error analyzing checkpoint:', error);
    throw error;
  }
}

export async function compareCheckpoints(
  input: CompareCheckpointsInput
): Promise<CompareCheckpointsOutput> {
  try {
    const url = `${API_BASE_URL}/compare-checkpoints`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Failed to compare checkpoints, status: ${response.status}, body: ${errorBody}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error comparing checkpoints:', error);
    throw error;
  }
}

