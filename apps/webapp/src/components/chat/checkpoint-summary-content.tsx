import type { StructuredResponseData } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatCheckpointOverallCondition } from "@/lib/checkpoint-summary-display";
import {
  CheckpointSummaryField,
  CheckpointSummaryListSection,
  CheckpointSummaryTextSection,
} from "@/components/chat/checkpoint-summary-fields";

type CheckpointSummary = NonNullable<
  NonNullable<StructuredResponseData["analysis"]>["checkpointSummary"]
>;

type Props = {
  checkpointSummary: CheckpointSummary;
  /** When set, only show the first N issues (inline preview card). */
  maxIssuesPreview?: number;
};

export function CheckpointSummaryContent({
  checkpointSummary,
  maxIssuesPreview,
}: Props) {
  const issues = checkpointSummary.issuesDetected ?? [];
  const visibleIssues =
    maxIssuesPreview != null ? issues.slice(0, maxIssuesPreview) : issues;
  const remainingIssueCount =
    maxIssuesPreview != null ? Math.max(0, issues.length - visibleIssues.length) : 0;
  const locations =
    maxIssuesPreview != null
      ? (checkpointSummary.locations ?? []).slice(0, 4)
      : (checkpointSummary.locations ?? []);
  const queryType = (checkpointSummary as { queryType?: string }).queryType;
  const dateRange = (checkpointSummary as { dateRange?: string }).dateRange;

  return (
    <div className="space-y-3">
      {checkpointSummary.checkpointsAnalyzed ? (
        <CheckpointSummaryField
          label="Checkpoints Analyzed:"
          value={checkpointSummary.checkpointsAnalyzed}
          valueClassName="font-semibold"
        />
      ) : null}
      {queryType ? (
        <div className="flex flex-row flex-wrap items-center gap-2">
          <span className="shrink-0 text-sm font-medium text-muted-foreground">Query Type:</span>
          <Badge variant="outline" className="text-xs capitalize">
            {queryType}
          </Badge>
        </div>
      ) : null}
      {dateRange ? (
        <CheckpointSummaryTextSection label="Date Range:" text={dateRange} />
      ) : null}
      {checkpointSummary.overallCondition ? (
        <CheckpointSummaryTextSection
          label="Overall Condition:"
          text={formatCheckpointOverallCondition(checkpointSummary.overallCondition)}
        />
      ) : null}
      {visibleIssues.length > 0 ? (
        <CheckpointSummaryListSection label="Issues Detected:">
          <ul className="space-y-1">
            {visibleIssues.map((issue, idx) => (
              <li key={`${issue}-${idx}`} className="flex gap-2 text-sm text-foreground">
                <span aria-hidden>•</span>
                <span className="min-w-0 flex-1">{issue}</span>
              </li>
            ))}
            {remainingIssueCount > 0 ? (
              <li className="text-xs text-muted-foreground">+{remainingIssueCount} more</li>
            ) : null}
          </ul>
        </CheckpointSummaryListSection>
      ) : null}
      {locations.length > 0 ? (
        <CheckpointSummaryListSection label="Locations:">
          <div className="flex flex-wrap gap-1">
            {locations.map((location, idx) => (
              <Badge key={`${location}-${idx}`} variant="secondary" className="text-xs">
                {location}
              </Badge>
            ))}
          </div>
        </CheckpointSummaryListSection>
      ) : null}
    </div>
  );
}
