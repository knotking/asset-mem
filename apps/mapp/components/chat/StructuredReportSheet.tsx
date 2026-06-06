import * as React from 'react';
import { Modal, View, ScrollView, Pressable, Platform, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { X } from 'lucide-react-native';
import { getAppThemeColors } from '@/lib/css-theme-tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  onDismissed?: () => void;
  title: string;
  children: React.ReactNode;
};

export function StructuredReportSheet({
  visible,
  onClose,
  onDismissed,
  title,
  children,
}: Props) {
  const colorScheme = useColorScheme();
  const backgroundColor = getAppThemeColors(colorScheme === 'dark').background;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      backdropColor={backgroundColor}
      onRequestClose={onClose}
      onDismiss={onDismissed}>
      <SafeAreaView
        style={{ flex: 1, backgroundColor }}
        edges={Platform.OS === 'ios' ? ['bottom', 'left', 'right'] : undefined}>
        <View style={{ backgroundColor }}>
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <Text className="flex-1 pr-3 text-base font-semibold text-foreground" numberOfLines={2}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close full report"
              className="h-9 w-9 items-center justify-center rounded-full bg-secondary">
              <Icon as={X} size={18} className="text-foreground" />
            </Pressable>
          </View>
        </View>
        <ScrollView
          style={{ flex: 1, backgroundColor }}
          className="px-2 py-3"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 16 }}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
