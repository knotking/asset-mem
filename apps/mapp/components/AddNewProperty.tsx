import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

export default function AddNewProperty() {
  return (
    <View className="items-center justify-center rounded-lg border-2 border-dashed border-border bg-background p-8">
      <View className="mb-4 h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <Text className="text-2xl font-bold text-secondary-foreground">+</Text>
      </View>
      <Text className="text-base font-semibold text-foreground">Add New Property</Text>
      <Text className="text-sm text-muted-foreground">Upload documents for a new property</Text>
    </View>
  );
}
