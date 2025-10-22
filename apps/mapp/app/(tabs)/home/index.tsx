import { Text } from '@/components/ui/text';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import AddNewProperty from '@/components/AddNewProperty';
import PropertyCard from '@/components/PropertyCard';
import { useProperties } from '@/contexts/PropertyContext';

export default function Screen() {
  const { colorScheme } = useColorScheme();
  const { properties, loading, error } = useProperties();
  const router = useRouter();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-foreground">Loading properties...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-red-500">Error: {error}</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-light-background-alt">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="mt-4 px-4">
        <Text className="text-lg font-semibold text-foreground">Property AI Agent</Text>
        <Text className="mb-4 text-muted-foreground">
          Upload property documents and chat with AI to get insights or diagnostics of your
          properties and assets
        </Text>
      </View>
      <View className="mt-4 px-4">
        <AddNewProperty />
      </View>
      {/* Property Cards */}
      <View className="mt-4 px-4">
        {properties.map((property) => (
          <PropertyCard
            key={property.id}
            id={property.id}
            name={property.name}
            address={property.address}
            cityStateZip={property.cityStateZip}
            docsCount={property.docs}
            servicesCount={property.services}
            checksCount={property.checks}
          />
        ))}
      </View>
    </ScrollView>
  );
}
