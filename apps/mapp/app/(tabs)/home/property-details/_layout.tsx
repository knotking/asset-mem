import { PropertyProvider } from '@homeapp/common/contexts/property-context';
import { Stack, useLocalSearchParams } from 'expo-router';

export default function PropertyDetailsLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PropertyProvider propertyId={id}>
      <Stack />
    </PropertyProvider>
  );
}
