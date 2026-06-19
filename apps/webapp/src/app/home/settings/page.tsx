'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, ArrowLeft, BookOpen, Camera, CreditCard, LifeBuoy, LogOut, User } from 'lucide-react';
import { CheckpointSettings } from '@/components/settings/checkpoint-settings';
import { AiUsageSettings } from '@/components/settings/ai-usage-settings';
import { SubscriptionSettings } from '@/components/settings/subscription-settings';
import { ProfileSettings } from '@/components/settings/profile-settings';
import { AccountDeletionSettings } from '@/components/settings/account-deletion-settings';
import { LegalSettings } from '@/components/settings/legal-settings';
import { SupportSettings } from '@/components/settings/support-settings';
import { HelpHubSettings } from '@/components/feature-discovery/help-hub-settings';
import { useAuth } from '@/contexts/auth-context';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { isBillingCheckoutTier } from '@/lib/pending-checkout';
import { APP_PAGE_SUBTITLE_CLASS, APP_PAGE_TITLE_CLASS } from '@/lib/app-typography';
import {
  isSettingsHubReturn,
  resolveSettingsReturnContext,
  settingsBackAccessibilityLabel,
  settingsBackHref,
} from '@/lib/settings-navigation';

const SETTINGS_TABS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'billing', label: 'Plan & billing', icon: CreditCard },
  { id: 'usage', label: 'AI usage', icon: Activity },
  { id: 'checkpoints', label: 'Checkpoints', icon: Camera },
  { id: 'faq', label: 'FAQ', icon: BookOpen },
  { id: 'help', label: 'Help & support', icon: LifeBuoy },
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

function isSettingsTabId(value: string | null): value is SettingsTabId {
  return SETTINGS_TABS.some((t) => t.id === value);
}

function SettingsPageContent() {
  const { user, logout, signingOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const billingParam = searchParams.get('billing');
  const subscribeParam = searchParams.get('subscribe');
  const tabParam = searchParams.get('tab');
  const portalParam = searchParams.get('portal');
  const returnToParam = searchParams.get('returnTo');
  const returnPropertyIdParam = searchParams.get('returnPropertyId');
  const returnPropertyTabParam = searchParams.get('returnPropertyTab');
  const returnSessionIdParam = searchParams.get('returnSessionId');

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
    if (isSettingsTabId(tabParam)) {
      return tabParam;
    }
    if (portalParam === '1') {
      return 'billing';
    }
    return 'account';
  }, [billingParam, subscribeParam, tabParam, portalParam]);

  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [billingNotice, setBillingNotice] = useState<'canceled' | null>(null);
  const [resumePortalOpen, setResumePortalOpen] = useState(() => portalParam === '1');
  const [returnContext] = useState(() =>
    resolveSettingsReturnContext({
      returnTo: returnToParam,
      returnPropertyId: returnPropertyIdParam,
      returnPropertyTab: returnPropertyTabParam,
      returnSessionId: returnSessionIdParam,
    }),
  );

  const handleBack = () => {
    if (isSettingsHubReturn(returnContext)) {
      setActiveTab('account');
      router.replace('/home/settings');
      return;
    }
    router.push(settingsBackHref(returnContext));
  };

  useEffect(() => {
    if (billingParam === 'canceled') {
      setActiveTab('billing');
      setBillingNotice('canceled');
      // Drop ?billing= from the URL so browser Back does not replay Stripe return params.
      router.replace('/home/settings');
      return;
    }
    if (isSettingsTabId(tabParam)) {
      setActiveTab(tabParam);
      if (portalParam === '1') {
        setResumePortalOpen(true);
      }
      // Drop query params so browser Back does not replay mobile deep links.
      router.replace('/home/settings');
      return;
    }
    if (portalParam === '1') {
      setActiveTab('billing');
      setResumePortalOpen(true);
      router.replace('/home/settings');
    }
  }, [billingParam, tabParam, portalParam, router]);

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
            onClick={handleBack}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">{settingsBackAccessibilityLabel(returnContext)}</span>
          </Button>
          <h1 className={APP_PAGE_TITLE_CLASS}>Settings</h1>
        </div>
        <p className={cn(APP_PAGE_SUBTITLE_CLASS, 'pl-10')}>
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
            <ProfileSettings />
            <AccountDeletionSettings />
            <Button
              variant="outline"
              className="w-full justify-center gap-2 border-destructive bg-background text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={signingOut}
              onClick={() => void logout().then(() => router.push('/login'))}>
              <LogOut className="h-4 w-4 text-destructive" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </TabsContent>

          <TabsContent value="faq" className="mt-0 focus-visible:outline-none">
            <HelpHubSettings />
          </TabsContent>

          <TabsContent value="help" className="mt-0 space-y-4 focus-visible:outline-none">
            <SupportSettings />
            <LegalSettings />
          </TabsContent>

          <TabsContent value="billing" className="mt-0 focus-visible:outline-none">
            <SubscriptionSettings
              resumeCheckoutTier={
                isBillingCheckoutTier(subscribeParam) ? subscribeParam : null
              }
              resumePortalOpen={resumePortalOpen}
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
