import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

/** Legacy route — redirects to property details Providers tab. */
export default function SavedProvidersRedirect() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    if (!id) return;
    router.replace({
      pathname: '/(tabs)/home/property-details',
      params: { id, tab: 'providers' },
    });
  }, [id, router]);

  return null;
}
