import React from 'react';
import { View, Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import type { FeatureTipId } from '@asset-mem/common/lib/feature-discovery';

type FeatureTipBannerProps = {
  tipId: FeatureTipId;
  title: string;
  description: string;
  onDismiss: (tipId: FeatureTipId) => void;
  actionLabel?: string;
  onAction?: () => void;
};

export function FeatureTipBanner({
  tipId,
  title,
  description,
  onDismiss,
  actionLabel,
  onAction,
}: FeatureTipBannerProps) {
  return (
    <View className="mb-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-medium text-foreground">{title}</Text>
          <Text className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</Text>
          {actionLabel && onAction ? (
            <Pressable onPress={onAction} className="mt-2">
              <Text className="text-xs font-medium text-primary">{actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => onDismiss(tipId)}
          accessibilityLabel="Dismiss tip"
          className="h-8 w-8 items-center justify-center">
          <Icon as={X} size={16} className="text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  );
}
