import * as React from 'react';
import { Platform } from 'react-native';
import type { Subscription } from 'react-native-iap';
import {
  disconnectIosIap,
  fetchIosSubscriptions,
  isIosIapSupported,
  purchaseIosSubscription,
  restoreIosPurchases,
  subscriptionLocalizedPrice,
} from '@/lib/ios-iap';
import { getIosIapProducts, tierForIosProductId } from '@/lib/ios-iap-products';
import type { PlanTierKey } from '@/lib/plan-limits';

export type UseIosSubscriptionsResult = {
  supported: boolean;
  loading: boolean;
  subscriptions: Subscription[];
  busy: 'purchase' | 'restore' | null;
  error: string | null;
  priceForTier: (tier: Exclude<PlanTierKey, 'free'>) => string | null;
  purchaseTier: (tier: Exclude<PlanTierKey, 'free'>, firebaseUid: string) => Promise<void>;
  restore: () => Promise<void>;
  clearError: () => void;
};

export function useIosSubscriptions(): UseIosSubscriptionsResult {
  const supported = isIosIapSupported();
  const [loading, setLoading] = React.useState(supported);
  const [subscriptions, setSubscriptions] = React.useState<Subscription[]>([]);
  const [busy, setBusy] = React.useState<'purchase' | 'restore' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!supported) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const items = await fetchIosSubscriptions();
        if (!cancelled) setSubscriptions(items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (Platform.OS === 'ios') {
        void disconnectIosIap();
      }
    };
  }, [supported]);

  const priceForTier = React.useCallback(
    (tier: Exclude<PlanTierKey, 'free'>) => {
      const products = getIosIapProducts();
      return subscriptionLocalizedPrice(subscriptions, products[tier]);
    },
    [subscriptions],
  );

  const purchaseTier = React.useCallback(
    async (tier: Exclude<PlanTierKey, 'free'>, firebaseUid: string) => {
      setError(null);
      setBusy('purchase');
      const products = getIosIapProducts();
      try {
        await purchaseIosSubscription(products[tier], firebaseUid, {
          onPurchaseVerified: () => setBusy(null),
          onPurchaseError: (message) => {
            setError(message);
            setBusy(null);
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Purchase failed');
        setBusy(null);
      }
    },
    [],
  );

  const restore = React.useCallback(async () => {
    setError(null);
    setBusy('restore');
    try {
      await restoreIosPurchases({
        onPurchaseVerified: () => setBusy(null),
        onPurchaseError: (message) => {
          setError(message);
          setBusy(null);
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed');
      setBusy(null);
    }
  }, []);

  return {
    supported,
    loading,
    subscriptions,
    busy,
    error,
    priceForTier,
    purchaseTier,
    restore,
    clearError: () => setError(null),
  };
}

export function productIdForTier(tier: Exclude<PlanTierKey, 'free'>): string {
  return getIosIapProducts()[tier];
}

export { tierForIosProductId };
