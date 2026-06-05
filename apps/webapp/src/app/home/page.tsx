
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/hooks/use-require-auth';
import type { Property } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { AddPropertyCard } from '@/components/properties/add-property-card';
import { PropertyCard } from '@/components/properties/property-card';
import { SessionProvider } from '@/contexts/session-context';
import { usePropertiesDashboard } from '@/contexts/properties-dashboard-context';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { HomeOnboardingChecklist } from '@/components/onboarding/home-onboarding-checklist';
import { DiscoveryChecklist } from '@/components/feature-discovery/discovery-checklist';
import { ProductHuntWelcomeBanner } from '@/components/onboarding/product-hunt-welcome-banner';

function PropertiesDashboardSkeleton() {
  return (
    <div className="p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <Skeleton className="h-8 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <Skeleton className="h-56 w-full rounded-lg bg-primary/20" />
          <Skeleton className="h-56 w-full rounded-lg bg-primary/20" />
          <Skeleton className="h-56 w-full rounded-lg bg-primary/20" />
        </div>
      </div>
    </div>
  );
}

function BillingSuccessNotice() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get('billing') !== 'success') {
      return;
    }
    setVisible(true);
    router.replace('/home');
  }, [searchParams, router]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-200"
      role="status"
    >
      Subscription updated. Your plan limits may take a moment to apply after Stripe
      confirms payment. Manage your plan in{' '}
      <button
        type="button"
        className="font-medium underline underline-offset-2 hover:no-underline"
        onClick={() => router.push('/home/settings')}
      >
        Settings
      </button>
      .
    </div>
  );
}

function PropertiesDashboardContent() {
  const { user, authPending } = useRequireAuth();
  const { properties, loading: isPropertiesLoading } = usePropertiesDashboard();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProperties = useMemo(() => {
    if (!searchTerm.trim()) {
      return properties;
    }
    const normalizedTerm = searchTerm.trim().toLowerCase();
    return properties.filter(
      (property) =>
        property.name?.toLowerCase().includes(normalizedTerm) ||
        property.address?.toLowerCase().includes(normalizedTerm) ||
        property.cityStateZip?.toLowerCase().includes(normalizedTerm)
    );
  }, [properties, searchTerm]);

  if (authPending || !user) {
    return <PropertiesDashboardSkeleton />;
  }

  if (isPropertiesLoading && properties.length === 0) {
    return <PropertiesDashboardSkeleton />;
  }

  return (
    <div className="p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Property AI Agent</h1>
          <p className="text-muted-foreground">
            Upload property documents and chat with AI to get insights or diagnostics of your
            properties and assets
          </p>
        </header>

        <Suspense fallback={null}>
          <BillingSuccessNotice />
        </Suspense>

        <ProductHuntWelcomeBanner />
        <HomeOnboardingChecklist properties={properties} />
        <DiscoveryChecklist properties={properties} />

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search properties..."
              className="pl-10 pr-10"
              aria-label="Search properties by name or address"
            />
            {searchTerm.length > 0 && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AddPropertyCard />
          {filteredProperties.length === 0 && properties.length > 0 ? (
            <div className="col-span-full py-8 text-center text-muted-foreground">
              No properties match your search.
            </div>
          ) : filteredProperties.length === 0 && properties.length === 0 ? null : (
            filteredProperties.map((prop: Property) => (
              <PropertyCard key={prop.id} property={prop} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function PropertiesDashboardPage() {
  return (
    <SessionProvider>
      <PropertiesDashboardContent />
    </SessionProvider>
  );
}
