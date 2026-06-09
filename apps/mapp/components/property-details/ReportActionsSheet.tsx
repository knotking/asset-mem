import * as React from 'react';
import { Modal, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ReportAction = {
  id: string;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

type ReportActionsSheetProps = {
  visible: boolean;
  title: string;
  actions: ReportAction[];
  onClose: () => void;
};

function ActionRow({
  label,
  destructive,
  disabled,
  onPress,
}: Omit<ReportAction, 'id'>) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'rounded-lg border border-border bg-card px-4 py-3.5',
        disabled && 'opacity-50'
      )}>
      <Text
        className={cn(
          'text-center text-base font-medium',
          destructive ? 'text-destructive' : 'text-foreground'
        )}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ReportActionsSheet({
  visible,
  title,
  actions,
  onClose,
}: ReportActionsSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss actions"
          className="absolute inset-0 bg-black/50"
          onPress={onClose}
        />
        <View
          className="rounded-t-2xl border-t border-border bg-background px-4 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          <Text className="mb-1 text-center text-base font-semibold text-foreground" numberOfLines={2}>
            {title}
          </Text>
          <Text className="mb-4 text-center text-sm text-muted-foreground">Choose an action</Text>
          <View className="gap-2">
            {actions.map((action) => (
              <ActionRow key={action.id} {...action} />
            ))}
          </View>
          <Button variant="outline" onPress={onClose} className="mt-4">
            <Text>Cancel</Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
}
