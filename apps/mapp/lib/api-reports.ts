import Constants from 'expo-constants';
import { createCorrelationId, proxyFetchWithAuth } from '@asset-mem/common/lib/correlation-id';
import { parseAgentErrorCode } from '@asset-mem/common/lib/document-analysis-errors';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import { mappPlanLimitMessageForErrorCode } from '@/lib/ios-billing-compliance';
import type { ReportPreviewResponse } from '@asset-mem/common/types';

const extra = Constants.expoConfig?.extra || {};
const REPORTS_PREVIEW_URL = (extra.reportsPreviewUrl as string) || '';
const REPORTS_PREVIEW_HTML_URL = (extra.reportsPreviewHtmlUrl as string) || '';
const REPORTS_STATUS_URL = (extra.reportsStatusUrl as string) || '';
const REPORTS_GENERATE_URL = (extra.reportsGenerateUrl as string) || '';
const REPORTS_SIGNED_URL = (extra.reportsSignedUrl as string) || '';
const REPORTS_METADATA_URL = (extra.reportsMetadataUrl as string) || '';
const REPORTS_SHARE_URL = (extra.reportsShareUrl as string) || '';
const REPORTS_RAG_INDEX_URL = (extra.reportsRagIndexUrl as string) || '';

type ReportDateRange = { start: string; end: string };

export type ReportTemplatePayload = {
  layoutId?: 'professional' | 'classic';
  includeCoverPage?: boolean;
  includePhotos?: boolean;
  includeIssueTable?: boolean;
  includeMetricsChart?: boolean;
  includeVisualDiff?: boolean;
  includeRecommendations?: boolean;
  includeSignatureBlock?: boolean;
};

export type GenerateSnapshotReportPayload = {
  userId: string;
  propertyId: string;
  title: string;
  mode: 'snapshot';
  purpose: 'rental_security' | 'realtor_visit' | 'insurance' | 'custom';
  snapshotRange: ReportDateRange;
  checkpointIds?: string[];
  customNotes?: string;
  template?: ReportTemplatePayload;
  regenerateReportId?: string;
};

export type GenerateComparisonReportPayload = {
  userId: string;
  propertyId: string;
  title: string;
  mode: 'comparison';
  purpose: 'rental_security' | 'realtor_visit' | 'insurance' | 'custom';
  baselineRange: ReportDateRange;
  comparisonRange: ReportDateRange;
  checkpointIds?: string[];
  customNotes?: string;
  template?: ReportTemplatePayload;
  regenerateReportId?: string;
};

export type ReportPreviewPayload =
  | {
      userId: string;
      propertyId: string;
      mode: 'snapshot';
      snapshotRange: ReportDateRange;
    }
  | {
      userId: string;
      propertyId: string;
      mode: 'comparison';
      purpose?: 'rental_security' | 'realtor_visit' | 'insurance' | 'custom';
      baselineRange: ReportDateRange;
      comparisonRange: ReportDateRange;
    };

export type ReportPreviewHtmlPayload = GenerateReportPayload & {
  title: string;
};

export type GenerateReportPayload =
  | GenerateSnapshotReportPayload
  | GenerateComparisonReportPayload;

export type GenerateReportResponse = {
  status: string;
  reportId: string;
  revision: number;
  warnings?: string[];
};

function reportErrorMessage(body: string, status: number): string {
  const quota = mappPlanLimitMessageForErrorCode(parseAgentErrorCode(body));
  if (quota) return quota;
  try {
    const parsed = JSON.parse(body) as { message?: string; detail?: string };
    if (parsed.message) return parsed.message;
    if (parsed.detail) return String(parsed.detail);
  } catch {
    // ignore
  }
  return `Failed to generate report (${status})`;
}

export type ReportStatusResponse = {
  reportId: string;
  status: string;
  revision: number;
  failureReason?: string;
};

export async function previewPropertyReportHtml(
  payload: ReportPreviewHtmlPayload
): Promise<{ html: string; warnings?: string[] }> {
  if (!REPORTS_PREVIEW_HTML_URL) {
    throw new Error('Reports preview HTML API URL is not configured');
  }
  const response = await proxyFetchWithAuth(
    REPORTS_PREVIEW_HTML_URL,
    getFirebaseIdTokenForProxy,
    {
      method: 'POST',
      headers: { 'X-Request-ID': createCorrelationId() },
      body: JSON.stringify(payload),
    }
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(reportErrorMessage(text, response.status));
  }
  return JSON.parse(text) as { html: string; warnings?: string[] };
}

export async function getPropertyReportStatus(params: {
  userId: string;
  propertyId: string;
  reportId: string;
}): Promise<ReportStatusResponse> {
  if (!REPORTS_STATUS_URL) {
    throw new Error('Reports status API URL is not configured');
  }
  const response = await proxyFetchWithAuth(REPORTS_STATUS_URL, getFirebaseIdTokenForProxy, {
    method: 'POST',
    headers: { 'X-Request-ID': createCorrelationId() },
    body: JSON.stringify(params),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(reportErrorMessage(text, response.status));
  }
  return JSON.parse(text) as ReportStatusResponse;
}

export async function previewPropertyReport(
  payload: ReportPreviewPayload
): Promise<ReportPreviewResponse> {
  if (!REPORTS_PREVIEW_URL) {
    throw new Error('Reports preview API URL is not configured');
  }
  const response = await proxyFetchWithAuth(REPORTS_PREVIEW_URL, getFirebaseIdTokenForProxy, {
    method: 'POST',
    headers: { 'X-Request-ID': createCorrelationId() },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(reportErrorMessage(text, response.status));
  }
  return JSON.parse(text) as ReportPreviewResponse;
}

export async function generatePropertyReport(
  payload: GenerateReportPayload
): Promise<GenerateReportResponse> {
  if (!REPORTS_GENERATE_URL) {
    throw new Error('Reports API URL is not configured');
  }
  const response = await proxyFetchWithAuth(REPORTS_GENERATE_URL, getFirebaseIdTokenForProxy, {
    method: 'POST',
    headers: { 'X-Request-ID': createCorrelationId() },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(reportErrorMessage(text, response.status));
  }
  return JSON.parse(text) as GenerateReportResponse;
}

export async function getPropertyReportSignedUrl(params: {
  userId: string;
  propertyId: string;
  reportId: string;
}): Promise<string> {
  if (!REPORTS_SIGNED_URL) {
    throw new Error('Reports signed URL API is not configured');
  }
  const response = await proxyFetchWithAuth(REPORTS_SIGNED_URL, getFirebaseIdTokenForProxy, {
    method: 'POST',
    headers: { 'X-Request-ID': createCorrelationId() },
    body: JSON.stringify(params),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(reportErrorMessage(text, response.status));
  }
  const data = JSON.parse(text) as { url?: string };
  if (!data.url) {
    throw new Error('Signed URL missing from response');
  }
  return data.url;
}

export async function updatePropertyReportMetadata(params: {
  userId: string;
  propertyId: string;
  reportId: string;
  title?: string;
  customNotes?: string;
  template?: ReportTemplatePayload;
}): Promise<void> {
  if (!REPORTS_METADATA_URL) {
    throw new Error('Reports metadata API URL is not configured');
  }
  const response = await proxyFetchWithAuth(REPORTS_METADATA_URL, getFirebaseIdTokenForProxy, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(reportErrorMessage(text, response.status));
  }
}

export async function setPropertyReportRagIndex(params: {
  userId: string;
  propertyId: string;
  reportId: string;
  includeInDocsChat: boolean;
}): Promise<{ ok: boolean; includeInDocsChat: boolean }> {
  if (!REPORTS_RAG_INDEX_URL) {
    throw new Error('Reports RAG index API URL is not configured');
  }
  const response = await proxyFetchWithAuth(REPORTS_RAG_INDEX_URL, getFirebaseIdTokenForProxy, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(reportErrorMessage(text, response.status));
  }
  return JSON.parse(text) as { ok: boolean; includeInDocsChat: boolean };
}

export async function sharePropertyReport(params: {
  userId: string;
  propertyId: string;
  reportId: string;
}): Promise<{ shareId: string; expiresAt: string; revision: number }> {
  if (!REPORTS_SHARE_URL) {
    throw new Error('Reports share API URL is not configured');
  }
  const response = await proxyFetchWithAuth(REPORTS_SHARE_URL, getFirebaseIdTokenForProxy, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(reportErrorMessage(text, response.status));
  }
  return JSON.parse(text) as { shareId: string; expiresAt: string; revision: number };
}
