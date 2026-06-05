'use client';

import type { UserPreferences } from '@/lib/types';
import type { PrimaryAgent } from '@/lib/types';
import type { CheckpointOptionalAgent, AnalysisOptionalAgent } from '@/lib/types';

export function buildDiscoveryMilestoneUpdates(input: {
  preferences: UserPreferences | null | undefined;
  primaryAgent: PrimaryAgent;
  checkpointIds: string[];
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  selectedOptionalAgents: AnalysisOptionalAgent[];
}): Partial<UserPreferences> {
  const updates: Partial<UserPreferences> = {};
  const { preferences, primaryAgent, checkpointIds, selectedCheckpointOptionalAgents } =
    input;

  if (checkpointIds.length >= 2 && !preferences?.discoveryMultiCheckpointChat) {
    updates.discoveryMultiCheckpointChat = true;
  }

  if (
    primaryAgent === 'checkpoint' &&
    selectedCheckpointOptionalAgents.length > 0 &&
    !preferences?.discoveryOptionalAgentUsed
  ) {
    updates.discoveryOptionalAgentUsed = true;
  }

  return updates;
}
