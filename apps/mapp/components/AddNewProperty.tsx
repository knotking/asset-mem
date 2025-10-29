import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Plus } from 'lucide-react-native';

interface AddNewPropertyProps {
  onPress: () => void;
}

export default function AddNewProperty({ onPress }: AddNewPropertyProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View className="items-center justify-center rounded-lg border-2 border-dashed border-border bg-background p-8">
        <View className="mb-4 h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <Icon as={Plus} size={24} className="text-secondary-foreground" />
        </View>
        <Text className="text-base font-semibold text-foreground">Add New Property</Text>
        <Text className="text-center text-sm text-muted-foreground">
          Upload documents for a new property
        </Text>
      </View>
    </TouchableOpacity>
  );
}
