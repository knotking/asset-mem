import { Platform } from 'react-native';

/** Keep in sync with `app/(tabs)/_layout.tsx` tabBarStyle. */
export const TAB_BAR_PADDING_TOP = 10;
export const TAB_BAR_PADDING_BOTTOM = 20;
export const TAB_BAR_CONTENT_HEIGHT = 60;

/** Tab bar height on iOS (home indicator lives inside tab bar padding). */
export const TAB_BAR_BASE_HEIGHT =
  TAB_BAR_PADDING_TOP + TAB_BAR_CONTENT_HEIGHT + TAB_BAR_PADDING_BOTTOM;

export function tabBarHeight(bottomInset: number): number {
  return TAB_BAR_BASE_HEIGHT + (Platform.OS === 'android' ? bottomInset : 0);
}

/**
 * GiftedChat `bottomOffset` — applied only while the keyboard is open.
 *
 * translateY = keyboardHeight - bottomOffset, so a negative value moves the
 * composer up *less*, docking it on the keyboard instead of leaving tab-bar
 * height as a gap. Resting spacing (keyboard closed) uses composer toolbar
 * padding, not this value.
 */
export function giftedChatBottomOffset(bottomInset: number): number {
  if (Platform.OS === 'ios') {
    return -TAB_BAR_BASE_HEIGHT;
  }
  return -(TAB_BAR_BASE_HEIGHT + bottomInset);
}

/** Composer toolbar gap above the tab bar. */
export function composerToolbarBottomPadding(): number {
  return Platform.OS === 'ios' ? 6 : 8;
}
