'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OPEN_MY_PROS_PARAM } from '@/lib/my-pros-navigation';

/** Legacy route — redirects to Details and opens the My pros sheet. */
export default function PropertyProvidersRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.propertyId as string;

  useEffect(() => {
    if (!propertyId) return;
    router.replace(`/home/properties/${propertyId}/details?${OPEN_MY_PROS_PARAM}=1`);
  }, [propertyId, router]);

  return null;
}
