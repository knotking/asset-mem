import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

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
    <View className="flex-row items-baseline gap-2">
      <Text className="shrink-0 text-sm font-medium text-muted-foreground">{label}</Text>
      <Text className={cn('text-sm text-foreground', valueClassName)}>{value}</Text>
    </View>
  );
}

/** Label above prose — full width wrap for longer scalar values (condition, date range). */
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
      <Text className={cn('text-sm text-foreground', textClassName)}>{text}</Text>
    </CheckpointSummaryListSection>
  );
}

/** Label above content — avoids dead space when lists wrap in a narrow card. */
export function CheckpointSummaryListSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-muted-foreground">{label}</Text>
      {children}
    </View>
  );
}
