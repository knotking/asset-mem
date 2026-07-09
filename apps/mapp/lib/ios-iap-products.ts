import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getExpoExtra } from '@/lib/expo-extra';
import type { PlanTierKey } from '@/lib/plan-limits';
import { v5 as uuidv5 } from 'uuid';

/** Must match gcp/proxy/api/services/apple_billing_service.py namespace. */
const APP_ACCOUNT_TOKEN_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const DEFAULT_IOS_IAP_PRODUCTS: Record<Exclude<PlanTierKey, 'free'>, string> = {
  plus: 'com.assetmem.app.plus.monthly',
  pro: 'com.assetmem.app.pro.monthly',
};

export type IosIapProductMap = Record<Exclude<PlanTierKey, 'free'>, string>;

export function getIosIapProducts(): IosIapProductMap {
  const extra = getExpoExtra();
  const raw = extra.iosIapProducts;
  if (raw && typeof raw === 'object') {
    const map = raw as Record<string, unknown>;
    const plus = String(map.plus ?? '').trim();
    const pro = String(map.pro ?? '').trim();
    if (plus && pro) {
      return { plus, pro };
    }
  }
  return { ...DEFAULT_IOS_IAP_PRODUCTS };
}

export function getIosIapProductIds(): string[] {
  const products = getIosIapProducts();
  return [products.plus, products.pro];
}

/** True in Expo Go client (no custom native modules like react-native-iap). */
export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/** iOS + product IDs + native build (not Expo Go). */
export function isIosIapRuntimeAvailable(): boolean {
  return Platform.OS === 'ios' && getIosIapProductIds().length > 0 && !isExpoGo();
}

export function tierForIosProductId(productId: string): Exclude<PlanTierKey, 'free'> | null {
  const products = getIosIapProducts();
  if (productId === products.plus) return 'plus';
  if (productId === products.pro) return 'pro';
  return null;
}

/** StoreKit appAccountToken (UUID) derived from Firebase UID — matches proxy validation. */
export function firebaseUidToAppAccountToken(uid: string): string {
  return uuidv5(uid.trim(), APP_ACCOUNT_TOKEN_NAMESPACE);
}

export const IOS_SUBSCRIPTION_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';

export const IOS_BILLING_TERMS_URL = 'https://asset-mem.com/terms';
export const IOS_BILLING_PRIVACY_URL = 'https://asset-mem.com/privacy';
