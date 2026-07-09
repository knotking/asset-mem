import { Platform } from 'react-native';
import {
  endConnection,
  finishTransaction,
  getAvailablePurchases,
  getSubscriptions,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestSubscription,
  setup,
  type Purchase,
  type Subscription,
} from 'react-native-iap';
import { verifyIosTransaction, restoreIosTransactions } from '@/lib/billing-api';
import {
  firebaseUidToAppAccountToken,
  getIosIapProductIds,
  isIosIapRuntimeAvailable,
  tierForIosProductId,
} from '@/lib/ios-iap-products';
import { createLogger } from '@/lib/logger';

const log = createLogger('ios-iap');

let connectionReady = false;
let listenersAttached = false;

export type IosPurchaseCallbacks = {
  onPurchaseVerified?: (productId: string) => void;
  onPurchaseError?: (message: string) => void;
};

let purchaseCallbacks: IosPurchaseCallbacks = {};

export function isIosIapSupported(): boolean {
  return isIosIapRuntimeAvailable();
}

export async function ensureIosIapConnection(): Promise<boolean> {
  if (!isIosIapSupported()) return false;
  if (connectionReady) return true;
  setup({ storekitMode: 'STOREKIT_HYBRID_MODE' });
  const ok = await initConnection();
  connectionReady = ok;
  if (!listenersAttached) {
    purchaseUpdatedListener(handlePurchaseUpdated);
    purchaseErrorListener((error) => {
      const message = error?.message ?? 'Purchase failed';
      log.warn('purchaseError', { message });
      purchaseCallbacks.onPurchaseError?.(message);
    });
    listenersAttached = true;
  }
  return ok;
}

export async function disconnectIosIap(): Promise<void> {
  if (!connectionReady) return;
  await endConnection();
  connectionReady = false;
}

export async function fetchIosSubscriptions(): Promise<Subscription[]> {
  if (!(await ensureIosIapConnection())) return [];
  const skus = getIosIapProductIds();
  try {
    return await getSubscriptions({ skus });
  } catch (e) {
    log.warn('fetchIosSubscriptions.failed', {
      cause: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

function transactionIdFromPurchase(purchase: Purchase): string | null {
  const id = purchase.transactionId;
  if (id) return String(id);
  return null;
}

async function handlePurchaseUpdated(purchase: Purchase): Promise<void> {
  const txId = transactionIdFromPurchase(purchase);
  if (!txId) {
    log.warn('purchaseUpdated.missingTransactionId', { productId: purchase.productId });
    purchaseCallbacks.onPurchaseError?.('Purchase completed but no transaction id was returned.');
    return;
  }
  try {
    await verifyIosTransaction(txId);
    await finishTransaction({ purchase, isConsumable: false });
    purchaseCallbacks.onPurchaseVerified?.(purchase.productId);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not verify purchase';
    log.warn('purchaseUpdated.verifyFailed', { txId, message });
    purchaseCallbacks.onPurchaseError?.(message);
  }
}

export async function purchaseIosSubscription(
  productId: string,
  firebaseUid: string,
  callbacks: IosPurchaseCallbacks = {},
): Promise<void> {
  purchaseCallbacks = callbacks;
  if (!(await ensureIosIapConnection())) {
    throw new Error('In-app purchases are not available on this device.');
  }
  const tier = tierForIosProductId(productId);
  if (!tier) {
    throw new Error('Unknown subscription product.');
  }
  await requestSubscription({
    sku: productId,
    andDangerouslyFinishTransactionAutomaticallyIOS: false,
    appAccountToken: firebaseUidToAppAccountToken(firebaseUid),
  });
}

export async function restoreIosPurchases(callbacks: IosPurchaseCallbacks = {}): Promise<void> {
  purchaseCallbacks = callbacks;
  if (!(await ensureIosIapConnection())) {
    throw new Error('In-app purchases are not available on this device.');
  }
  const purchases = await getAvailablePurchases({ onlyIncludeActiveItems: true });
  const txIds = purchases
    .map(transactionIdFromPurchase)
    .filter((id): id is string => Boolean(id));
  if (txIds.length === 0) {
    throw new Error('No active subscriptions found for this Apple ID.');
  }
  await restoreIosTransactions(txIds);
  await Promise.all(
    purchases.map((purchase) => finishTransaction({ purchase, isConsumable: false }).catch(() => undefined)),
  );
  const productId = purchases[0]?.productId;
  if (productId) {
    callbacks.onPurchaseVerified?.(productId);
  }
}

export function subscriptionLocalizedPrice(
  subscriptions: Subscription[],
  productId: string,
): string | null {
  const sub = subscriptions.find((s) => s.productId === productId);
  if (!sub) return null;
  return sub.localizedPrice ?? sub.displayPrice ?? sub.price ?? null;
}
