/** Mirrored from @asset-mem/common — webapp cannot import common (App Hosting). */
import type { Firestore } from 'firebase/firestore';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import type { PropertyReport, PropertyReportMode } from '@/lib/types';

export type ReportRevisionListItem = {
  reportId: string;
  revision: number;
  title: string;
  mode: PropertyReportMode;
  isArchived: boolean;
};

export function reportSelectionKey(reportId: string, revision: number): string {
  return `${reportId}:v${revision}`;
}

export function parseReportSelectionKey(key: string): { reportId: string; revision: number } | null {
  const match = /^([^:]+):v(\d+)$/.exec(key);
  if (!match) return null;
  return { reportId: match[1], revision: Number(match[2]) };
}

export function toRevisionSelectionReport(
  parent: PropertyReport,
  revision: number,
  isArchived: boolean
): PropertyReport {
  return {
    ...parent,
    revision,
    status: 'ready',
    title: isArchived
      ? `${parent.title || 'Report'} (v${revision})`
      : parent.title,
  };
}

export async function fetchArchivedReportRevisions(
  db: Firestore,
  userId: string,
  propertyId: string,
  reportId: string
): Promise<number[]> {
  const ref = collection(
    db,
    `users/${userId}/properties/${propertyId}/reports/${reportId}/revisions`
  );
  const snap = await getDocs(query(ref, orderBy('revision', 'desc')));
  return snap.docs
    .map((doc) => Number((doc.data() as { revision?: number }).revision ?? doc.id))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export function buildReportRevisionListItems(report: PropertyReport): ReportRevisionListItem[] {
  const currentRevision = report.revision ?? 1;
  const items: ReportRevisionListItem[] = [
    {
      reportId: report.id,
      revision: currentRevision,
      title: report.title || 'Report',
      mode: report.mode,
      isArchived: false,
    },
  ];
  return items;
}

export function reportRevisionListCacheKey(
  userId: string,
  propertyId: string,
  reportId: string,
  currentRevision: number
): string {
  return `${userId}/${propertyId}/${reportId}/v${currentRevision}`;
}

/** LRU cache for expanded revision picker rows (avoids re-fetching on every context sheet open). */
export class ReportRevisionListCache {
  private readonly cache = new Map<string, ReportRevisionListItem[]>();

  constructor(private readonly maxSize = 32) {}

  get(key: string): ReportRevisionListItem[] | undefined {
    const value = this.cache.get(key);
    if (value === undefined) return undefined;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value.map((item) => ({ ...item }));
  }

  set(key: string, value: ReportRevisionListItem[]): void {
    this.cache.delete(key);
    this.cache.set(
      key,
      value.map((item) => ({ ...item }))
    );
    while (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

const reportRevisionListCache = new ReportRevisionListCache();

/** @internal Tests only */
export function clearReportRevisionListCache(): void {
  reportRevisionListCache.clear();
}

export function getCachedReportRevisionListItems(
  userId: string,
  propertyId: string,
  report: PropertyReport
): ReportRevisionListItem[] | undefined {
  const currentRevision = report.revision ?? 1;
  return reportRevisionListCache.get(
    reportRevisionListCacheKey(userId, propertyId, report.id, currentRevision)
  );
}

export async function expandReportRevisionListItems(
  db: Firestore,
  userId: string,
  propertyId: string,
  report: PropertyReport
): Promise<ReportRevisionListItem[]> {
  const currentRevision = report.revision ?? 1;
  const cacheKey = reportRevisionListCacheKey(
    userId,
    propertyId,
    report.id,
    currentRevision
  );
  const cached = reportRevisionListCache.get(cacheKey);
  if (cached) return cached;

  const archived = await fetchArchivedReportRevisions(
    db,
    userId,
    propertyId,
    report.id
  );
  const items: ReportRevisionListItem[] = [];
  for (const revision of archived) {
    if (revision === currentRevision) continue;
    items.push({
      reportId: report.id,
      revision,
      title: report.title || 'Report',
      mode: report.mode,
      isArchived: true,
    });
  }
  items.push({
    reportId: report.id,
    revision: currentRevision,
    title: report.title || 'Report',
    mode: report.mode,
    isArchived: false,
  });
  const sorted = items.sort((a, b) => b.revision - a.revision);
  reportRevisionListCache.set(cacheKey, sorted);
  return sorted;
}
