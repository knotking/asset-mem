import type { PrimaryAgent } from "../types";

export function getPrimaryAgentLabel(agent: PrimaryAgent): string {
  if (agent === "analysis") return "Analysis";
  if (agent === "checkpoint") return "Checkpoint";
  if (agent === "report") return "Reports";
  return "Docs";
}
