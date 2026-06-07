import { Sparkles } from "lucide-react";
import type { StructuredResponseData } from "@/lib/types";
import { CheckpointSummaryContent } from "@/components/chat/checkpoint-summary-content";

type CheckpointSummary = NonNullable<
  NonNullable<StructuredResponseData["analysis"]>["checkpointSummary"]
>;

type Props = {
  checkpointSummary: CheckpointSummary;
};

/** Always-visible checkpoint summary preview for inline structured chat. */
export function StructuredCheckpointSummaryCard({ checkpointSummary }: Props) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="mb-3 flex flex-row items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/50">
          <Sparkles className="h-[18px] w-[18px] text-purple-600" />
        </div>
        <h3 className="min-w-0 flex-1 text-base font-medium text-foreground">Checkpoint Summary</h3>
      </div>
      <CheckpointSummaryContent checkpointSummary={checkpointSummary} maxIssuesPreview={2} />
    </div>
  );
}
