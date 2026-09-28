import * as React from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@asset-mem/common/contexts/auth-context';
import { useProperty } from '@asset-mem/common/contexts/property-context';
import { useFirebase } from '@asset-mem/common/contexts/firebase-context';
import type { PropertyCheckpointMetrics } from '@asset-mem/common/types';

export function usePropertyCheckpointMetrics() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { property } = useProperty();

  const [metrics, setMetrics] = React.useState<PropertyCheckpointMetrics | null>(null);
  const [summaryExists, setSummaryExists] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user || !property) {
      setMetrics(null);
      setSummaryExists(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, `users/${user.uid}/properties/${property.id}/metrics/summary`);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setSummaryExists(snap.exists());
        setMetrics(snap.exists() ? (snap.data() as PropertyCheckpointMetrics) : null);
        setLoading(false);
      },
      () => {
        setSummaryExists(false);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db, user, property]);

  return { metrics, loading, summaryExists };
}
