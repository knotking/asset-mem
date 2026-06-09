import type { PropertyReport } from "../types";

/** Max ready reports included in a single chat send. */
export const MAX_SELECTED_REPORTS = 3;

export function isReportReady(report: PropertyReport): boolean {
  return report.status === "ready";
}

export function filterReadyReports(reports: PropertyReport[]): PropertyReport[] {
  return [...reports]
    .filter(isReportReady)
    .sort((a, b) => reportSortMs(b) - reportSortMs(a));
}

function reportSortMs(report: PropertyReport): number {
  const value = report.generatedAt ?? report.createdAt;
  if (!value) return 0;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export function filterReportsBySearch(
  reports: PropertyReport[],
  query: string
): PropertyReport[] {
  const q = query.trim().toLowerCase();
  const ready = filterReadyReports(reports);
  if (!q) return ready;
  return ready.filter((report) => {
    const haystack = [
      report.title,
      report.customNotes,
      report.mode,
      report.purpose,
      `v${report.revision ?? 1}`,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function pickDefaultReadyReport(
  reports: PropertyReport[]
): PropertyReport | undefined {
  return filterReadyReports(reports)[0];
}

export function canSelectMoreReports(selectedCount: number): boolean {
  return selectedCount < MAX_SELECTED_REPORTS;
}

export function capSelectedReports(reports: PropertyReport[]): PropertyReport[] {
  return reports.slice(0, MAX_SELECTED_REPORTS);
}

export function reportContextChipLabel(report: PropertyReport): string {
  const title = report.title?.trim() || "Report";
  return `${title} · v${report.revision ?? 1}`;
}
