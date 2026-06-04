import type { Checkpoint } from '../types';

/**
 * Severity-tier labels for checkpoint list cards (used by mapp).
 * Webapp keeps an equivalent copy in checkpoint-card.tsx — keep labels in sync manually.
 */
export type CheckpointListBadgeVariant =
  | 'critical'
  | 'major'
  | 'needs_attention'
  | 'good'
  | 'no_analysis';

export type CheckpointListConditionBadge = {
  label: string;
  variant: CheckpointListBadgeVariant;
};

function issueSeverity(issue: unknown): string | undefined {
  if (typeof issue === 'object' && issue !== null && 'severity' in issue) {
    const sev = (issue as { severity?: unknown }).severity;
    return typeof sev === 'string' ? sev : undefined;
  }
  return undefined;
}

/**
 * Condition label for checkpoint list cards. Returns null when analyzing or failed
 * (callers render those states with separate badges).
 */
export function getCheckpointListConditionBadge(
  checkpoint: Checkpoint
): CheckpointListConditionBadge | null {
  const status = checkpoint.analysisStatus;
  if (status === 'processing' || status === 'pending' || status === 'failed') {
    return null;
  }

  const hasAnalysis = !!checkpoint.aiAnalysis;
  if (!hasAnalysis) {
    return { label: 'No Analysis', variant: 'no_analysis' };
  }

  const issues = checkpoint.aiAnalysis?.issues ?? [];
  const hasCritical = issues.some((i) => issueSeverity(i) === 'critical');
  const hasMajor = issues.some((i) => issueSeverity(i) === 'major');

  if (hasCritical) {
    return { label: 'Critical Issues', variant: 'critical' };
  }
  if (hasMajor) {
    return { label: 'Major Issues', variant: 'major' };
  }
  if (issues.length > 0) {
    return { label: 'Needs Attention', variant: 'needs_attention' };
  }
  return { label: 'Good Condition', variant: 'good' };
}
