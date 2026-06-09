import type { PropertyReportPurpose } from "../types";
import { applyReportQuickPreset, defaultReportMonthRange } from "./report-quick-presets";
import type { ReportSnapshotDateRange } from "./report-preview";
import type { ReportPreviewResponse } from "../types";
import { defaultPurposeForMode } from "./report-templates";

export type ReportWizardStep = 1 | 2 | 3;

export type ReportIntentId = "realtor_showing" | "rental_move" | "insurance";

export type ReportIntentOption = {
  id: ReportIntentId;
  label: string;
  description: string;
  mode: "snapshot" | "comparison";
  purpose: PropertyReportPurpose;
};

export const DEFAULT_REPORT_INTENT_ID: ReportIntentId = "realtor_showing";

export const REPORT_INTENT_OPTIONS: ReportIntentOption[] = [
  {
    id: "realtor_showing",
    label: "Showing / listing",
    description: "Single-day snapshot for showings and marketing.",
    mode: "snapshot",
    purpose: "realtor_visit",
  },
  {
    id: "rental_move",
    label: "Move-in / move-out",
    description: "Compare two periods for deposits and lease records.",
    mode: "comparison",
    purpose: "rental_security",
  },
  {
    id: "insurance",
    label: "Insurance / claim",
    description: "Document condition with issues and metrics.",
    mode: "snapshot",
    purpose: "insurance",
  },
];

export type ReportWizardDateState = {
  mode: "snapshot" | "comparison";
  purpose: PropertyReportPurpose;
  title: string;
  startDate: string;
  endDate: string;
  baselineStart: string;
  baselineEnd: string;
  comparisonStart: string;
  comparisonEnd: string;
};

function monthYearLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export { defaultReportMonthRange } from "./report-quick-presets";

export function applyReportIntent(intentId: ReportIntentId): ReportWizardDateState {
  if (intentId === "realtor_showing") {
    return applyReportQuickPreset("showing-today");
  }
  if (intentId === "rental_move") {
    return applyReportQuickPreset("move-in-out");
  }
  const intent = REPORT_INTENT_OPTIONS.find((row) => row.id === intentId);
  const month = defaultReportMonthRange();
  const mode = intent?.mode ?? "snapshot";
  const purpose = intent?.purpose ?? defaultPurposeForMode(mode);
  return {
    mode,
    purpose,
    title: suggestReportTitle(purpose, mode, month.start, month.end),
    startDate: month.start,
    endDate: month.end,
    baselineStart: month.start,
    baselineEnd: month.end,
    comparisonStart: month.start,
    comparisonEnd: month.end,
  };
}

export function suggestReportTitle(
  purpose: PropertyReportPurpose,
  mode: "snapshot" | "comparison",
  startDate: string,
  endDate: string
): string {
  const label = monthYearLabel(new Date(startDate || Date.now()));
  if (mode === "comparison") {
    return purpose === "rental_security"
      ? `Move-out comparison — ${label}`
      : `Condition comparison — ${label}`;
  }
  switch (purpose) {
    case "realtor_visit":
      return `Showing snapshot — ${label}`;
    case "insurance":
      return `Insurance documentation — ${label}`;
    case "rental_security":
      return `Rental snapshot — ${label}`;
    default:
      return `Property report — ${label}`;
  }
}

export type CheckpointPreviewSummary = {
  total: number;
  selected: number;
  pending: number;
  ready: number;
};

export function summarizeCheckpointPreview(
  preview: ReportPreviewResponse,
  selectedIds: Set<string>
): CheckpointPreviewSummary {
  if (preview.mode === "snapshot") {
    const rows = preview.checkpoints.filter((row) =>
      selectedIds.has(row.checkpointId)
    );
    const pending = rows.filter((row) => row.analysisStatus !== "completed").length;
    return {
      total: preview.checkpoints.length,
      selected: rows.length,
      pending,
      ready: rows.length - pending,
    };
  }
  let total = 0;
  let selected = 0;
  let pending = 0;
  for (const pair of preview.pairs) {
    total += 2;
    for (const row of [pair.baseline, pair.comparison]) {
      if (!row) continue;
      if (selectedIds.has(row.checkpointId)) {
        selected += 1;
        if (row.analysisStatus !== "completed") pending += 1;
      }
    }
  }
  for (const row of [...preview.baselineOnly, ...preview.comparisonOnly]) {
    total += 1;
    if (selectedIds.has(row.checkpointId)) {
      selected += 1;
      if (row.analysisStatus !== "completed") pending += 1;
    }
  }
  return {
    total,
    selected,
    pending,
    ready: selected - pending,
  };
}

export function reportWizardStepLabel(step: ReportWizardStep): string {
  return `Step ${step} of 3`;
}

export function reportWizardStep2Hint(
  mode: "snapshot" | "comparison",
  purpose: PropertyReportPurpose
): string {
  if (mode === "comparison") {
    return purpose === "rental_security"
      ? "Pairs the earliest and latest checkpoint per location between move-in and move-out."
      : "We pair checkpoints from the same location in each period.";
  }
  return "Includes the latest checkpoint per location in this range.";
}

export function comparisonBeforePeriodLabel(purpose: PropertyReportPurpose): string {
  return purpose === "rental_security" ? "Move-in" : "Earlier period";
}

export function comparisonAfterPeriodLabel(purpose: PropertyReportPurpose): string {
  return purpose === "rental_security" ? "Move-out" : "Later period";
}

export function comparisonWizardRangeHint(purpose: PropertyReportPurpose): string {
  if (purpose === "rental_security") {
    return "We include all checkpoints between move-in and move-out and compare earliest vs latest per location.";
  }
  return "Set the earlier and later periods, then we pair checkpoints from the same location.";
}

/** Subtitle under a location that could not be paired in the wizard list. */
export function comparisonUnpairedRowHint(purpose: PropertyReportPurpose): string {
  if (purpose === "rental_security") {
    return "One photo in this period — no before/after comparison";
  }
  return "Only in one period — shown in appendix";
}

export function rentalSinglePhotoWarning(count: number): string {
  if (count === 1) {
    return (
      "1 location has only one photo between move-in and move-out, so we can't compare " +
      "before vs after. It will still appear in the report appendix."
    );
  }
  return (
    `${count} locations have only one photo between move-in and move-out, so we can't compare ` +
    "before vs after. They will still appear in the report appendix."
  );
}

export function comparisonLowPairRateWarning(
  pairRate: number,
  purpose: PropertyReportPurpose
): string {
  const pct = Math.round(pairRate * 100);
  if (purpose === "rental_security") {
    return (
      `Only ${pct}% of locations have photos at both move-in and move-out. ` +
      "The rest appear in the report appendix."
    );
  }
  const before = comparisonBeforePeriodLabel(purpose);
  const after = comparisonAfterPeriodLabel(purpose);
  return (
    `Only ${pct}% of locations paired across ${before} and ${after}. ` +
    "Unpaired locations appear in the report appendix."
  );
}

export function reportComparisonDateRangeLabel(
  purpose: PropertyReportPurpose,
  baselineStart?: string,
  baselineEnd?: string,
  comparisonStart?: string,
  comparisonEnd?: string
): string | null {
  if (!baselineStart || !comparisonStart) return null;
  const formatRange = (start?: string, end?: string) => {
    if (!start && !end) return "—";
    if (!end || start === end) return start ?? end ?? "—";
    return `${start} — ${end}`;
  };
  if (
    purpose === "rental_security" &&
    baselineStart === comparisonStart &&
    baselineEnd === comparisonEnd
  ) {
    return `Move-in to move-out ${formatRange(baselineStart, baselineEnd)}`;
  }
  const before = comparisonBeforePeriodLabel(purpose);
  const after = comparisonAfterPeriodLabel(purpose);
  return `${before} ${formatRange(baselineStart, baselineEnd)} · ${after} ${formatRange(comparisonStart, comparisonEnd)}`;
}

/** Keep range end in sync with start until the user edits end explicitly. */
export function rangeEndAfterStartChange(
  nextStart: string,
  currentStart: string,
  currentEnd: string,
  endManuallyEdited: boolean
): string {
  if (endManuallyEdited) return currentEnd;
  if (currentEnd === currentStart) return nextStart;
  return currentEnd;
}

export function rentalMoveInDates(moveIn: string): {
  baselineStart: string;
  baselineEnd: string;
} {
  return { baselineStart: moveIn, baselineEnd: moveIn };
}

export function rentalMoveOutDates(moveOut: string): {
  comparisonStart: string;
  comparisonEnd: string;
} {
  return { comparisonStart: moveOut, comparisonEnd: moveOut };
}

function formatUtcIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Expand a picked move-in/out day to the full calendar month for checkpoint matching. */
export function monthRangeContainingDate(isoDate: string): ReportSnapshotDateRange {
  const [year, month] = isoDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    start: formatUtcIsoDate(start),
    end: formatUtcIsoDate(end),
  };
}

/** Move-in/out anchors → full tenancy span; pairing uses earliest vs latest per location. */
export function rentalComparisonRangesFromAnchors(
  moveInAnchor: string,
  moveOutAnchor: string
): {
  baselineStart: string;
  baselineEnd: string;
  comparisonStart: string;
  comparisonEnd: string;
} {
  const start = moveInAnchor <= moveOutAnchor ? moveInAnchor : moveOutAnchor;
  const end = moveInAnchor <= moveOutAnchor ? moveOutAnchor : moveInAnchor;
  return {
    baselineStart: start,
    baselineEnd: end,
    comparisonStart: start,
    comparisonEnd: end,
  };
}
