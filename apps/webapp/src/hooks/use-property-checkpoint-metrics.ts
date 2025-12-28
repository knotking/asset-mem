import * as React from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { useProperty } from '@/contexts/property-context';
import { db } from '@/lib/firebase';
import type { PropertyCheckpointMetrics } from '@homeapp/common/types';

export function usePropertyCheckpointMetrics() {
  const { user } = useAuth();
  const { property } = useProperty();

  const [metrics, setMetrics] = React.useState<PropertyCheckpointMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user || !property) {
      setMetrics(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, `users/${user.uid}/properties/${property.id}/metrics/summary`);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setMetrics((snap.data() as PropertyCheckpointMetrics) || null);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [user, property]);

  return { metrics, loading };
}

