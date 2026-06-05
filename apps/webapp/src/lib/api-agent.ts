/**
 * Webapp proxy client for agent session + streaming. Centralizes logging.
 */

import { apiUrls } from '@/lib/utils';
import { createCorrelationId, proxyFetchWithAuth } from '@/lib/correlation-id';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import {
  createLogger,
  parseAgentErrorCode,
  truncateId,
} from '@/lib/logger';
import {
  planLimitMessageForErrorCode,
  TOKEN_QUOTA_USER_MESSAGE,
} from '@/lib/plan-limit-errors';
import type { AgentStep, LocationData, PrimaryAgent, SearchLocationInput } from '@/lib/types';
import { buildAgentSearchLocation } from '@/lib/search-location';

const log = createLogger('agent');

export async function createAgentSession(
  userId: string
): Promise<{ agentSessionId?: string; error?: string }> {
  try {
    const url = apiUrls.agentSession();
    const response = await proxyFetchWithAuth(url, getFirebaseIdTokenForProxy, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const code = parseAgentErrorCode(errorBody);
      log.error('session.create.failed', { status: response.status, code });
      throw new Error(`Failed to create session, status: ${response.status}`);
    }

    const data = await response.json();
    const agentSessionId = data.id as string | undefined;
    if (!agentSessionId) {
      throw new Error('session_id not found in response');
    }

    log.info('session.created', { agentSessionId: truncateId(agentSessionId) });
    return { agentSessionId };
  } catch (error) {
    log.error('session.create.error', undefined, error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return { error: `Failed to create agent session: ${errorMessage}` };
  }
}

export async function deleteAgentSession(
  userId: string,
  agentSessionId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const url = apiUrls.agentSession();
    const response = await proxyFetchWithAuth(url, getFirebaseIdTokenForProxy, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: userId, session_id: agentSessionId }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        log.warn('session.delete.notFound', {
          agentSessionId: truncateId(agentSessionId),
        });
        return { success: true };
      }
      const errorBody = await response.text();
      throw new Error(`Failed to delete session, status: ${response.status}, body: ${errorBody}`);
    }

    log.info('session.deleted', { agentSessionId: truncateId(agentSessionId) });
    return { success: true };
  } catch (error) {
    log.error('session.delete.error', { agentSessionId: truncateId(agentSessionId) }, error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return { error: `Failed to delete agent session: ${errorMessage}` };
  }
}

export async function postFileToAgent(
  gsURI: string,
  userId: string,
  docId?: string
): Promise<{ success: boolean; summary?: string; error?: string }> {
  try {
    const url = apiUrls.ragFileUpload();
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
      const quotaMessage = planLimitMessageForErrorCode(parseAgentErrorCode(errorBody));
      if (quotaMessage) {
        throw new Error(quotaMessage);
      }
      throw new Error(`Failed to post file, status: ${response.status}, body: ${errorBody}`);
    }
    const result = await response.json();
    log.info('rag.upload.ok');
    return { success: true, summary: result.message };
  } catch (error) {
    log.error('rag.upload.error', undefined, error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, error: errorMessage };
  }
}

export interface StreamAgentResponseParams {
  userId: string;
  agentSessionId: string;
  userQuery: string;
  contextDocURIs?: string[];
  checkpointIds?: string[];
  propertyAddress?: string;
  propertyId?: string;
  primaryAgent?: PrimaryAgent;
  checkpointOptionalAgents?: string[];
  searchLocation?: SearchLocationInput;
  /** @deprecated Use searchLocation */
  locationData?: LocationData;
  signal?: AbortSignal;
  /** Firebase chat doc id (for correlating with proxy persistence logs). */
  firebaseChatId?: string;
  /** Firestore assistant message doc id (lifecycle + agentSteps persistence). */
  assistantMessageId?: string;
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
  checkpointOptionalAgents = [],
  searchLocation,
  locationData,
  signal,
  firebaseChatId,
  assistantMessageId,
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
    const requestBody: Record<string, unknown> = {
      user_id: userId,
      session_id: agentSessionId,
      user_query: userQuery,
      context_doc_uris: contextDocURIs,
      property_address: propertyAddress,
      property_id: propertyId,
    };

    if (primaryAgent === 'checkpoint') {
      if (checkpointIds.length > 0) requestBody.checkpoint_ids = checkpointIds;
      if (checkpointOptionalAgents.length > 0) {
        requestBody.checkpoint_optional_agents = checkpointOptionalAgents;
      }
    }

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

    if (assistantMessageId) {
      requestBody.assistant_message_id = assistantMessageId;
    }

    const response = await proxyFetchWithAuth(apiUrls.agentSse(), getFirebaseIdTokenForProxy, {
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
          ? TOKEN_QUOTA_USER_MESSAGE
          : `Failed to stream response, status: ${response.status}`
      );
    }

    if (!response.body) {
      const fullText = await response.text();
      if (fullText.startsWith('STREAM_ERROR:')) {
        throw new Error(fullText.substring('STREAM_ERROR:'.length));
      }
      if (onChunk && fullText.trim()) onChunk(fullText);
      if (onComplete) onComplete(fullText.trim(), []);
      log.info('stream.complete', { ...streamMeta, durationMs: Date.now() - startedAt, mode: 'buffered' });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunkCount = 0;
    let byteCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const rawChunk = decoder.decode(value, { stream: true });
      byteCount += value.byteLength;
      chunkCount += 1;

      if (rawChunk.startsWith('STREAM_ERROR:')) {
        throw new Error(rawChunk.substring('STREAM_ERROR:'.length));
      }

      if (rawChunk.trim().length > 0 && onChunk) {
        onChunk(rawChunk);
      }
    }

    log.info('stream.complete', {
      ...streamMeta,
      durationMs: Date.now() - startedAt,
      chunkCount,
      byteCount,
    });

    if (onComplete) {
      onComplete('', []);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || signal?.aborted)
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
