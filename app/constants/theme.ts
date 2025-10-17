/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

export const Colors = {
  light: {
    text: "#11181C",
    background: "#fff",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
    border: "#c4c4c4",
    cardBackground: "#fff",
    cardBorder: "#ccc",
    cardShadow: "#000",
    navBarBackground: "#fff",
    navBarBorder: "#eee",
    inactiveText: "#888",
    inputBorder: "#ccc",
    inputBackground: "#fff",
    inputText: "#000",
    separator: "#eee",
    placeholderText: "#666",
    profileBackground: "#e0e0e0",
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
    border: "#3c3c3c",
    cardBackground: "#151718",
    cardBorder: "#3c3c3c",
    cardShadow: "#000",
    navBarBackground: "#151718",
    navBarBorder: "#3c3c3c",
    inactiveText: "#9BA1A6",
    inputBorder: "#3c3c3c",
    inputBackground: "#151718",
    inputText: "#ECEDEE",
    separator: "#3c3c3c",
    placeholderText: "#9BA1A6",
    profileBackground: "#151718",
  },
  common: {
    white: "#fff",
    black: "#000",
    blue: "#007AFF",
    darkBlue: "#0056b3",
    green: "#4CAF50",
    purple: "#9C27B0",
    googleBlue: "#4285F4",
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
