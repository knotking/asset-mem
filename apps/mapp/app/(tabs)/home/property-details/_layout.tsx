import { PropertyProvider } from '@homeapp/common/contexts/property-context';
import { SavedServiceProvidersProvider } from '@homeapp/common/contexts/saved-service-providers-context';
import { Stack, useLocalSearchParams } from 'expo-router';

export default function PropertyDetailsLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PropertyProvider propertyId={id}>
      <SavedServiceProvidersProvider propertyId={id}>
        <Stack />
      </SavedServiceProvidersProvider>
    </PropertyProvider>
  );
}
