"use client";

import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import {
  getCheckpointBranchAccordionBadge,
  type CheckpointOptionalAgent,
} from "@/lib/checkpoint-branch-progress";

type Props = {
  branch: CheckpointOptionalAgent;
  analysis: unknown;
  sectionReady?: boolean;
};

export function CheckpointAccordionBranchBadge({
  branch,
  analysis,
  sectionReady,
}: Props) {
  const badge = getCheckpointBranchAccordionBadge(branch, analysis, sectionReady);
  if (!badge) return null;

  return (
    <Badge variant="secondary" className="ml-auto shrink-0 gap-1 text-xs font-normal">
      {badge.kind === "running" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : null}
      {badge.kind === "completed" ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : null}
      {badge.kind !== "completed" ? <span>{badge.label}</span> : null}
    </Badge>
  );
}
