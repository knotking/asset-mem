import type {
  PropertyReportLayoutId,
  PropertyReportPurpose,
  ReportPreviewResponse,
} from "../types";
import { purposeLabel, layoutLabel } from "./report-templates";

const PURPOSE_ACCENT: Record<PropertyReportPurpose, string> = {
  rental_security: "#0f766e",
  realtor_visit: "#0369a1",
  insurance: "#4338ca",
  custom: "#334155",
};

const PURPOSE_BRAND: Record<PropertyReportPurpose, string> = {
  rental_security: "Rental condition report",
  realtor_visit: "Property showing report",
  insurance: "Insurance documentation report",
  custom: "Property condition report",
};

export type ReportLayoutPreviewInput = {
  title: string;
  purpose: PropertyReportPurpose;
  layoutId: PropertyReportLayoutId;
  propertyName?: string;
  propertyAddress?: string;
  preview: ReportPreviewResponse;
  selectedCount: number;
};

function checkpointRows(preview: ReportPreviewResponse): string[] {
  if (preview.mode === "snapshot") {
    return preview.checkpoints.map(
      (row) =>
        `<li><strong>${escapeHtml(row.location || row.name)}</strong> — ${escapeHtml(
          row.analysisStatus === "completed" ? "ready" : row.analysisStatus || "pending"
        )}</li>`
    );
  }
  const rows: string[] = [];
  for (const pair of preview.pairs) {
    rows.push(`<li><strong>${escapeHtml(pair.location)}</strong> — baseline + comparison pair</li>`);
  }
  for (const row of preview.baselineOnly) {
    rows.push(
      `<li><strong>${escapeHtml(row.location || row.name)}</strong> — baseline only</li>`
    );
  }
  for (const row of preview.comparisonOnly) {
    rows.push(
      `<li><strong>${escapeHtml(row.location || row.name)}</strong> — comparison only</li>`
    );
  }
  return rows;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Lightweight HTML mockup for pre-generate layout review (not the server PDF). */
export function buildReportLayoutPreviewHtml(input: ReportLayoutPreviewInput): string {
  const accent = PURPOSE_ACCENT[input.purpose];
  const brand = PURPOSE_BRAND[input.purpose];
  const rows = checkpointRows(input.preview);
  const modeLabel = input.preview.mode === "comparison" ? "Comparison" : "Snapshot";
  const warnings =
    input.preview.warnings?.length > 0
      ? `<p class="warn">${escapeHtml(input.preview.warnings.join(" "))}</p>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 16px; color: #1e293b; background: #f8fafc; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; max-width: 520px; margin: 0 auto; }
    .bar { height: 5px; background: ${accent}; }
    .body { padding: 18px 20px 22px; }
    .brand { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: ${accent}; font-weight: 700; }
    h1 { font-size: 22px; margin: 8px 0 14px; color: #0f172a; line-height: 1.25; }
    .meta { font-size: 13px; color: #64748b; margin-bottom: 6px; }
    .meta strong { color: #334155; }
    ul { margin: 12px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.5; }
    .notice { margin: 0 0 14px; padding: 10px 12px; background: #f1f5f9; border-left: 4px solid #64748b; font-size: 12px; color: #475569; line-height: 1.45; }
    .warn { margin-top: 12px; padding: 10px 12px; background: #fff7ed; border-left: 4px solid #f97316; font-size: 12px; color: #9a3412; }
    .footer { margin-top: 14px; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="bar"></div>
    <div class="body">
      <p class="notice">Layout preview is unavailable. This summary shows your report settings and selected checkpoints only — not the formatted PDF.</p>
      <div class="brand">${escapeHtml(brand)}</div>
      <h1>${escapeHtml(input.title || "Property report")}</h1>
      ${
        input.propertyName
          ? `<div class="meta"><strong>Property</strong> ${escapeHtml(input.propertyName)}</div>`
          : ""
      }
      ${
        input.propertyAddress
          ? `<div class="meta"><strong>Address</strong> ${escapeHtml(input.propertyAddress)}</div>`
          : ""
      }
      <div class="meta"><strong>Mode</strong> ${modeLabel}</div>
      <div class="meta"><strong>Purpose</strong> ${escapeHtml(purposeLabel(input.purpose))}</div>
      <div class="meta"><strong>Template</strong> ${escapeHtml(layoutLabel(input.layoutId))}</div>
      <div class="meta"><strong>Included</strong> ${input.selectedCount} checkpoint(s)</div>
      <ul>${rows.join("")}</ul>
      ${warnings}
      <div class="footer">Create PDF to generate the full report with photos, metrics, and layout.</div>
    </div>
  </div>
</body>
</html>`;
}
