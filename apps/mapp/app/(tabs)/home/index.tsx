import { Text } from '@/components/ui/text';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import AddNewProperty from '@/components/AddNewProperty';
import AddPropertyModal from '@/components/AddPropertyModal';
import PropertyCard from '@/components/PropertyCard';
import PropertyListSkeleton from '@/components/PropertyListSkeleton';
import { HomeOnboardingChecklist } from '@/components/onboarding/HomeOnboardingChecklist';
import { DiscoveryChecklist } from '@/components/feature-discovery/DiscoveryChecklist';
import { usePropertiesList } from '@homeapp/common/contexts/properties-list-context';
import { usePreferences } from '@homeapp/common/contexts/preferences-context';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/ui/icon';
import { Search, X } from 'lucide-react-native';
import { useDocumentUpload } from '@homeapp/common/contexts/document-upload-context';
import { setPendingPropertyUpload } from '@/lib/pending-property-upload';

function normalizeRouteParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default function Screen() {
  const { properties, loading, error } = usePropertiesList();
  const { preferences, updatePreferences } = usePreferences();
  const { primeUploadingDocuments } = useDocumentUpload();
  const router = useRouter();
  const { openAddProperty } = useLocalSearchParams<{ openAddProperty?: string | string[] }>();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [addPropertyModalVisible, setAddPropertyModalVisible] = React.useState(false);

  React.useEffect(() => {
    if (normalizeRouteParam(openAddProperty) === '1') {
      setAddPropertyModalVisible(true);
      router.setParams({ openAddProperty: undefined } as Record<string, string | undefined>);
    }
  }, [openAddProperty, router]);

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

  const openAddPropertyModal = () => setAddPropertyModalVisible(true);

  const handleAddPropertySuccess = async (
    createdPropertyId: string,
    selectedFiles: { uri: string; name: string; mimeType?: string; size?: number }[]
  ) => {
    setAddPropertyModalVisible(false);
    if (!preferences?.onboardingPropertyId) {
      await updatePreferences({ onboardingPropertyId: createdPropertyId });
    }
    const assets = selectedFiles.map((file) => ({
      uri: file.uri,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
    }));
    primeUploadingDocuments(assets);
    setPendingPropertyUpload(createdPropertyId, assets);
    router.push({
      pathname: '/home/property-details',
      params: {
        id: createdPropertyId,
        new: 'true',
        tab: 'details',
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
            Build visual property checkpoints, compare condition over time, and chat with your
            documents to plan maintenance with confidence
          </Text>
        </View>

        <View className="px-4">
          <HomeOnboardingChecklist
            properties={properties}
            onAddProperty={openAddPropertyModal}
          />
          <DiscoveryChecklist properties={properties} />
        </View>

        {/* Search Bar */}
        <View className="mb-4 px-4">
          <View className="relative">
            <View className="absolute left-3 top-0 bottom-0 z-10 justify-center">
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
                className="absolute right-3 top-0 bottom-0 z-10 justify-center"
                onPress={() => setSearchTerm('')}
                accessibilityLabel="Clear search">
                <Icon as={X} size={18} className="text-muted-foreground" />
              </Pressable>
            )}
          </View>
        </View>
        <View className="mt-4 px-4">
          <AddNewProperty onPress={openAddPropertyModal} />
        </View>
        {/* Property Cards */}
        <View className="mt-4 px-4 pb-4">
          {filteredProperties.length === 0 && properties.length > 0 ? (
            <View className="items-center py-8">
              <Text className="text-muted-foreground">No properties match your search.</Text>
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

      <AddPropertyModal
        visible={addPropertyModalVisible}
        onClose={() => setAddPropertyModalVisible(false)}
        onSuccess={handleAddPropertySuccess}
      />
    </>
  );
}
