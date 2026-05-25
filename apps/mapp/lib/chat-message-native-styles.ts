import { StyleSheet, type ColorSchemeName } from 'react-native';
import { getAppThemeColors } from '@/lib/css-theme-tokens';

/**
 * StyleSheet replacements for NativeWind classes that trigger css-interop races
 * with Expo Router (e.g. shadow-sm, bg-color opacity shorthands). See nativewind#1537.
 */
export function createChatMessageNativeStyles(scheme: ColorSchemeName | null | undefined) {
  const isDark = scheme === 'dark';
  const colors = getAppThemeColors(isDark);

  return StyleSheet.create({
    typingBubble: {
      minHeight: 48,
      justifyContent: 'center',
    },
    userBubble: {
      overflow: 'hidden',
      borderRadius: 8,
      backgroundColor: colors.muted,
    },
    assistantBubble: {
      overflow: 'hidden',
      borderRadius: 8,
    },
    assistantBubbleThinking: {
      backgroundColor: 'transparent',
    },
    assistantBubbleFilled: {
      backgroundColor: colors.secondary,
    },
    bubbleFullWidth: {
      width: '100%',
    },
    contextMenuOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    contextMenuPanel: {
      width: 256,
      overflow: 'hidden',
      borderRadius: 8,
      backgroundColor: colors.background,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.35 : 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
    structuredTitleCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted40,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    structuredSectionCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted40,
      padding: 12,
      gap: 8,
    },
    productSkeletonOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: 10,
      flexDirection: 'column',
      gap: 8,
      backgroundColor: colors.muted30,
      padding: 8,
    },
    authorizedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 9999,
      backgroundColor: colors.info10,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    diyCostCallout: {
      marginBottom: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.diyCostBorder,
      backgroundColor: colors.diyCostBackground,
      padding: 12,
    },
  });
}
