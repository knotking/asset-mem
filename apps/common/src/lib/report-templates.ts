import type { PropertyReportPurpose, PropertyReportTemplate } from "../types";

export type PropertyReportLayoutId = "professional" | "classic";

export type ReportPurposeOption = {
  id: PropertyReportPurpose;
  label: string;
  description: string;
  defaultMode: "snapshot" | "comparison";
};

export type ReportLayoutOption = {
  id: PropertyReportLayoutId;
  label: string;
  description: string;
};

export const REPORT_PURPOSE_OPTIONS: ReportPurposeOption[] = [
  {
    id: "realtor_visit",
    label: "Realtor showing",
    description: "Marketing-friendly snapshot for listings and showings.",
    defaultMode: "snapshot",
  },
  {
    id: "rental_security",
    label: "Rental / move-in-out",
    description: "Deposit and lease records with comparison and signatures.",
    defaultMode: "comparison",
  },
  {
    id: "insurance",
    label: "Insurance documentation",
    description: "Claims support with issues table and change highlights.",
    defaultMode: "snapshot",
  },
  {
    id: "custom",
    label: "Custom",
    description: "General condition report with balanced defaults.",
    defaultMode: "snapshot",
  },
];

export const REPORT_LAYOUT_OPTIONS: ReportLayoutOption[] = [
  {
    id: "professional",
    label: "Professional",
    description: "Branded cover, stats, executive summary, and accent styling.",
  },
];

const PURPOSE_TEMPLATE_OVERRIDES: Record<
  PropertyReportPurpose,
  Partial<PropertyReportTemplate>
> = {
  rental_security: {},
  realtor_visit: {},
  insurance: {},
  custom: {},
};

export function defaultPurposeForMode(
  mode: "snapshot" | "comparison"
): PropertyReportPurpose {
  return mode === "comparison" ? "rental_security" : "realtor_visit";
}

export type ReportSectionToggle = {
  key: keyof Pick<
    PropertyReportTemplate,
    | "includePhotos"
    | "includeIssueTable"
    | "includeMetricsChart"
    | "includeVisualDiff"
    | "includeRecommendations"
    | "includeSignatureBlock"
  >;
  label: string;
  description: string;
  comparisonOnly?: boolean;
};

export const REPORT_SECTION_TOGGLES: ReportSectionToggle[] = [
  {
    key: "includePhotos",
    label: "Photos",
    description: "Include checkpoint images in the PDF.",
  },
  {
    key: "includeMetricsChart",
    label: "Metrics chart",
    description: "Headline score and issue severity bars.",
  },
  {
    key: "includeIssueTable",
    label: "Issues table",
    description: "Consolidated issues summary section.",
  },
  {
    key: "includeVisualDiff",
    label: "Visual diff",
    description: "Show change heatmaps for paired locations.",
    comparisonOnly: true,
  },
  {
    key: "includeRecommendations",
    label: "Recommendations",
    description: "Suggested next steps at the end of the report.",
  },
  {
    key: "includeSignatureBlock",
    label: "Signatures",
    description: "Signature and date lines for acknowledgment.",
  },
];

export type ReportSectionToggleState = Pick<
  PropertyReportTemplate,
  | "includePhotos"
  | "includeIssueTable"
  | "includeMetricsChart"
  | "includeVisualDiff"
  | "includeRecommendations"
  | "includeSignatureBlock"
>;

export function sectionTogglesFromTemplate(
  template?: Partial<PropertyReportTemplate> | null,
  purpose: PropertyReportPurpose = "custom",
  layoutId: PropertyReportLayoutId = "professional"
): ReportSectionToggleState {
  const defaults = buildReportTemplate(purpose, layoutId);
  return {
    includePhotos: template?.includePhotos ?? defaults.includePhotos,
    includeIssueTable: template?.includeIssueTable ?? defaults.includeIssueTable,
    includeMetricsChart: template?.includeMetricsChart ?? defaults.includeMetricsChart,
    includeVisualDiff: template?.includeVisualDiff ?? defaults.includeVisualDiff,
    includeRecommendations:
      template?.includeRecommendations ?? defaults.includeRecommendations,
    includeSignatureBlock:
      template?.includeSignatureBlock ?? defaults.includeSignatureBlock,
  };
}

export function buildReportTemplate(
  purpose: PropertyReportPurpose,
  layoutId: PropertyReportLayoutId,
  overrides?: Partial<PropertyReportTemplate>
): PropertyReportTemplate {
  return {
    layoutId,
    includeCoverPage: true,
    includePhotos: true,
    includeIssueTable: true,
    includeMetricsChart: true,
    includeVisualDiff: true,
    includeRecommendations: true,
    includeSignatureBlock: false,
    ...PURPOSE_TEMPLATE_OVERRIDES[purpose],
    ...overrides,
  };
}

export function purposeLabel(purpose: PropertyReportPurpose): string {
  return (
    REPORT_PURPOSE_OPTIONS.find((option) => option.id === purpose)?.label ??
    purpose
  );
}

export function layoutLabel(layoutId: PropertyReportLayoutId): string {
  if (layoutId === "classic") {
    return "Classic";
  }
  return (
    REPORT_LAYOUT_OPTIONS.find((option) => option.id === layoutId)?.label ??
    layoutId
  );
}
