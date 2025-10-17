import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Link, Stack } from 'expo-router';
import { Bell, Home, FileText, Briefcase, Cloud, CheckCircle } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import AddNewProperty from '../../components/AddNewProperty';
import PropertyCard from '../../components/PropertyCard';

export default function Screen() {
  const { colorScheme } = useColorScheme();

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="mt-4 px-4">
        <Text className="text-lg font-semibold text-gray-800">Property AI Agent</Text>
        <Text className="mb-4 text-gray-600">
          Upload property documents and chat with AI to get insights or diagnostics of your
          properties and assets
        </Text>
      </View>
      <View className="mt-4 px-4">
        <AddNewProperty />
      </View>
      {/* Property Cards */}
      <View className="mt-4 px-4">
        <PropertyCard
          name=""
          address="9182 Helena Way"
          cityStateZip="Brentwood, CA 94513"
          docsCount={2}
          servicesCount={0}
          cloudsOrChecksCount={0}
          cloudsOrChecksLabel="Clouds"
        />

        <PropertyCard
          name=""
          address="5816 El Dorado Lane"
          cityStateZip="Dublin, CA 94568-4782"
          docsCount={1}
          servicesCount={0}
          cloudsOrChecksCount={0}
          cloudsOrChecksLabel="Checks"
        />
      </View>
    </ScrollView>
  );
}
