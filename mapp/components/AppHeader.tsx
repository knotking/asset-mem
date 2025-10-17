import React from 'react';
import { View } from 'react-native';
import { Icon } from '@//components/ui/icon';
import { Text } from '@//components/ui/text';
import { Button } from '@//components/ui/button';
import { Home, Bell } from 'lucide-react-native';

export default function AppHeader() {
  return (
    <View className="flex-row items-center justify-between bg-white p-4 pt-12 shadow-sm">
      <View className="flex-row items-center gap-2">
        <Icon as={Home} size={24} className="text-black" />
        <Text className="text-xl font-bold text-black">HomeGeek AI</Text>
      </View>
      <View className="flex-row items-center gap-4">
        <Button variant="ghost" size="icon">
          <Icon as={Bell} size={24} className="text-gray-700" />
        </Button>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-gray-200">
          <Text className="text-sm font-semibold text-gray-700">PR</Text>
        </View>
      </View>
    </View>
  );
}
