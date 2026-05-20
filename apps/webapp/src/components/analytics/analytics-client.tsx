'use client';

import { Suspense } from 'react';
import { UtmCapture } from '@/components/analytics/utm-capture';

export function AnalyticsClient() {
  return (
    <Suspense fallback={null}>
      <UtmCapture />
    </Suspense>
  );
}
