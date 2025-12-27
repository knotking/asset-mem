// API functions for checkpoint analysis and comparison
// These call the backend services that process checkpoints with AI

const CHECKPOINT_ANALYSIS_URL = process.env.NEXT_PUBLIC_CHECKPOINT_ANALYSIS_URL || 
  'https://homeapp-api-886043522424.us-central1.run.app/analyze-checkpoint';

export interface AnalyzeCheckpointInput {
  checkpointId: string;
  mediaGsURI: string;
  userId?: string;
  propertyId?: string;
}

export interface AnalyzeCheckpointOutput {
  status: 'accepted';
  message: string;
  checkpointId: string;
}

export async function analyzeCheckpoint(
  input: AnalyzeCheckpointInput
): Promise<AnalyzeCheckpointOutput> {
  try {
    const url = CHECKPOINT_ANALYSIS_URL;
    if (!url) {
      throw new Error('CHECKPOINT_ANALYSIS_URL not set.');
    }

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

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error analyzing checkpoint:', error);
    throw error;
  }
}

