import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { OPEN_MY_PROS_PARAM } from '@asset-mem/common/lib/my-pros-navigation';

/** Legacy route — opens property chat with the My pros drawer. */
export default function SavedProvidersRedirect() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    if (!id) return;
    router.replace({
      pathname: '/(tabs)/home/property-details',
      params: { id, tab: 'chat', [OPEN_MY_PROS_PARAM]: '1' },
    });
  }, [id, router]);

  return null;
}
