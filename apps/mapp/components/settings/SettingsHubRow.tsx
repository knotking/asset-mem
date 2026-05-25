import * as React from 'react';
import { Pressable, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

type SettingsHubRowProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function SettingsHubRow({
  icon,
  title,
  subtitle,
  onPress,
  accessibilityLabel,
}: SettingsHubRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      className="flex-row items-center gap-3 rounded-lg border border-border bg-card px-3 py-3.5 active:opacity-80">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-muted/50">
        <Icon as={icon} size={18} className="text-foreground" />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-base font-medium text-foreground">{title}</Text>
        {subtitle ? (
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Icon as={ChevronRight} size={18} className="shrink-0 text-muted-foreground" />
    </Pressable>
  );
}
