import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

export default function AddNewProperty() {
  return (
    <View className="items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white p-8">
      <View className="mb-4 h-12 w-12 items-center justify-center rounded-full bg-gray-200">
        <Text className="text-2xl font-bold text-gray-600">+</Text>
      </View>
      <Text className="text-base font-semibold text-gray-700">Add New Property</Text>
      <Text className="text-sm text-gray-500">Upload documents for a new property</Text>
    </View>
  );
}
