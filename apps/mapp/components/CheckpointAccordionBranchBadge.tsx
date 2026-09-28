import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { CheckpointOptionalAgent } from '@asset-mem/common/types';
import { getCheckpointBranchAccordionBadge } from '@asset-mem/common/lib/checkpoint-branch-progress';

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
    <View className="ml-auto flex-row items-center gap-1.5 rounded-full bg-muted px-2 py-0.5">
      {badge.kind === 'running' ? <ActivityIndicator size="small" /> : null}
      {badge.kind === 'completed' ? (
        <Icon as={Check} size={12} className="text-success" />
      ) : null}
      {badge.kind !== 'completed' ? (
        <Text className="text-xs text-muted-foreground">{badge.label}</Text>
      ) : null}
    </View>
  );
}
