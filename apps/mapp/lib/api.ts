import { fetch } from 'expo/fetch';
import type { AgentStep } from '@homeapp/common/types';

const AGENT_SESSION_URL =
  'https://homecare-agent-proxy-dev-321433914812.us-central1.run.app/92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376/agent-session';
const AGENT_SSE_URL =
  'https://homecare-agent-proxy-dev-321433914812.us-central1.run.app/92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376/firebase-agent-stream';
const RAG_FILE_UPLOAD_URL =
  'https://homecare-agent-proxy-dev-321433914812.us-central1.run.app/92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376/rag-file-upload';
const DOCUMENT_ANALYSIS_URL =
  'https://homecare-agent-proxy-dev-321433914812.us-central1.run.app/92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376/extract-doc-info';

// TODO: Web app URL for sharing links
export const WEB_APP_URL = 'https://staging--goggle-gab.us-central1.hosted.app';

export async function createAgentSession(
  userId: string
): Promise<{ agentSessionId?: string; error?: string }> {
  try {
    const url = AGENT_SESSION_URL;
    if (!url) {
      throw new Error('AGENT_SESSION_URL not set.');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

    return { agentSessionId };
  } catch (error) {
    console.error('Error creating agent session:', error);
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
      console.warn('AGENT_SESSION_URL not set, skipping agent session deletion');
      return { success: true };
    }

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId, session_id: agentSessionId }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(
          `Agent session ${agentSessionId} not found on backend, but proceeding with UI deletion.`
        );
        return { success: true };
      }
      const errorBody = await response.text();
      throw new Error(`Failed to delete session, status: ${response.status}, body: ${errorBody}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting agent session:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { error: `Failed to delete agent session: ${errorMessage}` };
  }
}

export interface StreamAgentResponseParams {
  userId: string;
  agentSessionId: string;
  userQuery: string;
  contextDocURIs?: string[];
  diagnosisURIs?: string[];
  propertyAddress?: string;
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
  diagnosisURIs = [],
  propertyAddress,
  onChunk,
  onAgentStep,
  onComplete,
  onError,
}: StreamAgentResponseParams): Promise<void> {
  try {
    const url = AGENT_SSE_URL;
    if (!url) {
      throw new Error('AGENT_SSE_URL not set.');
    }

    const requestBody = {
      user_id: userId,
      session_id: agentSessionId,
      user_query: userQuery,
      context_doc_uris: contextDocURIs,
      diagnosis_uris: diagnosisURIs,
      property_address: propertyAddress,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to stream response, status: ${response.status}, body: ${errorBody}`);
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

      return;
    }

    // Streaming mode (if response.body is available)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let finalAssistantResponse = '';
    let agentSteps: AgentStep[] = [];
    const agentStatusRegex = /\*\*.*?Agent\*\* (\w+): (.+)/;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const rawChunk = decoder.decode(value, { stream: true });
      console.log('RAW CHUNK:', rawChunk);
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
      // Check if response is empty and provide helpful error message
      const finalResponse =
        finalAssistantResponse.trim() ||
        "I apologize, but I wasn't able to generate a response. This might be due to a temporary issue. Please try asking your question again after some time.";
      onComplete(finalResponse, agentSteps);
    }
  } catch (error) {
    console.error('Error streaming agent response:', error);
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

export interface ExtractDocInfoInput {
  docUrl: string;
  contentType: string;
}

export interface ExtractDocInfoOutput {
  documentType: DocumentType;
  propertyAddress: string;
  keyEntities: Array<{ name: string; value: string }>;
  summary: string;
}

/**
 * Extract document information using AI analysis
 */
export async function extractDocInfo(input: ExtractDocInfoInput): Promise<ExtractDocInfoOutput> {
  try {
    const url = DOCUMENT_ANALYSIS_URL;
    if (!url) {
      throw new Error('DOCUMENT_ANALYSIS_URL not set.');
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
      throw new Error(`Failed to analyze document, status: ${response.status}, body: ${errorBody}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error analyzing document:', error);
    throw error;
  }
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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        context_doc_uris: [gsURI],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`RAG upload failed (non-blocking): ${response.status}, ${errorBody}`);
      // Don't throw - RAG failures shouldn't block document upload
      return { success: false, error: errorBody };
    }

    return { success: true };
  } catch (error) {
    console.error('Error uploading to RAG:', error);
    // Don't throw - RAG failures shouldn't block document upload
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
