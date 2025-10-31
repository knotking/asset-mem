import { Text } from '@/components/ui/text';
import { Stack, useRouter } from 'expo-router';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import AddNewProperty from '@/components/AddNewProperty';
import AddPropertyModal from '@/components/AddPropertyModal';
import PropertyCard from '@/components/PropertyCard';
import PropertyListSkeleton from '@/components/PropertyListSkeleton';
import { usePropertiesList } from '@homeapp/common/contexts/properties-list';

export default function Screen() {
  const { properties, loading, error } = usePropertiesList();
  const router = useRouter();
  const [modalVisible, setModalVisible] = React.useState(false);

  const handleAddPropertySuccess = (propertyId: string) => {
    setModalVisible(false);
    // Navigate to the newly created property
    router.push(`/home/property-details?id=${propertyId}`);
  };

  if (loading) {
    return <PropertyListSkeleton />;
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-red-500">Error: {error}</Text>
      </View>
    );
  }

  return (
    <>
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
          <AddNewProperty onPress={() => setModalVisible(true)} />
        </View>
        {/* Property Cards */}
        <View className="mt-4 px-4">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              id={property.id}
              name={property.name}
              address={property.address}
              cityStateZip={property.cityStateZip || ''}
              docsCount={property.docs || 0}
              servicesCount={property.services || 0}
              checksCount={property.checks || 0}
            />
          ))}
        </View>
      </ScrollView>

      {/* Add Property Modal */}
      <AddPropertyModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={handleAddPropertySuccess}
      />
    </>
  );
}
