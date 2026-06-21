import { Platform } from 'react-native';

/** React Navigation UIKit default tab bar band (`TABBAR_HEIGHT_UIKIT`). */
export const TAB_BAR_UIKIT_HEIGHT = 49;

/** Shared top padding in `app/(tabs)/_layout.tsx` tabBarStyle. */
export const TAB_BAR_PADDING_TOP = 8;

/** iOS padding below tab labels (home-indicator breathing room). */
export const TAB_BAR_PADDING_BOTTOM_IOS = 20;

/** Extra gap above the Android nav bar when overriding default inset padding. */
export const ANDROID_TAB_BAR_INSET_EXTRA = 6;

/**
 * When edge-to-edge safe-area bottom is 0, assume classic 3-button nav height so
 * tab labels clear system buttons.
 */
const ANDROID_NAV_BAR_FALLBACK_INSET = 48;

function resolveAndroidBottomInset(bottomInset: number): number {
  if (bottomInset >= 16) {
    return bottomInset;
  }
  return ANDROID_NAV_BAR_FALLBACK_INSET;
}

/**
 * Tab bar style for `app/(tabs)/_layout.tsx`.
 *
 * Android sets explicit `height` so icon/label content stays above the system
 * nav bar. RN's default height (UIKit 49 + inset) does not include our extra
 * vertical padding, which caused labels to overlap 3-button navigation.
 */
export function tabBarStylePadding(bottomInset: number): {
  paddingTop: number;
  paddingBottom: number;
  height?: number;
} {
  if (Platform.OS === 'android') {
    const navInset = resolveAndroidBottomInset(bottomInset);
    const paddingTop = TAB_BAR_PADDING_TOP;
    const paddingBottom = navInset + ANDROID_TAB_BAR_INSET_EXTRA;
    return {
      paddingTop,
      paddingBottom,
      height: TAB_BAR_UIKIT_HEIGHT + paddingTop + paddingBottom,
    };
  }
  return {
    paddingTop: TAB_BAR_PADDING_TOP,
    paddingBottom: TAB_BAR_PADDING_BOTTOM_IOS,
  };
}

/** Total tab bar height for keyboard offsets and layout math. */
export function tabBarHeight(bottomInset: number): number {
  if (Platform.OS === 'android') {
    const navInset = resolveAndroidBottomInset(bottomInset);
    return (
      TAB_BAR_UIKIT_HEIGHT + TAB_BAR_PADDING_TOP + navInset + ANDROID_TAB_BAR_INSET_EXTRA
    );
  }
  return TAB_BAR_UIKIT_HEIGHT + TAB_BAR_PADDING_BOTTOM_IOS;
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
  return -tabBarHeight(bottomInset);
}

/** Composer toolbar gap above the tab bar. */
export function composerToolbarBottomPadding(): number {
  return Platform.OS === 'ios' ? 6 : 8;
}
