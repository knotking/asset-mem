import { firebaseUidToAppAccountToken, getIosIapProductIds, tierForIosProductId } from '@/lib/ios-iap-products';

jest.mock('uuid', () => ({
  v5: (name: string) => `00000000-0000-5000-8000-${name.replace(/\W/g, '').slice(0, 12).padEnd(12, '0')}`,
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      iosIapProducts: {
        plus: 'com.assetmem.app.plus.monthly',
        pro: 'com.assetmem.app.pro.monthly',
      },
    },
  },
}));

describe('ios-iap-products', () => {
  it('returns configured product ids', () => {
    expect(getIosIapProductIds()).toEqual([
      'com.assetmem.app.plus.monthly',
      'com.assetmem.app.pro.monthly',
    ]);
  });

  it('maps product id to tier', () => {
    expect(tierForIosProductId('com.assetmem.app.plus.monthly')).toBe('plus');
    expect(tierForIosProductId('com.assetmem.app.pro.monthly')).toBe('pro');
    expect(tierForIosProductId('unknown')).toBeNull();
  });

  it('derives stable app account token', () => {
    const a = firebaseUidToAppAccountToken('firebase-uid-123');
    const b = firebaseUidToAppAccountToken('firebase-uid-123');
    expect(a).toBe(b);
    expect(a).not.toBe(firebaseUidToAppAccountToken('other-uid'));
  });
});
