
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';

function RootPageSkeleton() {
  return (
    <div className="flex flex-col h-screen w-full">
      {/* Header Skeleton */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
         <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-6 w-36" />
         </div>
        <div className="flex items-center gap-2">
            <Skeleton className='h-9 w-24' />
        </div>
      </div>
      {/* Main Content Skeleton */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <header className="mb-8">
              <Skeleton className="h-8 w-1/3 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <Skeleton className="h-56 w-full rounded-lg" />
              <Skeleton className="h-56 w-full rounded-lg" />
              <Skeleton className="h-56 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/home');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return <RootPageSkeleton />;
}
