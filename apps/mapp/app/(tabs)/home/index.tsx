import { Text } from '@/components/ui/text';
import { Stack, useRouter } from 'expo-router';
import * as React from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import AddNewProperty from '@/components/AddNewProperty';
import AddPropertyModal from '@/components/AddPropertyModal';
import PropertyCard from '@/components/PropertyCard';
import PropertyListSkeleton from '@/components/PropertyListSkeleton';
import { usePropertiesList } from '@homeapp/common/contexts/properties-list-context';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/ui/icon';
import { Search, X } from 'lucide-react-native';

export default function Screen() {
  const { properties, loading, error } = usePropertiesList();
  const router = useRouter();
  const [modalVisible, setModalVisible] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredProperties = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return properties;
    }
    const normalizedTerm = searchTerm.trim().toLowerCase();
    return properties.filter(
      (property) =>
        property.name?.toLowerCase().includes(normalizedTerm) ||
        property.address?.toLowerCase().includes(normalizedTerm) ||
        property.cityStateZip?.toLowerCase().includes(normalizedTerm)
    );
  }, [properties, searchTerm]);

  const handleAddPropertySuccess = (propertyId: string, selectedFiles: any[]) => {
    setModalVisible(false);
    // Navigate to the newly created property with new=true to show Details tab
    // Pass selected files via router params (they will be handled by property-details)
    router.push({
      pathname: '/home/property-details',
      params: {
        id: propertyId,
        new: 'true',
        // Pass files as JSON string in params
        files: JSON.stringify(
          selectedFiles.map((file) => ({
            uri: file.uri,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
          }))
        ),
      },
    });
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true }} />
        <PropertyListSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true }} />
        <View className="flex-1 items-center justify-center bg-light-background-alt">
          <Text className="text-red-500">Error: {error}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true }} />
      <ScrollView className="flex-1 bg-light-background-alt">
        <View className="mt-4 px-4">
          <Text className="text-lg font-semibold text-foreground">Property AI Agent</Text>
          <Text className="mb-4 text-muted-foreground">
            Upload property documents and chat with AI to get insights or diagnostics of your
            properties and assets
          </Text>
        </View>
        {/* Search Bar */}
        <View className="px-4 mb-4">
          <View className="relative">
            <View className="absolute left-3 top-0 bottom-0 justify-center z-10">
              <Icon as={Search} size={18} className="text-muted-foreground" />
            </View>
            <Input
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search properties..."
              className="pl-10 pr-10"
              accessibilityLabel="Search properties by name or address"
              returnKeyType="search"
            />
            {searchTerm.length > 0 && (
              <Pressable
                className="absolute right-3 top-0 bottom-0 justify-center z-10"
                onPress={() => setSearchTerm('')}
                accessibilityLabel="Clear search"
              >
                <Icon as={X} size={18} className="text-muted-foreground" />
              </Pressable>
            )}
          </View>
        </View>
        <View className="mt-4 px-4">
          <AddNewProperty onPress={() => setModalVisible(true)} />
        </View>
        {/* Property Cards */}
        <View className="mt-4 px-4 pb-4">
          {filteredProperties.length === 0 ? (
            <View className="py-8 items-center">
              <Text className="text-muted-foreground">
                {searchTerm.trim() ? 'No properties match your search.' : 'No properties found.'}
              </Text>
            </View>
          ) : (
            filteredProperties.map((property) => (
              <PropertyCard
                key={property.id}
                id={property.id}
                name={property.name}
                address={property.address}
                cityStateZip={property.cityStateZip || ''}
                docsCount={property.docs || 0}
                servicesCount={property.services || 0}
                checksCount={property.checks || 0}
                docGsURIs={property.docGsURIs || []}
              />
            ))
          )}
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
