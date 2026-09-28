/** Mirrored from @asset-mem/common — webapp cannot import common (App Hosting). */
import type { PropertyReport } from '@/lib/types';
import {
  buildReportRevisionListItems,
  type ReportRevisionListItem,
} from '@/lib/report-revisions';

export type ReportPickerRow = ReportRevisionListItem & { parent: PropertyReport };

/** One picker row per report — current revision only (no revisions subcollection fetch). */
export function buildCurrentRevisionReportPickerRows(
  readyReports: PropertyReport[]
): ReportPickerRow[] {
  const rows: ReportPickerRow[] = [];
  for (const report of readyReports) {
    for (const item of buildReportRevisionListItems(report)) {
      rows.push({ ...item, parent: report });
    }
  }
  return rows;
}

export function reportHasOlderRevisions(report: PropertyReport): boolean {
  return (report.revision ?? 1) > 1;
}
