import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  className?: string;
};

/** Matches mapp StructuredSectionNav / checkpoint summary card icon treatment. */
export function StructuredAccordionSectionIcon({ icon: Icon, className }: Props) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/50">
      <Icon className={cn("h-[18px] w-[18px]", className)} />
    </div>
  );
}
