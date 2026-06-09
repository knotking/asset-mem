'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PropertyReport } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { useProperty } from '@/contexts/property-context';

type ReportsContextValue = {
  reports: PropertyReport[];
  loading: boolean;
};

const ReportsContext = createContext<ReportsContextValue | null>(null);

function mapReportDoc(id: string, data: Record<string, unknown>): PropertyReport {
  return {
    id,
    ...(data as Omit<PropertyReport, 'id'>),
  };
}

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { property } = useProperty();
  const [reports, setReports] = useState<PropertyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !property?.id) {
      setReports([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = collection(
      db,
      `users/${user.uid}/properties/${property.id}/reports`
    );
    const q = query(ref, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setReports(
          snap.docs.map((d) => mapReportDoc(d.id, d.data() as Record<string, unknown>))
        );
        setLoading(false);
      },
      () => {
        setReports([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, property?.id]);

  const value = useMemo(() => ({ reports, loading }), [reports, loading]);

  return (
    <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
  );
}

export function useReports() {
  const ctx = useContext(ReportsContext);
  if (!ctx) {
    throw new Error('useReports must be used within ReportsProvider');
  }
  return ctx;
}

export function formatReportDateRange(
  start?: string,
  end?: string
): string {
  if (!start && !end) return '—';
  if (start === end || !end) return start ?? end ?? '—';
  return `${start} — ${end}`;
}

export function reportStatusLabel(status: PropertyReport['status']): string {
  switch (status) {
    case 'generating':
      return 'Generating…';
    case 'ready':
      return 'Ready';
    case 'failed':
      return 'Failed';
    case 'draft':
      return 'Draft';
    default:
      return status;
  }
}
