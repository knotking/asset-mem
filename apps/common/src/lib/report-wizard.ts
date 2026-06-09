import type { PropertyReportPurpose } from "../types";
import { applyReportQuickPreset } from "./report-quick-presets";
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

export function applyReportIntent(intentId: ReportIntentId): ReportWizardDateState {
  if (intentId === "realtor_showing") {
    return applyReportQuickPreset("showing-today");
  }
  if (intentId === "rental_move") {
    return applyReportQuickPreset("move-in-out");
  }
  const intent = REPORT_INTENT_OPTIONS.find((row) => row.id === intentId);
  const today = new Date().toISOString().slice(0, 10);
  const mode = intent?.mode ?? "snapshot";
  const purpose = intent?.purpose ?? defaultPurposeForMode(mode);
  return {
    mode,
    purpose,
    title: suggestReportTitle(purpose, mode, today, today),
    startDate: today,
    endDate: today,
    baselineStart: today,
    baselineEnd: today,
    comparisonStart: today,
    comparisonEnd: today,
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
