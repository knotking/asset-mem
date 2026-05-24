import { Platform } from 'react-native';

/** FlatList tuning for GiftedChat on mid-range Android devices. */
export const ANDROID_GIFTED_CHAT_LIST_VIEW_PROPS = {
  removeClippedSubviews: true,
  initialNumToRender: 12,
  maxToRenderPerBatch: 8,
  windowSize: 11,
  updateCellsBatchingPeriod: 50,
} as const;

export function giftedChatListViewPropsForPlatform(
  os: typeof Platform.OS = Platform.OS
): typeof ANDROID_GIFTED_CHAT_LIST_VIEW_PROPS | undefined {
  return os === 'android' ? ANDROID_GIFTED_CHAT_LIST_VIEW_PROPS : undefined;
}
