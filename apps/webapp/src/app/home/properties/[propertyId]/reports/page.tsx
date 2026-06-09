'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Legacy route — reports live under Timeline → Reports. */
export default function PropertyReportsRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.propertyId as string;

  useEffect(() => {
    router.replace(`/home/properties/${propertyId}/checkpoints?tab=reports`);
  }, [router, propertyId]);

  return null;
}
