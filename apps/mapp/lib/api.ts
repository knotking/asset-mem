import { fetch } from 'expo/fetch';
import Constants from 'expo-constants';
import { buildAgentSearchLocation } from '@homeapp/common/lib/search-location';
import type {
  AgentStep,
  LocationData,
  PrimaryAgent,
  SearchLocationInput,
} from '@homeapp/common/types';
import { createCorrelationId, proxyFetchWithAuth } from '@homeapp/common/lib/correlation-id';
import { compareCheckpointsFailureMessage } from '@homeapp/common/lib/document-analysis-errors';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import {
  mappPlanLimitMessageForErrorCode,
  monthlyQuotaExceededMessage,
} from '@/lib/ios-billing-compliance';
import { createLogger, parseAgentErrorCode, truncateId } from '@/lib/logger';

const log = createLogger('agent');

const AGENT_STATUS_LINE_REGEX = /\*\*.*?Agent\*\* (\w+): (.+)/;

function applyAgentStatusLine(
  line: string,
  agentSteps: AgentStep[],
  onAgentStep?: (step: AgentStep) => void
): boolean {
  const match = line.match(AGENT_STATUS_LINE_REGEX);
  if (!match) {
    return false;
  }
  const status = match[1].toLowerCase() as 'executing' | 'completed' | 'failed';
  const name = match[2];
  const existingStepIndex = agentSteps.findIndex((step) => step.name === name);
  if (existingStepIndex > -1) {
    agentSteps[existingStepIndex].status = status;
  } else {
    agentSteps.push({ name, status });
  }
  onAgentStep?.({ name, status });
  return true;
}

/** Process one SSE line. */
function processAgentSseLine(
  line: string,
  agentSteps: AgentStep[],
  handlers: {
    onAgentStep?: (step: AgentStep) => void;
    onContent?: (text: string) => void;
  }
): void {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  if (trimmed.startsWith('STREAM_ERROR:')) {
    throw new Error(trimmed.substring('STREAM_ERROR:'.length));
  }
  if (applyAgentStatusLine(trimmed, agentSteps, handlers.onAgentStep)) {
    return;
  }
  handlers.onContent?.(line);
}

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

/** Webapp settings deep link — opens the Plan & billing tab (after auth handoff). */
export const WEB_SETTINGS_BILLING_PATH = '/home/settings?tab=billing';

/** After handoff, opens billing tab and launches Stripe Customer Portal. */
export const WEB_SETTINGS_BILLING_PORTAL_PATH = '/home/settings?tab=billing&portal=1';

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
  propertyId?: string;
  primaryAgent?: PrimaryAgent;
  reportIds?: string[];
  reportRevisions?: Record<string, number>;
  checkpointOptionalAgents?: string[];
  searchLocation?: SearchLocationInput;
  /** @deprecated Use searchLocation */
  locationData?: LocationData;
  signal?: AbortSignal;
  /** Firebase chat doc id (for correlating with proxy persistence logs). */
  firebaseChatId?: string;
  /** Firestore assistant message doc id (lifecycle + agentSteps persistence). */
  assistantMessageId?: string;
  chatIntent?: 'discuss_analysis' | 'new_analysis' | 'replay_analysis';
  /** Structured chip tap — routes deterministically on the agent (single-loop pre-routing). */
  chipAction?: import('@homeapp/common/lib/suggested-actions').ChipAction;
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
  propertyId,
  primaryAgent,
  reportIds = [],
  reportRevisions,
  checkpointOptionalAgents = [],
  searchLocation,
  locationData,
  signal,
  firebaseChatId,
  assistantMessageId,
  chatIntent,
  chipAction,
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

    if (propertyId) {
      requestBody.property_id = propertyId;
    }

    if (primaryAgent === 'checkpoint') {
      if (checkpointIds.length > 0) {
        requestBody.checkpoint_ids = checkpointIds;
      }
      if (checkpointOptionalAgents.length > 0) {
        requestBody.checkpoint_optional_agents = checkpointOptionalAgents;
      }
    }

    if (primaryAgent === 'report') {
      if (reportIds.length > 0) {
        requestBody.report_ids = reportIds;
      }
      if (reportRevisions && Object.keys(reportRevisions).length > 0) {
        requestBody.report_revisions = reportRevisions;
      }
      requestBody.primary_agent = 'report';
    } else if (primaryAgent === 'docs' || primaryAgent === 'checkpoint') {
      requestBody.primary_agent = primaryAgent;
    }

    const resolvedSearchLocation = buildAgentSearchLocation(
      searchLocation ?? locationData,
      propertyAddress
    );
    if (resolvedSearchLocation) {
      requestBody.search_location = resolvedSearchLocation;
    }

    if (chatIntent) {
      requestBody.chat_intent = chatIntent;
    }

    if (chipAction) {
      requestBody.chip_action = chipAction;
    }

    if (assistantMessageId) {
      requestBody.assistant_message_id = assistantMessageId;
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
          ? monthlyQuotaExceededMessage('tokens')
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

      const agentSteps: AgentStep[] = [];
      let finalAssistantResponse = '';
      for (const line of fullText.split('\n')) {
        processAgentSseLine(line, agentSteps, {
          onAgentStep,
          onContent: (text) => {
            finalAssistantResponse += text;
          },
        });
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
    let sseLineBuffer = '';
    let chunkCount = 0;
    let byteCount = 0;

    const handlers = {
      onAgentStep,
      onContent: (text: string) => {
        finalAssistantResponse += text;
        onChunk?.(text);
      },
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseLineBuffer += decoder.decode(value, { stream: true });
      byteCount += value.byteLength;
      chunkCount += 1;

      const lines = sseLineBuffer.split('\n');
      sseLineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        processAgentSseLine(line, agentSteps, handlers);
      }
    }

    if (sseLineBuffer.length > 0) {
      processAgentSseLine(sseLineBuffer, agentSteps, handlers);
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
    const code = parseAgentErrorCode(errorBody);
    if (code === 'DOCUMENT_QUOTA_EXCEEDED') {
      throw new Error(monthlyQuotaExceededMessage('documents'));
    }
    if (code === 'TOKEN_QUOTA_EXCEEDED') {
      throw new Error(monthlyQuotaExceededMessage('tokens'));
    }
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
  userId: string,
  docId?: string
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
        ...(docId ? { context_doc_ids: [docId] } : {}),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      log.warn('rag.upload.failed', { status: response.status });
      const code = parseAgentErrorCode(errorBody);
      if (code === 'DOCUMENT_QUOTA_EXCEEDED') {
        return {
          success: false,
          error: monthlyQuotaExceededMessage('documents'),
        };
      }
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
        throw new Error(monthlyQuotaExceededMessage('checkpoints'));
      }
      if (code === 'TOKEN_QUOTA_EXCEEDED') {
        throw new Error(monthlyQuotaExceededMessage('tokens'));
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
      const code = parseAgentErrorCode(errorBody);
      const quotaMessage = mappPlanLimitMessageForErrorCode(code);
      if (quotaMessage) {
        throw new Error(quotaMessage);
      }
      throw new Error(
        compareCheckpointsFailureMessage(response.status, errorBody)
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

