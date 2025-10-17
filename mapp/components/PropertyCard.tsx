import React from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Home, FileText, Briefcase, Cloud, CheckCircle } from 'lucide-react-native';

interface PropertyCardProps {
  address: string;
  name: string;
  cityStateZip: string;
  docsCount: number;
  servicesCount: number;
  cloudsOrChecksCount: number;
  cloudsOrChecksLabel: string;
}

export default function PropertyCard({
  address,
  cityStateZip,
  docsCount,
  servicesCount,
  cloudsOrChecksCount,
  cloudsOrChecksLabel,
}: PropertyCardProps) {
  return (
    <View className="mb-4 rounded-lg bg-white p-4 shadow-sm">
      <View className="mb-4 flex-row items-center gap-2">
        <Icon as={Home} size={20} className="text-gray-700" />
        <View>
          <Text className="text-base font-semibold text-gray-800">{address}</Text>
          <Text className="text-sm text-gray-500">{cityStateZip}</Text>
        </View>
      </View>
      <View className="flex-row justify-around border-t border-gray-200 pt-4">
        <View className="items-center">
          <Icon as={FileText} size={24} className="text-blue-500" />
          <Text className="text-lg font-bold">{docsCount}</Text>
          <Text className="text-xs text-gray-500">Docs</Text>
        </View>
        <View className="items-center">
          <Icon as={Briefcase} size={24} className="text-green-500" />
          <Text className="text-lg font-bold">{servicesCount}</Text>
          <Text className="text-xs text-gray-500">Services</Text>
        </View>
        <View className="items-center">
          <Icon
            as={cloudsOrChecksLabel === 'Clouds' ? Cloud : CheckCircle}
            size={24}
            className="text-purple-500"
          />
          <Text className="text-lg font-bold">{cloudsOrChecksCount}</Text>
          <Text className="text-xs text-gray-500">{cloudsOrChecksLabel}</Text>
        </View>
      </View>
    </View>
  );
}
