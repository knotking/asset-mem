import type { LucideIcon } from "lucide-react";
import { Stethoscope, Clock, FileText, ClipboardList } from "lucide-react";
import type { PrimaryAgent } from "@/lib/types";

export function getPrimaryAgentLabel(agent: PrimaryAgent): string {
  if (agent === "analysis") return "Analysis";
  if (agent === "checkpoint") return "Checkpoint";
  if (agent === "report") return "Reports";
  return "Docs";
}

export function getPrimaryAgentIcon(agent: PrimaryAgent): LucideIcon {
  if (agent === "analysis") return Stethoscope;
  if (agent === "checkpoint") return Clock;
  if (agent === "report") return ClipboardList;
  return FileText;
}
