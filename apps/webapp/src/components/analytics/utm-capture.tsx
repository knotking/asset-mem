'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { captureUtmFromSearchParams } from '@/lib/analytics';

/** Stores UTM query params in sessionStorage for GA event attribution. */
export function UtmCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const search = searchParams?.toString() ?? '';
    captureUtmFromSearchParams(search ? `?${search}` : window.location.search);
  }, [pathname, searchParams]);

  return null;
}
