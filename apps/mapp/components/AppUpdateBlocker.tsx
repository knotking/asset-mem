import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

type AppUpdateBlockerProps = {
  title: string;
  message: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  loading?: boolean;
};

export function AppUpdateBlocker({
  title,
  message,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel,
  onSecondaryPress,
  loading = false,
}: AppUpdateBlockerProps) {
  return (
    <View className="absolute inset-0 z-50 flex-1 items-center justify-center bg-background px-6">
      {loading ? <ActivityIndicator size="large" className="mb-4" /> : null}
      <Text className="mb-2 text-center text-xl font-semibold text-foreground">{title}</Text>
      <Text className="mb-6 text-center text-sm text-muted-foreground">{message}</Text>
      <Button className="w-full max-w-sm" onPress={onPrimaryPress} disabled={loading}>
        <Text>{primaryLabel}</Text>
      </Button>
      {secondaryLabel && onSecondaryPress ? (
        <Button variant="outline" className="mt-3 w-full max-w-sm" onPress={onSecondaryPress}>
          <Text>{secondaryLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}
