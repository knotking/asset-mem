import React from 'react';
import { View, Pressable } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Home, FileText, Briefcase, Cloud, CheckCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface PropertyCardProps {
  address: string;
  name: string;
  cityStateZip: string;
  docsCount: number;
  servicesCount: number;
  checksCount: number;
  id: string; // Add id to uniquely identify the property
  onPress?: () => void; // Add optional onPress prop
}

export default function PropertyCard({
  address,
  name,
  cityStateZip,
  docsCount,
  servicesCount,
  checksCount,
  id,
  onPress,
}: PropertyCardProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({ pathname: '/(tabs)/home/property-details', params: { id: id } });
    }
  };

  return (
    <Pressable onPress={handlePress} className="mb-4 rounded-lg bg-background p-4 shadow-sm">
      <View className="mb-4 flex-row items-center gap-2">
        <View
          className="h-12 w-12 items-center justify-center overflow-hidden bg-secondary"
          style={{ borderRadius: 9999 }}>
          <Icon as={Home} size={24} className="text-secondary-foreground" />
        </View>
        <View className="flex-1">
          <Text
            className="text-base font-semibold text-foreground"
            numberOfLines={1}
            ellipsizeMode="tail">
            {name}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1} ellipsizeMode="tail">
            {address}
          </Text>
        </View>
      </View>
      <View className="flex-row justify-around border-t border-border pt-4">
        <View className="items-center">
          <View className="mb-2 h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-blue-100">
            <Icon as={FileText} size={24} className="text-blue-500" />
          </View>
          <Text className="text-lg font-semibold text-foreground">{docsCount}</Text>
          <Text className="text-xs text-muted-foreground">Docs</Text>
        </View>
        <View className="items-center">
          <View className="mb-2 h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-green-100">
            <Icon as={Briefcase} size={24} className="text-green-500" />
          </View>
          <Text className="text-lg font-semibold text-foreground">{servicesCount}</Text>
          <Text className="text-xs text-muted-foreground">Services</Text>
        </View>
        <View className="items-center">
          <View className="mb-2 h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-purple-100">
            <Icon as={CheckCircle} size={24} className="text-purple-500" />
          </View>
          <Text className="text-lg font-semibold text-foreground">{checksCount}</Text>
          <Text className="text-xs text-muted-foreground">Checks</Text>
        </View>
      </View>
    </Pressable>
  );
}
