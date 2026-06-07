import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CheckpointSummaryField({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-row flex-wrap items-baseline gap-2">
      <span className="shrink-0 text-sm font-medium text-muted-foreground">{label}</span>
      <span className={cn("text-sm text-foreground", valueClassName)}>{value}</span>
    </div>
  );
}

/** Label above prose — full width wrap for longer scalar values. */
export function CheckpointSummaryTextSection({
  label,
  text,
  textClassName,
}: {
  label: string;
  text: string;
  textClassName?: string;
}) {
  return (
    <CheckpointSummaryListSection label={label}>
      <p className={cn("text-sm text-foreground", textClassName)}>{text}</p>
    </CheckpointSummaryListSection>
  );
}

/** Label above content — avoids dead space when lists wrap in a narrow card. */
export function CheckpointSummaryListSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
