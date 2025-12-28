'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { PropertyCheckpointMetrics } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { useProperty } from '@/contexts/property-context';
import { db } from '@/lib/firebase';

export function usePropertyCheckpointMetrics() {
  const { user } = useAuth();
  const { property } = useProperty();

  const [metrics, setMetrics] = useState<PropertyCheckpointMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

