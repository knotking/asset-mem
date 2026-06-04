import { PropertyProvider } from '@homeapp/common/contexts/property-context';
import { SavedServiceProvidersProvider } from '@homeapp/common/contexts/saved-service-providers-context';
import { Stack, useLocalSearchParams } from 'expo-router';

function normalizeRouteParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default function PropertyDetailsLayout() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const propertyId = normalizeRouteParam(id);
  return (
    <PropertyProvider propertyId={propertyId}>
      <SavedServiceProvidersProvider propertyId={propertyId}>
        <Stack />
      </SavedServiceProvidersProvider>
    </PropertyProvider>
  );
}
