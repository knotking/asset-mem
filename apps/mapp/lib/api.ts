import { fetch } from 'expo/fetch';
import Constants from 'expo-constants';
import { buildAgentSearchLocation } from '@homeapp/common/lib/search-location';
import type {
  AgentStep,
  LocationData,
  PrimaryAgent,
  SearchLocationInput,
} from '@homeapp/common/types';
import { proxyFetchWithAuth } from '@homeapp/common/lib/correlation-id';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import { createLogger, parseAgentErrorCode, truncateId } from '@/lib/logger';

const log = createLogger('agent');

// Get environment-specific URLs from EAS build configuration
const extra = Constants.expoConfig?.extra || {};

const AGENT_SESSION_URL = extra.agentSessionUrl || '';
const AGENT_SSE_URL = extra.agentSseUrl || '';
const RAG_FILE_UPLOAD_URL = extra.ragFileUploadUrl || '';
const DOCUMENT_ANALYSIS_URL = extra.documentAnalysisUrl || '';
const CHECKPOINT_ANALYSIS_URL = extra.checkpointAnalysisUrl || '';
const CHECKPOINT_COMPARISON_URL = extra.checkpointComparisonUrl || '';

// Web app URL for sharing links
export const WEB_APP_URL = extra.webAppUrl || '';

export async function createAgentSession(
  userId: string
): Promise<{ agentSessionId?: string; error?: string }> {
  try {
    const url = AGENT_SESSION_URL;
    if (!url) {
      throw new Error('AGENT_SESSION_URL not set.');
    }

    const response = await proxyFetchWithAuth(url, getFirebaseIdTokenForProxy, {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to create session, status: ${response.status}, body: ${errorBody}`);
    }

    const data = await response.json();
    const agentSessionId = data.id;

    if (!agentSessionId) {
      throw new Error('session_id not found in response');
    }

    log.info('session.created', { agentSessionId: truncateId(agentSessionId) });
    return { agentSessionId };
  } catch (error) {
    log.error('session.create.error', undefined, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { error: `Failed to create agent session: ${errorMessage}` };
  }
}

/**
 * Delete an agent session from the backend
 */
export async function deleteAgentSession(
  userId: string,
  agentSessionId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const url = AGENT_SESSION_URL;
    if (!url) {
      log.warn('session.delete.urlNotSet');
      return { success: true };
    }

    const response = await proxyFetchWithAuth(url, getFirebaseIdTokenForProxy, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: userId, session_id: agentSessionId }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        log.warn('session.delete.notFound', { agentSessionId: truncateId(agentSessionId) });
        return { success: true };
      }
      const errorBody = await response.text();
      throw new Error(`Failed to delete session, status: ${response.status}, body: ${errorBody}`);
    }

    log.info('session.deleted', { agentSessionId: truncateId(agentSessionId) });
    return { success: true };
  } catch (error) {
    log.error('session.delete.error', { agentSessionId: truncateId(agentSessionId) }, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { error: `Failed to delete agent session: ${errorMessage}` };
  }
}

export interface StreamAgentResponseParams {
  userId: string;
  agentSessionId: string;
  userQuery: string;
  contextDocURIs?: string[];
  checkpointIds?: string[]; // Checkpoint IDs for checkpoint context
  propertyAddress?: string;
  primaryAgent?: PrimaryAgent;
  checkpointOptionalAgents?: string[];
  searchLocation?: SearchLocationInput;
  /** @deprecated Use searchLocation */
  locationData?: LocationData;
  signal?: AbortSignal;
  /** Firebase chat doc id (for correlating with proxy persistence logs). */
  firebaseChatId?: string;
  onChunk?: (content: string) => void;
  onAgentStep?: (step: AgentStep) => void;
  onComplete?: (finalResponse: string, agentSteps: AgentStep[]) => void;
  onError?: (error: Error) => void;
}

export async function streamAgentResponse({
  userId,
  agentSessionId,
  userQuery,
  contextDocURIs = [],
  checkpointIds = [],
  propertyAddress,
  primaryAgent,
  checkpointOptionalAgents = [],
  searchLocation,
  locationData,
  signal,
  firebaseChatId,
  onChunk,
  onAgentStep,
  onComplete,
  onError,
}: StreamAgentResponseParams): Promise<void> {
  const startedAt = Date.now();
  const correlationId = createCorrelationId();
  const streamMeta = {
    correlationId: truncateId(correlationId),
    firebaseChatId: truncateId(firebaseChatId),
    agentSessionId: truncateId(agentSessionId),
    primaryAgent: primaryAgent ?? 'default',
    docCount: contextDocURIs.length,
    checkpointCount: checkpointIds.length,
  };

  log.info('stream.start', streamMeta);

  try {
    const url = AGENT_SSE_URL;
    if (!url) {
      throw new Error('AGENT_SSE_URL not set.');
    }

    const requestBody: Record<string, any> = {
      user_id: userId,
      session_id: agentSessionId,
      user_query: userQuery,
      context_doc_uris: contextDocURIs,
      property_address: propertyAddress,
    };

    if (primaryAgent === 'checkpoint') {
      if (checkpointIds.length > 0) {
        requestBody.checkpoint_ids = checkpointIds;
      }
      if (checkpointOptionalAgents.length > 0) {
        requestBody.checkpoint_optional_agents = checkpointOptionalAgents;
      }
    }

    // Backend no longer accepts analysis as an explicit primary agent.
    if (primaryAgent === 'docs' || primaryAgent === 'checkpoint') {
      requestBody.primary_agent = primaryAgent;
    }

    const resolvedSearchLocation = buildAgentSearchLocation(
      searchLocation ?? locationData,
      propertyAddress
    );
    if (resolvedSearchLocation) {
      requestBody.search_location = resolvedSearchLocation;
    }

    const response = await proxyFetchWithAuth(url, getFirebaseIdTokenForProxy, {
      method: 'POST',
      correlationId,
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const code = parseAgentErrorCode(errorBody);
      log.error('stream.httpError', { status: response.status, code });
      throw new Error(
        code === 'TOKEN_QUOTA_EXCEEDED'
          ? 'Monthly AI usage limit reached.'
          : `Failed to stream response, status: ${response.status}`
      );
    }

    // Check if streaming is supported (response.body exists)
    if (!response.body) {
      // Fallback: Read entire response at once (non-streaming)
      const fullText = await response.text();

      // Check for error
      if (fullText.startsWith('STREAM_ERROR:')) {
        throw new Error(fullText.substring('STREAM_ERROR:'.length));
      }

      // Parse agent steps and content from full response
      const agentStatusRegex = /\*\*.*?Agent\*\* (\w+): (.+)/g;
      let finalAssistantResponse = fullText;
      const agentSteps: AgentStep[] = [];

      // Extract agent steps
      let match;
      while ((match = agentStatusRegex.exec(fullText)) !== null) {
        const status = match[1].toLowerCase() as
          | 'transferredto'
          | 'executing'
          | 'completed'
          | 'failed';
        const name = match[2];

        const existingStepIndex = agentSteps.findIndex((step) => step.name === name);
        if (existingStepIndex > -1) {
          agentSteps[existingStepIndex].status = status;
        } else {
          agentSteps.push({ name, status });
        }

        if (onAgentStep) {
          onAgentStep({ name, status });
        }

        // Remove agent step markers from final content
        finalAssistantResponse = finalAssistantResponse.replace(match[0], '');
      }

      // Send the full response as one chunk
      if (onChunk && finalAssistantResponse.trim()) {
        onChunk(finalAssistantResponse);
      }

      // Complete
      if (onComplete) {
        // Check if response is empty and provide helpful error message
        const finalResponse =
          finalAssistantResponse.trim() ||
          "I apologize, but I wasn't able to generate a response. This might be due to a temporary issue. Please try asking your question again after some time.";
        onComplete(finalResponse, agentSteps);
      }

      log.info('stream.complete', {
        ...streamMeta,
        durationMs: Date.now() - startedAt,
        mode: 'buffered',
      });
      return;
    }

    // Streaming mode (if response.body is available)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let finalAssistantResponse = '';
    let agentSteps: AgentStep[] = [];
    const agentStatusRegex = /\*\*.*?Agent\*\* (\w+): (.+)/;
    let chunkCount = 0;
    let byteCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const rawChunk = decoder.decode(value, { stream: true });
      byteCount += value.byteLength;
      chunkCount += 1;

      // Check for error prefix
      if (rawChunk.startsWith('STREAM_ERROR:')) {
        throw new Error(rawChunk.substring('STREAM_ERROR:'.length));
      }

      // Skip empty chunks (just newlines or whitespace)
      if (!rawChunk || rawChunk.trim().length === 0) {
        continue;
      }

      // Parse agent status updates (e.g., "**Agent** Executing: SearchTool")
      const match = rawChunk.match(agentStatusRegex);
      if (match) {
        const status = match[1].toLowerCase() as
          | 'transferredto'
          | 'executing'
          | 'completed'
          | 'failed';
        const name = match[2];

        // Find existing step or create new one
        const existingStepIndex = agentSteps.findIndex((step) => step.name === name);
        if (existingStepIndex > -1) {
          agentSteps[existingStepIndex].status = status;
        } else {
          agentSteps.push({ name, status });
        }

        // Notify callback
        if (onAgentStep) {
          onAgentStep({ name, status });
        }
      } else {
        // Regular content chunks
        finalAssistantResponse += rawChunk;
        if (onChunk) {
          onChunk(rawChunk);
        }
      }
    }

    // Complete
    if (onComplete) {
      // Strip agent name prefix (e.g., "**Doculink Agent**: " or "**Analysis Agent**: ")
      // This removes the prefix added by the backend streaming function
      const strippedResponse = finalAssistantResponse.replace(/^\*\*[^*]+\*\*:\s*/, '');

      // Check if response is empty and provide helpful error message
      const finalResponse =
        strippedResponse.trim() ||
        "I apologize, but I wasn't able to generate a response. This might be due to a temporary issue. Please try asking your question again after some time.";
      onComplete(finalResponse, agentSteps);
    }

    log.info('stream.complete', {
      ...streamMeta,
      durationMs: Date.now() - startedAt,
      chunkCount,
      byteCount,
    });
  } catch (error) {
    // Don't log or propagate AbortError - it's expected when user stops
    // Check for abort/cancellation errors from various sources
    if (
      error instanceof Error &&
      (error.name === 'AbortError' ||
        error.message.includes('FetchRequestCanceledException') ||
        error.message.includes('Fetch request has been canceled') ||
        error.message.includes('fetch failed'))
    ) {
      log.debug('stream.aborted', { ...streamMeta, durationMs: Date.now() - startedAt });
      return;
    }

    log.error('stream.failed', { ...streamMeta, durationMs: Date.now() - startedAt }, error);
    if (onError) {
      onError(error instanceof Error ? error : new Error('Unknown error occurred'));
    } else {
      throw error;
    }
  }
}

// Document analysis types
export type DocumentType =
  | 'DEED'
  | 'INSURANCE_POLICY'
  | 'UTILITY_BILL'
  | 'INSPECTION_REPORT'
  | 'MORTGAGE_STATEMENT'
  | 'OTHER';

export interface QueueExtractDocInfoInput {
  docId: string;
  docUrl: string;
  contentType: string;
  userId: string;
}

export interface QueueExtractDocInfoResult {
  status: string;
  message?: string;
  docId: string;
  messageId?: string;
}

/** Queue async document extraction (worker updates Firestore). */
export async function queueExtractDocInfo(
  input: QueueExtractDocInfoInput
): Promise<QueueExtractDocInfoResult> {
  if (!input.docId?.trim()) {
    throw new Error(
      'queueExtractDocInfo requires docId (Firestore path users/{uid}/docs/{docId}). Rebuild the app (expo start -c) after upgrading the document flow.'
    );
  }
  const url = DOCUMENT_ANALYSIS_URL;
  if (!url) {
    throw new Error('DOCUMENT_ANALYSIS_URL not set.');
  }

  const response = await proxyFetchWithAuth(url, getFirebaseIdTokenForProxy, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to queue document analysis, status: ${response.status}, body: ${errorBody}`
    );
  }

  return (await response.json()) as QueueExtractDocInfoResult;
}

/**
 * Upload file to RAG system for indexing
 */
export async function postFileToAgent(
  gsURI: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = RAG_FILE_UPLOAD_URL;
    if (!url) {
      throw new Error('RAG_FILE_UPLOAD_URL not set.');
    }

    const response = await proxyFetchWithAuth(url, getFirebaseIdTokenForProxy, {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        context_doc_uris: [gsURI],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      log.warn('rag.upload.failed', { status: response.status });
      // Don't throw - RAG failures shouldn't block document upload
      return { success: false, error: errorBody };
    }

    log.info('rag.upload.ok');
    return { success: true };
  } catch (error) {
    log.error('rag.upload.error', undefined, error);
    // Don't throw - RAG failures shouldn't block document upload
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export interface AnalyzeCheckpointInput {
  imageUrl: string;
  contentType: string;
  location?: string;
  assetType?: 'real_estate' | 'vehicle' | 'appliance' | 'other';
  checkpointId: string;
  userId: string;
  propertyId: string;
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

    const response = await proxyFetchWithAuth(url, getFirebaseIdTokenForProxy, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const code = parseAgentErrorCode(errorBody);
      if (code === 'CHECKPOINT_QUOTA_EXCEEDED') {
        throw new Error(
          'Monthly checkpoint limit reached. Upgrade your plan or wait until next month.'
        );
      }
      if (code === 'TOKEN_QUOTA_EXCEEDED') {
        throw new Error(
          'Monthly AI token limit reached. Upgrade your plan or wait until next month.'
        );
      }
      throw new Error(
        `Failed to analyze checkpoint, status: ${response.status}, body: ${errorBody}`
      );
    }

    const data = await response.json();
    log.info('checkpoint.analysis.accepted', { checkpointId: truncateId(input.checkpointId) });
    return data;
  } catch (error) {
    log.error(
      'checkpoint.analysis.failed',
      { checkpointId: truncateId(input.checkpointId) },
      error
    );
    throw error;
  }
}

export interface CompareCheckpointsInput {
  image1Url: string;
  image2Url: string;
  contentType1: string;
  contentType2: string;
  location?: string;
}

export interface ChangeRegion {
  description: string;
  changeType: 'added' | 'removed' | 'modified';
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  confidence: number;
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface CompareCheckpointsOutput {
  summary: string;
  similarityScore: number;
  semanticChanges: string[];
  regions: ChangeRegion[];
}

export async function compareCheckpoints(
  input: CompareCheckpointsInput
): Promise<CompareCheckpointsOutput> {
  try {
    const url = CHECKPOINT_COMPARISON_URL;
    if (!url) {
      throw new Error('CHECKPOINT_COMPARISON_URL not set.');
    }

    const response = await proxyFetchWithAuth(url, getFirebaseIdTokenForProxy, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Failed to compare checkpoints, status: ${response.status}, body: ${errorBody}`
      );
    }

    const data = await response.json();
    log.info('checkpoint.comparison.complete');
    return data;
  } catch (error) {
    log.error('checkpoint.comparison.failed', undefined, error);
    throw error;
  }
}

export interface AnalyzeMultipleCheckpointsInput {
  checkpointIds: string[];
  userId: string;
  propertyId: string;
}

export interface CheckpointTrend {
  label: string;
  value: string;
  direction: 'up' | 'down' | 'stable';
  description: string;
}

export interface TimelineItem {
  checkpointId: string;
  date: string;
  status: 'good' | 'warning' | 'critical';
  note: string;
}

export interface AnalyzeMultipleCheckpointsOutput {
  summary: string;
  trends: CheckpointTrend[];
  recommendations: string[];
  timeline: TimelineItem[];
}

/**
 * Analyze multiple checkpoints to generate insights and trends
 * Note: This is a placeholder for future backend implementation.
 * Currently returns a structure that can be populated by the frontend.
 */
export async function analyzeMultipleCheckpoints(
  input: AnalyzeMultipleCheckpointsInput
): Promise<AnalyzeMultipleCheckpointsOutput> {
  try {
    // TODO: Replace with actual backend endpoint when available
    // const url = CHECKPOINT_MULTI_ANALYSIS_URL;
    // if (!url) {
    //   throw new Error('CHECKPOINT_MULTI_ANALYSIS_URL not set.');
    // }

    // For now, return a structure that indicates backend support is needed
    // The CheckpointAnalysisModal will generate mock data based on checkpoint info
    throw new Error('Backend API for multi-checkpoint analysis not yet implemented');

    // Future implementation:
    // const response = await fetch(url, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(input),
    // });

    // if (!response.ok) {
    //   const errorBody = await response.text();
    //   throw new Error(
    //     `Failed to analyze checkpoints, status: ${response.status}, body: ${errorBody}`
    //   );
    // }

    // const data = await response.json();
    // return data;
  } catch (error) {
    log.error('checkpoint.multiAnalysis.failed', undefined, error);
    throw error;
  }
}

/**
 * Extracts the title from a checkpoint agent response.
 * Checkpoint agents return responses in dual format: Markdown + JSON code block.
 * The JSON contains an analysis.title field that should be used to rename the session.
 *
 * @param content The agent response content
 * @returns The title string if found, null otherwise
 */
export function extractCheckpointTitle(content: string): string | null {
  if (!content) return null;

  try {
    // Look for JSON code block in the response
    const jsonMatch = content.match(/```json\s*\n?([\s\S]*?)```/);
    if (!jsonMatch) return null;

    const jsonStr = jsonMatch[1].trim();
    const parsed = JSON.parse(jsonStr);

    // Check for checkpoint-specific fields to confirm this is a checkpoint response
    const analysis = parsed.analysis || parsed;
    const hasCheckpointData = !!(analysis.checkpointSummary || analysis.checkpointDetails);

    if (!hasCheckpointData) return null;

    // Extract title from analysis.title
    if (analysis.title && typeof analysis.title === 'string') {
      return analysis.title.trim();
    }

    return null;
  } catch (error) {
    // Failed to parse JSON or extract title
    return null;
  }
}
