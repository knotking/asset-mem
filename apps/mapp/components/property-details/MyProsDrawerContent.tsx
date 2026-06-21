import * as React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { X } from 'lucide-react-native';
import { MyProsList } from '@/components/property-details/MyProsList';

interface MyProsDrawerContentProps {
  propertyName: string;
  onClose: () => void;
}

export function MyProsDrawerContent({ propertyName, onClose }: MyProsDrawerContentProps) {
  return (
    <>
      <View className="border-b border-border bg-light-background-alt px-4 py-3">
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-lg font-semibold text-foreground" accessibilityRole="header">
              My pros
            </Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {propertyName}
            </Text>
          </View>
          <Button onPress={onClose} variant="ghost" size="icon" testID="my-pros-drawer-close">
            <Icon as={X} size={24} className="text-foreground" />
          </Button>
        </View>
      </View>
      <MyProsList />
    </>
  );
}
