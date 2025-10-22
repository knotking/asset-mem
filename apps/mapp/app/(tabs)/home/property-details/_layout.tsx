import { DocumentProvider } from '@/contexts/DocumentContext';
import { Stack, useLocalSearchParams } from 'expo-router';

export default function PropertyDetailsLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <DocumentProvider propertyId={id}>
      <Stack />
    </DocumentProvider>
  );
}
