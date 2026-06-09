import {
  createCorrelationId,
  proxyFetchWithAuth,
  type GetFirebaseIdToken,
} from '@/lib/correlation-id';
import {
  deletionHttpErrorMessage,
  formatDeletionErrorMessage,
} from './deletion-error-message';
import type { DeletionJobResponse, DeletionResult } from './types';
import { emptyDeletionResult } from './types';

export type DeletionApiUrls = {
  document: string;
  checkpoint: string;
  report: string;
  session: string;
  checkpointsBatch: string;
  documentsBatch: string;
  sessionsBatch: string;
  ragFiles: string;
  agentSessions: string;
  property: string;
  sessionSharedChats: string;
  job: (jobId: string) => string;
  jobRetry: (jobId: string) => string;
};

type ProxyJson = {
  ok?: boolean;
  deleted?: string[] | boolean;
  warnings?: string[];
  failed?: { resource: string; message: string }[];
  error?: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

function proxyResultFromJson(data: ProxyJson): DeletionResult {
  const result = emptyDeletionResult();
  if (data.deleted) {
    if (Array.isArray(data.deleted)) {
      result.deleted.push(...data.deleted);
    } else if (data.deleted === true) {
      result.deleted.push('deleted');
    }
  }
  if (data.warnings?.length) result.warnings.push(...data.warnings);
  if (data.failed?.length) {
    result.failed.push(...data.failed);
    result.ok = false;
  }
  if (data.ok === false) result.ok = false;
  return result;
}

async function postDeletionProxy(
  url: string,
  getIdToken: GetFirebaseIdToken,
  body: Record<string, unknown>
): Promise<DeletionResult> {
  if (!url) {
    const result = emptyDeletionResult();
    result.ok = false;
    result.failed.push({ resource: 'proxy', message: 'Deletion URL not configured' });
    return result;
  }
  try {
    const response = await proxyFetchWithAuth(url, getIdToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      const result = emptyDeletionResult();
      result.ok = false;
      result.failed.push({
        resource: 'proxy',
        message: deletionHttpErrorMessage(response.status, text),
      });
      return result;
    }
    const data = await parseJson<ProxyJson>(response);
    return proxyResultFromJson(data);
  } catch (err) {
    const result = emptyDeletionResult();
    result.ok = false;
    result.failed.push({
      resource: 'proxy',
      message: formatDeletionErrorMessage(err),
    });
    return result;
  }
}

export async function deleteDocumentViaProxy(params: {
  url: string;
  getIdToken: GetFirebaseIdToken;
  userId: string;
  docId: string;
  storagePath?: string | null;
  gsURI?: string | null;
}): Promise<DeletionResult> {
  return postDeletionProxy(params.url, params.getIdToken, {
    userId: params.userId,
    docId: params.docId,
    storagePath: params.storagePath ?? undefined,
    gsURI: params.gsURI ?? undefined,
  });
}

export async function deleteCheckpointViaProxy(params: {
  url: string;
  getIdToken: GetFirebaseIdToken;
  userId: string;
  propertyId: string;
  checkpointId: string;
}): Promise<DeletionResult> {
  return postDeletionProxy(params.url, params.getIdToken, {
    userId: params.userId,
    propertyId: params.propertyId,
    checkpointId: params.checkpointId,
  });
}

export async function deleteReportViaProxy(params: {
  url: string;
  getIdToken: GetFirebaseIdToken;
  userId: string;
  propertyId: string;
  reportId: string;
}): Promise<DeletionResult> {
  return postDeletionProxy(params.url, params.getIdToken, {
    userId: params.userId,
    propertyId: params.propertyId,
    reportId: params.reportId,
  });
}

export async function deleteSessionViaProxy(params: {
  url: string;
  getIdToken: GetFirebaseIdToken;
  userId: string;
  sessionId: string;
}): Promise<DeletionResult> {
  return postDeletionProxy(params.url, params.getIdToken, {
    userId: params.userId,
    sessionId: params.sessionId,
  });
}

export async function deleteCheckpointsBatchViaProxy(params: {
  url: string;
  getIdToken: GetFirebaseIdToken;
  userId: string;
  propertyId: string;
  checkpointIds: string[];
}): Promise<DeletionResult> {
  return postDeletionProxy(params.url, params.getIdToken, {
    userId: params.userId,
    propertyId: params.propertyId,
    checkpointIds: params.checkpointIds,
  });
}

export async function deleteSessionsBatchViaProxy(params: {
  url: string;
  getIdToken: GetFirebaseIdToken;
  userId: string;
  sessionIds: string[];
}): Promise<DeletionResult> {
  return postDeletionProxy(params.url, params.getIdToken, {
    userId: params.userId,
    sessionIds: params.sessionIds,
  });
}

export async function deleteRagFilesViaProxy(params: {
  url: string;
  getIdToken: GetFirebaseIdToken;
  userId: string;
  gsURIs: string[];
}): Promise<{ ok: boolean; warnings?: string[]; error?: string }> {
  if (!params.url || params.gsURIs.length === 0) return { ok: true };
  const result = await postDeletionProxy(params.url, params.getIdToken, {
    userId: params.userId,
    gsURIs: params.gsURIs,
  });
  return {
    ok: result.ok,
    warnings: result.warnings,
    error: result.failed[0]?.message,
  };
}

export async function deleteAgentSessionsViaProxy(params: {
  url: string;
  getIdToken: GetFirebaseIdToken;
  userId: string;
  sessionIds: string[];
}): Promise<{ ok: boolean; warnings?: string[]; error?: string }> {
  if (!params.url || params.sessionIds.length === 0) return { ok: true };
  const result = await postDeletionProxy(params.url, params.getIdToken, {
    userId: params.userId,
    sessionIds: params.sessionIds,
  });
  return {
    ok: result.ok,
    warnings: result.warnings,
    error: result.failed[0]?.message,
  };
}

export async function deleteSessionSharedChatsViaProxy(params: {
  url: string;
  getIdToken: GetFirebaseIdToken;
  userId: string;
  sessionId: string;
}): Promise<{ ok: boolean; warnings?: string[]; error?: string }> {
  if (!params.url) return { ok: true };
  const result = await postDeletionProxy(params.url, params.getIdToken, {
    userId: params.userId,
    sessionId: params.sessionId,
  });
  return {
    ok: result.ok,
    warnings: result.warnings,
    error: result.failed[0]?.message,
  };
}

export async function startPropertyDeletionJob(params: {
  url: string;
  getIdToken: GetFirebaseIdToken;
  userId: string;
  propertyId: string;
}): Promise<{ jobId?: string; error?: string }> {
  if (!params.url) {
    return { error: 'Property deletion URL not configured' };
  }
  try {
    const response = await proxyFetchWithAuth(params.url, params.getIdToken, {
      method: 'POST',
      body: JSON.stringify({
        userId: params.userId,
        propertyId: params.propertyId,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return { error: deletionHttpErrorMessage(response.status, body) };
    }
    const data = await parseJson<{ jobId: string }>(response);
    if (!data.jobId) return { error: 'No jobId in response' };
    return { jobId: data.jobId };
  } catch (err) {
    return { error: formatDeletionErrorMessage(err) };
  }
}

export async function getDeletionJobStatus(params: {
  url: string;
  getIdToken: GetFirebaseIdToken;
  jobId: string;
}): Promise<DeletionJobResponse | null> {
  if (!params.url) return null;
  try {
    const response = await proxyFetchWithAuth(params.url, params.getIdToken, {
      method: 'GET',
      correlationId: createCorrelationId(),
    });
    if (!response.ok) return null;
    return parseJson<DeletionJobResponse>(response);
  } catch {
    return null;
  }
}

export async function retryDeletionJob(params: {
  url: string;
  getIdToken: GetFirebaseIdToken;
  jobId: string;
}): Promise<{ job?: DeletionJobResponse; error?: string }> {
  if (!params.url) {
    return { error: 'Deletion job retry URL not configured' };
  }
  try {
    const response = await proxyFetchWithAuth(params.url, params.getIdToken, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const body = await response.text();
      return { error: deletionHttpErrorMessage(response.status, body) };
    }
    const job = await parseJson<DeletionJobResponse>(response);
    return { job };
  } catch (err) {
    return { error: formatDeletionErrorMessage(err) };
  }
}

export function buildDeletionApiUrls(baseUrl: string): DeletionApiUrls {
  const base = baseUrl.replace(/\/$/, '');
  return {
    document: `${base}/deletion/document`,
    checkpoint: `${base}/deletion/checkpoint`,
    report: `${base}/deletion/report`,
    session: `${base}/deletion/session`,
    checkpointsBatch: `${base}/deletion/checkpoints`,
    documentsBatch: `${base}/deletion/documents`,
    sessionsBatch: `${base}/deletion/sessions`,
    ragFiles: `${base}/deletion/rag-files`,
    agentSessions: `${base}/deletion/agent-sessions`,
    property: `${base}/deletion/property`,
    sessionSharedChats: `${base}/deletion/session-shared-chats`,
    job: (jobId: string) => `${base}/deletion/jobs/${encodeURIComponent(jobId)}`,
    jobRetry: (jobId: string) =>
      `${base}/deletion/jobs/${encodeURIComponent(jobId)}/retry`,
  };
}
