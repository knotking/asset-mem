import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Plus } from 'lucide-react-native';
import { RecordingTestIds } from '@/lib/recording-test-ids';

interface AddNewPropertyProps {
  onPress: () => void;
}

export default function AddNewProperty({ onPress }: AddNewPropertyProps) {
  return (
    <TouchableOpacity
      testID={RecordingTestIds.dashboard.addProperty}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Add New Property"
      onPress={onPress}
      activeOpacity={0.7}>
      <View className="items-center justify-center rounded-lg border-2 border-dashed border-border bg-background p-8">
        <View className="mb-4 h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <Icon as={Plus} size={24} className="text-secondary-foreground" />
        </View>
        <Text className="w-full text-center text-base font-semibold leading-normal text-foreground">
          Add New Property
        </Text>
        <Text className="text-center text-sm text-muted-foreground">
          Upload documents for a new property
        </Text>
      </View>
    </TouchableOpacity>
  );
}
