/**
 * Assistant message copy export — local copy for App Hosting (webapp does not depend on @homeapp/common).
 * Keep in sync with apps/common/src/lib/message-copy-text.ts.
 */

import type {
  DiyCostEstimatesSummary,
  Message,
  Product,
  ServiceProvider,
  StructuredResponseData,
} from "@/lib/types";
import { structuredDataHasVisibleSections } from "@/lib/message-display-parts";
import { extractExecutiveSummaryNarrative } from "@/lib/executive-summary-display";
import { resolveMessageContentParts } from "@/lib/message-content-parts";
import {
  collectServiceProviderCandidates,
  isDisplayableServiceProvider,
} from "@/lib/service-providers";

/** plain = WhatsApp-friendly; markdown = [label](url) links and ## headings for rich paste. */
export type MessageCopyFormat = "plain" | "markdown";

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
}

/** Percent-encode spaces so markdown links survive inline HTML conversion. */
function encodeUrlForCopyLink(url: string): string {
  return url.trim().replace(/ /g, "%20");
}

function formatLinkLabel(label: string, url: string, format: MessageCopyFormat): string {
  const safeUrl = encodeUrlForCopyLink(url);
  return format === "markdown" ? `[${label}](${safeUrl})` : `${label}: ${safeUrl}`;
}

function sectionHeadingLine(heading: string, format: MessageCopyFormat, level: 1 | 2 = 2): string {
  if (format === "markdown") {
    return `${"#".repeat(level)} ${heading}`;
  }
  return level === 1 ? `*${heading}*` : `*${heading}*`;
}

function appendSection(
  lines: string[],
  heading: string,
  body: string,
  format: MessageCopyFormat
): void {
  const trimmed = body.trim();
  if (!trimmed) return;
  lines.push(sectionHeadingLine(heading, format), trimmed, "");
}

function appendBulletList(
  lines: string[],
  items: string[],
  format: MessageCopyFormat
): void {
  const prefix = format === "markdown" ? "- " : "• ";
  for (const item of items) {
    const trimmed = item.trim();
    if (trimmed) lines.push(`${prefix}${trimmed}`);
  }
}

function synthesisMarkdown(message: Message): string {
  if (typeof message.contentMarkdown === "string" && message.contentMarkdown.trim()) {
    return message.contentMarkdown.trim();
  }
  const content = typeof message.content === "string" ? message.content.trim() : "";
  if (!content || content.startsWith("{") || content.startsWith("[")) {
    return "";
  }
  return content;
}

function getDiyBlock(diy: unknown): Record<string, unknown> | null {
  return diy && typeof diy === "object" && !Array.isArray(diy)
    ? (diy as Record<string, unknown>)
    : null;
}

function getDiyCostBlock(diy: unknown): DiyCostEstimatesSummary | null {
  const record = getDiyBlock(diy);
  if (!record) return null;
  const nested = record.diyCostEstimates;
  if (nested && typeof nested === "object") return nested as DiyCostEstimatesSummary;
  return record as DiyCostEstimatesSummary;
}

function diyCostHasContent(ce: DiyCostEstimatesSummary): boolean {
  const diy = ce.DIY;
  return !!(
    ce.repair_type?.trim() ||
    diy?.cost_range?.trim() ||
    (diy?.includes && diy.includes.length > 0) ||
    diy?.savings?.trim() ||
    diy?.complexity?.trim()
  );
}

function serializeDiyCostBlock(ce: DiyCostEstimatesSummary, format: MessageCopyFormat): string {
  const lines: string[] = [];
  if (ce.repair_type?.trim()) lines.push(`Repair: ${ce.repair_type.trim()}`);
  const diy = ce.DIY;
  if (diy?.cost_range?.trim()) lines.push(`Cost range: ${diy.cost_range.trim()}`);
  if (diy?.complexity?.trim()) lines.push(`Complexity: ${diy.complexity.trim()}`);
  if (diy?.savings?.trim()) lines.push(`Savings: ${diy.savings.trim()}`);
  if (diy?.includes?.length) {
    lines.push("Includes:");
    appendBulletList(lines, diy.includes, format);
  }
  return lines.join("\n");
}

function serializeProduct(
  product: Product,
  index: number,
  format: MessageCopyFormat
): string {
  const name = pickString(product.item_name, product.product_name, product.vendor, "Product");
  const lines = [`${index + 1}. ${name}`];
  const price = pickString(product.price, product.item_price);
  if (price) lines.push(`   Price: ${price}`);
  const vendor = pickString(product.vendor);
  if (vendor && vendor !== name) lines.push(`   Vendor: ${vendor}`);
  const description = pickString(product.description);
  if (description) lines.push(`   ${description}`);
  const url = pickString(product.store_url, product.url);
  if (url) {
    lines.push(
      format === "markdown"
        ? `   ${formatLinkLabel(name, url, format)}`
        : `   ${url}`
    );
  }
  return lines.join("\n");
}

function providerName(provider: Record<string, unknown>): string {
  return pickString(
    provider.name,
    provider.business_name,
    provider.businessName,
    provider.title,
    provider.company,
    provider.provider,
    provider.store
  );
}

function serializeProvider(
  provider: ServiceProvider | Record<string, unknown>,
  format: MessageCopyFormat
): string {
  const record = provider as Record<string, unknown>;
  const name = providerName(record) || "Provider";
  const lines = [name];
  const contact = pickString(
    record.contact_info,
    record.phone,
    record.phoneNumber,
    record.contact,
    record.contactInfo
  );
  if (contact) lines.push(`Phone: ${contact}`);
  const location = pickString(record.location, record.address, record.address_line);
  if (location) lines.push(`Location: ${location}`);
  const ratings = pickString(record.ratings, record.rating);
  const reviews = pickString(record.reviews, record.review_count, record.reviewCount);
  if (ratings) lines.push(`Rating: ${ratings}${reviews ? ` (${reviews} reviews)` : ""}`);
  else if (reviews) lines.push(`Reviews: ${reviews}`);
  const distance = record.distance_miles ?? record._distance_miles ?? record.distance;
  if (distance != null && String(distance).trim()) {
    lines.push(`Distance: ${String(distance).trim()} mi`);
  }
  const specialties = pickString(record.specialties, record.services);
  if (specialties) lines.push(`Specialties: ${specialties}`);
  const additional = pickString(record.additional_information, record.description, record.about);
  if (additional) lines.push(additional);
  const website = pickString(record.website, record.url, record.link);
  if (website) lines.push(formatLinkLabel("Website", website, format));
  const directions = pickString(record.directions, record.directions_url, record.map_link);
  if (directions) lines.push(formatLinkLabel("Directions", directions, format));
  return lines.join("\n");
}

function collectProviders(service: Record<string, unknown> | undefined): ServiceProvider[] {
  if (!service) return [];
  return collectServiceProviderCandidates(service)
    .filter(isDisplayableServiceProvider)
    .slice(0, 10) as ServiceProvider[];
}

function serializeCostEstimates(
  costEstimates: Record<string, unknown>,
  format: MessageCopyFormat
): string {
  const lines: string[] = [];
  const repairType = pickString(costEstimates.repair_type);
  if (repairType) lines.push(`Repair: ${repairType}`);

  const diy = costEstimates.DIY as Record<string, unknown> | undefined;
  if (diy && typeof diy === "object") {
    lines.push("", sectionHeadingLine("DIY", format));
    const range = pickString(diy.cost_range);
    if (range) lines.push(`Cost range: ${range}`);
    const complexity = pickString(diy.complexity);
    if (complexity) lines.push(`Complexity: ${complexity}`);
    const savings = pickString(diy.savings);
    if (savings) lines.push(`Savings: ${savings}`);
    const includes = diy.includes;
    if (Array.isArray(includes) && includes.length > 0) {
      lines.push("Includes:");
      appendBulletList(
        lines,
        includes.map((item) => String(item)),
        format
      );
    }
  }

  const service = costEstimates.Service as Record<string, unknown> | undefined;
  if (service && typeof service === "object") {
    lines.push("", sectionHeadingLine("Professional", format));
    const range = pickString(service.cost_range);
    if (range) lines.push(`Cost range: ${range}`);
    const complexity = pickString(service.complexity);
    if (complexity) lines.push(`Complexity: ${complexity}`);
    const benefits = pickString(service.benefits);
    if (benefits) lines.push(`Benefits: ${benefits}`);
    const includes = service.includes;
    if (Array.isArray(includes) && includes.length > 0) {
      lines.push("Includes:");
      appendBulletList(
        lines,
        includes.map((item) => String(item)),
        format
      );
    }
  }

  const comparison = costEstimates.comparison as Record<string, unknown> | undefined;
  if (comparison && typeof comparison === "object") {
    lines.push("", sectionHeadingLine("Comparison", format));
    for (const [key, label] of [
      ["diy_savings", "DIY savings"],
      ["professional_benefits", "Professional benefits"],
      ["considerations", "Considerations"],
    ] as const) {
      const value = pickString(comparison[key]);
      if (value) lines.push(`${label}: ${value}`);
    }
  }

  const recommendation = costEstimates.recommendation as Record<string, unknown> | undefined;
  if (recommendation && typeof recommendation === "object") {
    lines.push("", sectionHeadingLine("Recommendation", format));
    const notes = pickString(recommendation.notes);
    if (notes) lines.push(notes);
    const nextSteps = pickString(recommendation.next_steps);
    if (nextSteps) lines.push(`Next steps: ${nextSteps}`);
  }

  return lines.join("\n");
}

/** Plain-text export of structured accordion content (markdown-style, pre-WhatsApp). */
export function buildStructuredResponseCopyText(
  data: StructuredResponseData,
  markdown: string,
  format: MessageCopyFormat = "plain"
): string {
  const analysis = data.analysis || ({} as NonNullable<StructuredResponseData["analysis"]>);
  const root = data as Record<string, unknown>;
  const analysisRecord = analysis as Record<string, unknown>;

  const triage = (analysis.triageResult || root.triageResult) as
    | Record<string, unknown>
    | undefined;
  const checkpointSummary = analysis.checkpointSummary;
  const coverage = (analysis.coverageResult || root.coverageResult) as
    | Record<string, unknown>
    | undefined;
  const diy = analysis.diyResults || root.diyResults;
  const service = (analysis.serviceResults || root.serviceResults) as
    | Record<string, unknown>
    | undefined;
  const costRoot = (root.costEstimationResults || analysisRecord.costEstimationResults) as
    | Record<string, unknown>
    | undefined;

  const title = pickString(analysis.title, root.title as string | undefined);
  const hasCheckpointSummary = !!(
    checkpointSummary &&
    (checkpointSummary.checkpointsAnalyzed ||
      (checkpointSummary.issuesDetected && checkpointSummary.issuesDetected.length > 0) ||
      checkpointSummary.overallCondition?.trim() ||
      (checkpointSummary.locations && checkpointSummary.locations.length > 0))
  );

  const lines: string[] = [];
  if (title) {
    lines.push(sectionHeadingLine(title, format, 1), "");
  }

  const summaryNarrative = extractExecutiveSummaryNarrative(markdown, {
    omitCheckpointSummaryMarkdown: hasCheckpointSummary,
  });
  if (summaryNarrative) {
    appendSection(lines, "Summary & Next Steps", summaryNarrative, format);
  }

  if (triage?.needs_clarification === true) {
    const clarificationLines: string[] = [];
    const message = pickString(triage.message);
    if (message) clarificationLines.push(message);
    const questions = triage.clarification_questions;
    if (Array.isArray(questions) && questions.length > 0) {
      appendBulletList(
        clarificationLines,
        questions.map((q) => String(q)),
        format
      );
    }
    appendSection(lines, "Clarification needed", clarificationLines.join("\n"), format);
  } else {
    const diagnosis = pickString(triage?.diagnosis);
    if (diagnosis) appendSection(lines, "Diagnosis", diagnosis, format);
  }

  if (hasCheckpointSummary && checkpointSummary) {
    const summaryLines: string[] = [];
    if (checkpointSummary.checkpointsAnalyzed != null) {
      summaryLines.push(`Checkpoints analyzed: ${checkpointSummary.checkpointsAnalyzed}`);
    }
    if (checkpointSummary.overallCondition?.trim()) {
      summaryLines.push(`Overall condition: ${checkpointSummary.overallCondition.trim()}`);
    }
    if (checkpointSummary.propertyAddress?.trim()) {
      summaryLines.push(`Property: ${checkpointSummary.propertyAddress.trim()}`);
    }
    if (checkpointSummary.locations?.length) {
      summaryLines.push(`Locations: ${checkpointSummary.locations.join(", ")}`);
    }
    if (checkpointSummary.issuesDetected?.length) {
      summaryLines.push("Issues detected:");
      appendBulletList(summaryLines, checkpointSummary.issuesDetected, format);
    }
    appendSection(lines, "Checkpoint Summary", summaryLines.join("\n"), format);
  }

  const checkpointDetails = analysisRecord.checkpointDetails;
  if (Array.isArray(checkpointDetails) && checkpointDetails.length > 0) {
    const detailLines: string[] = [];
    checkpointDetails.forEach((detail, index) => {
      if (!detail || typeof detail !== "object") return;
      const record = detail as Record<string, unknown>;
      const header = pickString(record.name, record.location, `Checkpoint ${index + 1}`);
      detailLines.push(`${index + 1}. ${header}`);
      const summary = pickString(record.summary);
      if (summary) detailLines.push(`   ${summary}`);
      for (const [key, label] of [
        ["detectedItems", "Detected"],
        ["conditions", "Conditions"],
        ["issues", "Issues"],
      ] as const) {
        const value = record[key];
        if (Array.isArray(value) && value.length > 0) {
          detailLines.push(`   ${label}:`);
          for (const item of value) {
            detailLines.push(`   • ${String(item)}`);
          }
        }
      }
      detailLines.push("");
    });
    appendSection(lines, "Checkpoint Details", detailLines.join("\n").trim(), format);
  }

  const insights = analysisRecord.insights as Record<string, unknown> | undefined;
  if (insights && typeof insights === "object") {
    const insightLines: string[] = [];
    for (const [key, label] of [
      ["changes", "Changes"],
      ["patterns", "Patterns"],
      ["recommendations", "Recommendations"],
    ] as const) {
      const value = pickString(insights[key]);
      if (value) {
        insightLines.push(`${label}:`);
        insightLines.push(value);
        insightLines.push("");
      }
    }
    appendSection(lines, "Insights", insightLines.join("\n").trim(), format);
  }

  if (coverage) {
    const coverageLines: string[] = [];
    const warranty = pickString(coverage.warrantyInfo);
    if (warranty) coverageLines.push(`Warranty: ${warranty}`);
    const insurance = pickString(coverage.insuranceInfo);
    if (insurance) coverageLines.push(`Insurance: ${insurance}`);
    appendSection(lines, "Coverage", coverageLines.join("\n"), format);
  }

  const diyRecord = getDiyBlock(diy);
  if (diyRecord) {
    const diyLines: string[] = [];
    if (
      diyRecord.hireProfessionalRecommended === true ||
      diyRecord.hire_professional_recommended === true
    ) {
      diyLines.push("Professional help is recommended for this repair.");
    }
    const diyCost = getDiyCostBlock(diy);
    if (diyCost && diyCostHasContent(diyCost)) {
      diyLines.push(serializeDiyCostBlock(diyCost, format));
    }
    const diySteps = diyRecord.diySteps as Record<string, unknown> | undefined;
    const stepsSummary = pickString(diySteps?.summary);
    if (stepsSummary) diyLines.push(stepsSummary);
    const steps = diySteps?.steps;
    if (Array.isArray(steps) && steps.length > 0) {
      diyLines.push("Steps:");
      steps.forEach((step, index) => {
        if (!step || typeof step !== "object") return;
        const record = step as Record<string, unknown>;
        const description = pickString(record.description);
        const stepNumber = record.stepNumber ?? index + 1;
        if (description) diyLines.push(`${stepNumber}. ${description}`);
      });
    }
    const videos = (diyRecord.youtubeSearch as Record<string, unknown> | undefined)?.videos;
    if (Array.isArray(videos) && videos.length > 0) {
      diyLines.push("Videos:");
      videos.forEach((video, index) => {
        if (!video || typeof video !== "object") return;
        const record = video as Record<string, unknown>;
        const videoTitle = pickString(record.title, `Video ${index + 1}`);
        const url = pickString(record.url);
        if (url) {
          diyLines.push(
            format === "markdown"
              ? `- ${formatLinkLabel(videoTitle, url, format)}`
              : `• ${videoTitle}: ${url}`
          );
        } else {
          diyLines.push(format === "markdown" ? `- ${videoTitle}` : `• ${videoTitle}`);
        }
      });
    }
    const products = (diyRecord.recommendedProducts as Record<string, unknown> | undefined)
      ?.products;
    if (Array.isArray(products) && products.length > 0) {
      diyLines.push("Recommended products:");
      products.forEach((product, index) => {
        if (product && typeof product === "object") {
          diyLines.push(serializeProduct(product as Product, index, format));
        }
      });
    }
    appendSection(lines, "DIY Recommendations", diyLines.join("\n"), format);
  }

  const providers = collectProviders(service);
  const serviceSearchFailed =
    String(service?.searchStatus ?? "")
      .trim()
      .toLowerCase() === "failed";
  if (providers.length > 0) {
    appendSection(
      lines,
      "Service Recommendations",
      providers
        .map((provider, index) => `${index + 1}.\n${serializeProvider(provider, format)}`)
        .join("\n\n"),
      format
    );
  } else if (serviceSearchFailed) {
    const error = pickString(service?.searchError) || "Service provider search did not complete.";
    appendSection(lines, "Service Recommendations", error, format);
  }

  const costEstimates = costRoot?.costEstimates as Record<string, unknown> | undefined;
  if (costEstimates && typeof costEstimates === "object") {
    appendSection(lines, "Cost Estimates", serializeCostEstimates(costEstimates, format), format);
  }

  return lines.join("\n").trim();
}

/** Build copy text for an assistant message (markdown or structured export). */
export function buildAssistantMessageCopyText(
  message: Message,
  format: MessageCopyFormat = "plain"
): string {
  const { markdown, contentJson } = resolveMessageContentParts(message);
  if (message.role !== "assistant") {
    return markdown;
  }
  if (contentJson && structuredDataHasVisibleSections(contentJson)) {
    return buildStructuredResponseCopyText(
      contentJson,
      synthesisMarkdown(message) || markdown,
      format
    );
  }
  return markdown;
}
