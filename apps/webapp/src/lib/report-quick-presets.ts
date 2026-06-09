/** Mirrored from @homeapp/common — webapp cannot import common (App Hosting). */
import type { PropertyReportPurpose } from '@/lib/types';

export type ReportQuickPresetId = 'showing-today' | 'move-in-out';

export type ReportQuickPreset = {
  id: ReportQuickPresetId;
  label: string;
  description: string;
  mode: 'snapshot' | 'comparison';
  purpose: PropertyReportPurpose;
};

export const REPORT_QUICK_PRESETS: ReportQuickPreset[] = [
  {
    id: 'showing-today',
    label: 'Showing snapshot (today)',
    description: 'Single-day realtor showing snapshot.',
    mode: 'snapshot',
    purpose: 'realtor_visit',
  },
  {
    id: 'move-in-out',
    label: 'Move-in / move-out',
    description: 'Rental comparison with last month vs prior month.',
    mode: 'comparison',
    purpose: 'rental_security',
  },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthYearLabel(d: Date): string {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}

export type QuickPresetFormState = {
  mode: 'snapshot' | 'comparison';
  purpose: PropertyReportPurpose;
  title: string;
  startDate: string;
  endDate: string;
  baselineStart: string;
  baselineEnd: string;
  comparisonStart: string;
  comparisonEnd: string;
};

export function applyReportQuickPreset(presetId: ReportQuickPresetId): QuickPresetFormState {
  const today = new Date();
  const preset = REPORT_QUICK_PRESETS.find((row) => row.id === presetId);
  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}`);
  }

  if (preset.mode === 'snapshot') {
    const day = isoDate(today);
    return {
      mode: 'snapshot',
      purpose: preset.purpose,
      title: `Showing snapshot — ${monthYearLabel(today)}`,
      startDate: day,
      endDate: day,
      baselineStart: day,
      baselineEnd: day,
      comparisonStart: day,
      comparisonEnd: day,
    };
  }

  const priorMonth = addMonths(today, -1);
  const twoMonthsAgo = addMonths(today, -2);
  return {
    mode: 'comparison',
    purpose: preset.purpose,
    title: `Move-out comparison — ${monthYearLabel(priorMonth)}`,
    startDate: isoDate(today),
    endDate: isoDate(today),
    baselineStart: isoDate(startOfMonth(twoMonthsAgo)),
    baselineEnd: isoDate(endOfMonth(twoMonthsAgo)),
    comparisonStart: isoDate(startOfMonth(priorMonth)),
    comparisonEnd: isoDate(endOfMonth(priorMonth)),
  };
}
