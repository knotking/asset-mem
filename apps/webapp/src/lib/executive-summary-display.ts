/**
 * Narrative markdown shown above structured checkpoint accordions.
 * Mirrored from apps/common/src/lib/executive-summary-display.ts — keep in sync.
 */

const SKIP_SECTION_HEADING =
  /^(#{2,3})\s*(coverage|insurance|repair\s+options?|(estimated\s+)?repair\s+costs?|cost\s+estimates?|diy\b|professional\s+service|service\s+providers?|checkpoint\s+summary|inspection\s+summary|key\s+findings?|findings\s+summary)\b/i;

const KEEP_SECTION_HEADING =
  /^(overview|recommendation|next\s+steps?|summary|findings)\b/i;

export const EXECUTIVE_SUMMARY_ACCORDION_VALUE = "executive-summary";
export const EXECUTIVE_SUMMARY_ACCORDION_TITLE = "Summary & Next Steps";

/** Collapsed trigger copy while synthesis markdown has not arrived yet. */
export const SUMMARY_ACCORDION_PLACEHOLDER_PREVIEW = "Preparing summary…";
export const SUMMARY_ACCORDION_PREVIEW_MAX_CHARS = 140;

export type ExtractExecutiveSummaryOptions = {
  /** When structured checkpointSummary accordion is shown, drop leading prose. */
  omitCheckpointSummaryMarkdown?: boolean;
};

/** Prose after checkpoint-summary bullets in the same markdown section (executor reply). */
function trailingProseAfterCheckpointSummarySection(section: string): string {
  const lines = section.split("\n");
  let index = 0;
  if (/^#{2,3}\s+/.test((lines[0] ?? "").trim())) {
    index = 1;
  }
  let skippedSummaryBullets = false;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      skippedSummaryBullets = true;
      index += 1;
      continue;
    }
    break;
  }
  // Heading-only or prose-only checkpoint summary sections duplicate contentJson.
  if (!skippedSummaryBullets) {
    return "";
  }
  return lines.slice(index).join("\n").trim();
}

/** Extract overview / recommendation prose from synthesis markdown for hybrid UI. */
export function extractExecutiveSummaryNarrative(
  markdown: string,
  options?: ExtractExecutiveSummaryOptions
): string {
  let text = markdown.replace(/```json[\s\S]*?```/gi, "").trim();
  if (!text) return "";

  // Title card uses analysis.title — drop duplicate leading H1.
  text = text.replace(/^#\s+[^\n]+(?:\n+|$)/, "").trim();
  if (!text) return "";

  const sections = text.split(/(?=^#{2,3}\s+)/m);
  const kept: string[] = [];
  let pastCheckpointSummarySection = false;

  for (const section of sections) {
    const s = section.trim();
    if (!s) continue;

    const headingMatch = s.match(/^#{2,3}\s+(.+?)(?:\n|$)/);
    if (!headingMatch) {
      if (
        options?.omitCheckpointSummaryMarkdown &&
        !pastCheckpointSummarySection
      ) {
        continue;
      }
      kept.push(s);
      continue;
    }

    const headingText = (headingMatch[1] ?? "").trim();
    if (SKIP_SECTION_HEADING.test(`### ${headingText}`)) {
      if (/checkpoint\s+summary/i.test(headingText)) {
        pastCheckpointSummarySection = true;
        if (options?.omitCheckpointSummaryMarkdown) {
          const trailing = trailingProseAfterCheckpointSummarySection(s);
          if (trailing) {
            kept.push(trailing);
          }
        }
      }
      continue;
    }
    if (KEEP_SECTION_HEADING.test(headingText)) {
      kept.push(s);
      continue;
    }
    kept.push(s);
  }

  return kept.join("\n\n").trim();
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateSummaryPreview(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trim().replace(/[.,!?;:]?$/, "")}…`;
}

/** Short snippet for the collapsed Summary & Next Steps accordion trigger. */
export function getSummaryAccordionPreview(
  markdown: string,
  maxChars: number = SUMMARY_ACCORDION_PREVIEW_MAX_CHARS
): string {
  const text = markdown.trim();
  if (!text) return "";

  const nextStepsMatch = text.match(
    /^#{2,3}\s+next\s+steps?\s*\n([\s\S]*?)(?=^#{2,3}\s|$)/im
  );
  if (nextStepsMatch?.[1]) {
    const section = nextStepsMatch[1].trim();
    const firstBullet = section.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+)$/m);
    if (firstBullet?.[1]) {
      return truncateSummaryPreview(stripMarkdownInline(firstBullet[1]), maxChars);
    }
    const firstLine = section
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#"));
    if (firstLine) {
      return truncateSummaryPreview(stripMarkdownInline(firstLine), maxChars);
    }
  }

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    return truncateSummaryPreview(stripMarkdownInline(trimmed), maxChars);
  }

  return truncateSummaryPreview(stripMarkdownInline(text), maxChars);
}

/** True when full summary markdown is longer than the collapsed trigger preview. */
export function summaryAccordionPreviewIsTruncated(
  markdown: string,
  preview: string
): boolean {
  if (!preview.trim()) return false;
  const fullPlain = stripMarkdownInline(markdown);
  const previewPlain = preview.replace(/…$/, "").trim();
  if (!previewPlain) return false;
  return fullPlain.length > previewPlain.length + 10;
}

export type CostEstimateRecommendation = {
  notes?: string;
  next_steps?: string;
};

/** Read recommendation.notes / next_steps from costEstimates JSON. */
export function getCostEstimateRecommendation(
  costEstimates: unknown
): CostEstimateRecommendation | null {
  if (!costEstimates || typeof costEstimates !== "object") return null;
  const rec = (costEstimates as Record<string, unknown>).recommendation;
  if (!rec || typeof rec !== "object") return null;
  const row = rec as Record<string, unknown>;
  const notes = typeof row.notes === "string" ? row.notes.trim() : "";
  const next_steps =
    typeof row.next_steps === "string"
      ? row.next_steps.trim()
      : typeof row.nextSteps === "string"
        ? row.nextSteps.trim()
        : "";
  if (!notes && !next_steps) return null;
  return {
    notes: notes || undefined,
    next_steps: next_steps || undefined,
  };
}
