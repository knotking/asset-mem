import type { PropertyReportPurpose } from "../types";

export type ReportQuickPresetId = "showing-today" | "move-in-out";

export type ReportQuickPreset = {
  id: ReportQuickPresetId;
  label: string;
  description: string;
  mode: "snapshot" | "comparison";
  purpose: PropertyReportPurpose;
};

export const REPORT_QUICK_PRESETS: ReportQuickPreset[] = [
  {
    id: "showing-today",
    label: "Showing snapshot (today)",
    description: "Single-day realtor showing snapshot.",
    mode: "snapshot",
    purpose: "realtor_visit",
  },
  {
    id: "move-in-out",
    label: "Move-in / move-out",
    description: "Rental comparison with last month vs prior month.",
    mode: "comparison",
    purpose: "rental_security",
  },
];

export type QuickPresetFormState = {
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

function localIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthYearLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Default wizard range: first through last day of the reference month (local calendar). */
export function defaultReportMonthRange(reference = new Date()): {
  start: string;
  end: string;
} {
  return {
    start: localIsoDate(startOfMonth(reference)),
    end: localIsoDate(endOfMonth(reference)),
  };
}

function monthRangeFormDates(reference = new Date()): Pick<
  QuickPresetFormState,
  | "startDate"
  | "endDate"
  | "baselineStart"
  | "baselineEnd"
  | "comparisonStart"
  | "comparisonEnd"
> {
  const { start, end } = defaultReportMonthRange(reference);
  return {
    startDate: start,
    endDate: end,
    baselineStart: start,
    baselineEnd: end,
    comparisonStart: start,
    comparisonEnd: end,
  };
}

export function applyReportQuickPreset(presetId: ReportQuickPresetId): QuickPresetFormState {
  const today = new Date();
  const preset = REPORT_QUICK_PRESETS.find((row) => row.id === presetId);
  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}`);
  }

  if (preset.mode === "snapshot") {
    return {
      mode: "snapshot",
      purpose: preset.purpose,
      title: `Showing snapshot — ${monthYearLabel(today)}`,
      ...monthRangeFormDates(today),
    };
  }

  return {
    mode: "comparison",
    purpose: preset.purpose,
    title: `Move-out comparison — ${monthYearLabel(today)}`,
    ...monthRangeFormDates(today),
  };
}
