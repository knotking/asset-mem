import React from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Sparkles } from 'lucide-react-native';
import type { StructuredResponseData } from '@asset-mem/common/types';
import { formatCheckpointOverallCondition } from '@asset-mem/common/lib/checkpoint-summary-display';
import {
  CheckpointSummaryField,
  CheckpointSummaryListSection,
  CheckpointSummaryTextSection,
} from '@/components/chat/CheckpointSummaryFields';

type CheckpointSummary = NonNullable<
  NonNullable<StructuredResponseData['analysis']>['checkpointSummary']
>;

type Props = {
  checkpointSummary: CheckpointSummary;
};

export function StructuredCheckpointSummaryCard({ checkpointSummary }: Props) {
  const issues = checkpointSummary.issuesDetected ?? [];
  const previewIssues = issues.slice(0, 2);
  const remainingIssueCount = Math.max(0, issues.length - previewIssues.length);

  return (
    <View className="rounded-lg border border-border bg-card px-3 py-3">
      <View className="mb-3 flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-muted/50">
          <Icon as={Sparkles} size={18} className="text-purple-600" />
        </View>
        <Text className="flex-1 text-base font-medium text-foreground">Checkpoint Summary</Text>
      </View>

      <View className="gap-2">
        {checkpointSummary.checkpointsAnalyzed ? (
          <CheckpointSummaryField
            label="Checkpoints Analyzed:"
            value={checkpointSummary.checkpointsAnalyzed}
            valueClassName="font-semibold"
          />
        ) : null}

        {checkpointSummary.overallCondition ? (
          <CheckpointSummaryTextSection
            label="Overall Condition:"
            text={formatCheckpointOverallCondition(checkpointSummary.overallCondition)}
          />
        ) : null}

        {previewIssues.length > 0 ? (
          <CheckpointSummaryListSection label="Issues Detected:">
            <View className="gap-1">
              {previewIssues.map((issue, index) => (
                <View key={`${issue}-${index}`} className="flex-row gap-2">
                  <Text className="text-sm text-foreground">•</Text>
                  <Text className="flex-1 text-sm text-foreground">{issue}</Text>
                </View>
              ))}
              {remainingIssueCount > 0 ? (
                <Text className="text-xs text-muted-foreground">+{remainingIssueCount} more</Text>
              ) : null}
            </View>
          </CheckpointSummaryListSection>
        ) : null}

        {checkpointSummary.locations && checkpointSummary.locations.length > 0 ? (
          <CheckpointSummaryListSection label="Locations:">
            <View className="flex-row flex-wrap gap-1">
              {checkpointSummary.locations.slice(0, 4).map((location, index) => (
                <View key={`${location}-${index}`} className="rounded-md bg-secondary px-2 py-0.5">
                  <Text className="text-xs text-secondary-foreground">{location}</Text>
                </View>
              ))}
            </View>
          </CheckpointSummaryListSection>
        ) : null}
      </View>
    </View>
  );
}
