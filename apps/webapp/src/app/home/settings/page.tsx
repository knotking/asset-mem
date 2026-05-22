'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, ArrowLeft, Camera, CreditCard, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckpointSettings } from '@/components/settings/checkpoint-settings';
import { AiUsageSettings } from '@/components/settings/ai-usage-settings';
import { SubscriptionSettings } from '@/components/settings/subscription-settings';
import { SupportSettings } from '@/components/settings/support-settings';
import { useAuth } from '@/contexts/auth-context';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { isBillingCheckoutTier } from '@/lib/pending-checkout';

const SETTINGS_TABS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'billing', label: 'Plan & billing', icon: CreditCard },
  { id: 'usage', label: 'AI usage', icon: Activity },
  { id: 'checkpoints', label: 'Checkpoints', icon: Camera },
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

function isSettingsTabId(value: string | null): value is SettingsTabId {
  return SETTINGS_TABS.some((t) => t.id === value);
}

function SettingsPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const billingParam = searchParams.get('billing');
  const subscribeParam = searchParams.get('subscribe');

  const loginPath = useMemo(
    () =>
      isBillingCheckoutTier(subscribeParam) ? `/login?checkout=${subscribeParam}` : '/login',
    [subscribeParam]
  );
  const { authPending } = useRequireAuth(loginPath);
  const initialTab = useMemo((): SettingsTabId => {
    if (billingParam === 'canceled') {
      return 'billing';
    }
    if (isBillingCheckoutTier(subscribeParam)) {
      return 'billing';
    }
    return 'account';
  }, [billingParam, subscribeParam]);

  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [billingNotice, setBillingNotice] = useState<'canceled' | null>(null);

  useEffect(() => {
    if (billingParam === 'canceled') {
      setActiveTab('billing');
      setBillingNotice('canceled');
      // Drop ?billing= from the URL so browser Back does not replay Stripe return params.
      router.replace('/home/settings');
    }
  }, [billingParam, router]);

  const getUserInitials = () => {
    if (!user?.email) return 'NA';
    const parts = user.email.split('@')[0].split(/[._-]/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  if (authPending || !user) {
    return null;
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/home')}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to home</span>
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        </div>
        <p className="text-muted-foreground pl-10">
          Manage your account, subscription, usage, and preferences
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          if (isSettingsTabId(v)) setActiveTab(v);
        }}
        className="flex flex-col gap-6 lg:flex-row lg:items-start"
      >
        <TabsList
          className={cn(
            'flex h-auto w-full flex-row justify-start gap-1 overflow-x-auto p-1 lg:w-52 lg:shrink-0 lg:flex-col lg:items-stretch',
          )}
        >
          {SETTINGS_TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="justify-start gap-2 px-3 py-2 data-[state=active]:shadow-sm lg:w-full"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-w-0 flex-1 space-y-4">
          {billingNotice === 'canceled' && activeTab === 'billing' && (
            <div
              className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
              role="status"
            >
              Checkout was canceled. You can choose a plan anytime below.
            </div>
          )}

          <TabsContent value="account" className="mt-0 space-y-4 focus-visible:outline-none">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Your account information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-lg">{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-lg font-medium">
                      {user.displayName || 'Property Owner'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user.email || 'owner@assetmem.ai'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <SupportSettings />
          </TabsContent>

          <TabsContent value="billing" className="mt-0 focus-visible:outline-none">
            <SubscriptionSettings
              resumeCheckoutTier={
                isBillingCheckoutTier(subscribeParam) ? subscribeParam : null
              }
            />
          </TabsContent>

          <TabsContent value="usage" className="mt-0 focus-visible:outline-none">
            <AiUsageSettings />
          </TabsContent>

          <TabsContent value="checkpoints" className="mt-0 focus-visible:outline-none">
            <CheckpointSettings />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 p-4 md:p-8 pt-6">
          <p className="text-muted-foreground text-sm">Loading settings…</p>
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}
