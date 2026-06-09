import {
  createCorrelationId,
  proxyFetchWithAuth,
  type GetFirebaseIdToken,
} from '@/lib/correlation-id';
import { apiUrls } from '@/lib/utils';
import type { ReportPreviewResponse } from '@/lib/types';

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

export type ReportStatusResponse = {
  reportId: string;
  status: string;
  revision: number;
  failureReason?: string;
};

export type GenerateReportResponse = {
  status: string;
  reportId: string;
  revision: number;
  warnings?: string[];
};

export async function previewPropertyReportHtml(
  getIdToken: GetFirebaseIdToken,
  payload: ReportPreviewHtmlPayload
): Promise<{ html: string; warnings?: string[] }> {
  const response = await proxyFetchWithAuth(apiUrls.reportsPreviewHtml(), getIdToken, {
    method: 'POST',
    headers: { 'X-Request-ID': createCorrelationId() },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : typeof data?.message === 'string'
          ? data.message
          : 'Failed to preview report HTML';
    throw new Error(message);
  }
  return data as { html: string; warnings?: string[] };
}

export async function getPropertyReportStatus(
  getIdToken: GetFirebaseIdToken,
  params: { userId: string; propertyId: string; reportId: string }
): Promise<ReportStatusResponse> {
  const response = await proxyFetchWithAuth(apiUrls.reportsStatus(), getIdToken, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : 'Failed to load report status';
    throw new Error(message);
  }
  return data as ReportStatusResponse;
}

export async function previewPropertyReport(
  getIdToken: GetFirebaseIdToken,
  payload: ReportPreviewPayload
): Promise<ReportPreviewResponse> {
  const response = await proxyFetchWithAuth(apiUrls.reportsPreview(), getIdToken, {
    method: 'POST',
    headers: { 'X-Request-ID': createCorrelationId() },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : typeof data?.message === 'string'
          ? data.message
          : 'Failed to preview report checkpoints';
    throw new Error(message);
  }
  return data as ReportPreviewResponse;
}

export async function generatePropertyReport(
  getIdToken: GetFirebaseIdToken,
  payload: GenerateReportPayload
): Promise<GenerateReportResponse> {
  const response = await proxyFetchWithAuth(apiUrls.reportsGenerate(), getIdToken, {
    method: 'POST',
    headers: { 'X-Request-ID': createCorrelationId() },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.message === 'string'
        ? data.message
        : typeof data?.detail === 'string'
          ? data.detail
          : 'Failed to generate report';
    throw new Error(message);
  }
  return data as GenerateReportResponse;
}

export async function getPropertyReportSignedUrl(
  getIdToken: GetFirebaseIdToken,
  params: { userId: string; propertyId: string; reportId: string }
): Promise<string> {
  const response = await proxyFetchWithAuth(apiUrls.reportsSignedUrl(), getIdToken, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.detail === 'string' ? data.detail : 'Failed to open report PDF'
    );
  }
  return data.url as string;
}

export async function updatePropertyReportMetadata(
  getIdToken: GetFirebaseIdToken,
  params: {
    userId: string;
    propertyId: string;
    reportId: string;
    title?: string;
    customNotes?: string;
    template?: ReportTemplatePayload;
  }
): Promise<void> {
  const response = await proxyFetchWithAuth(apiUrls.reportsMetadata(), getIdToken, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.detail === 'string' ? data.detail : 'Failed to update report'
    );
  }
}

export async function setPropertyReportRagIndex(
  getIdToken: GetFirebaseIdToken,
  params: {
    userId: string;
    propertyId: string;
    reportId: string;
    includeInDocsChat: boolean;
  }
): Promise<{ ok: boolean; includeInDocsChat: boolean }> {
  const response = await proxyFetchWithAuth(apiUrls.reportsRagIndex(), getIdToken, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.detail === 'string'
        ? data.detail
        : typeof data?.message === 'string'
          ? data.message
          : 'Failed to update Docs chat indexing'
    );
  }
  return data as { ok: boolean; includeInDocsChat: boolean };
}

export async function sharePropertyReport(
  getIdToken: GetFirebaseIdToken,
  params: { userId: string; propertyId: string; reportId: string }
): Promise<{ shareId: string; expiresAt: string; revision: number }> {
  const response = await proxyFetchWithAuth(apiUrls.reportsShare(), getIdToken, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.detail === 'string' ? data.detail : 'Failed to create share link'
    );
  }
  return data as { shareId: string; expiresAt: string; revision: number };
}

export async function getPublicReportSignedUrl(shareId: string): Promise<string> {
  const response = await fetch(apiUrls.reportsPublicSignedUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shareId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.detail === 'string' ? data.detail : 'Failed to open shared report'
    );
  }
  return data.url as string;
}
