import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import YoutubePlayer from 'react-native-youtube-iframe';
import { getYouTubeVideoId, findChild } from './youtube-utils';

// Responsive YouTube Player Component
const ResponsiveYouTubePlayer = ({ videoId }: { videoId: string }) => {
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = (event: any) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  };

  const playerHeight = containerWidth > 0 ? (containerWidth * 9) / 16 : 200;

  return (
    <View style={{ width: '100%', marginVertical: 12 }} onLayout={handleLayout}>
      {containerWidth > 0 && <YoutubePlayer height={playerHeight} videoId={videoId} play={false} />}
    </View>
  );
};

// Helper to convert HSL to RGB for React Native
const hslToRgb = (h: number, s: number, l: number): string => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const r = Math.round(255 * f(0));
  const g = Math.round(255 * f(8));
  const b = Math.round(255 * f(4));
  return `rgb(${r}, ${g}, ${b})`;
};

// Color palette based on global.css
const colors = {
  light: {
    foreground: hslToRgb(0, 0, 3.9), // #0a0a0a
    mutedForeground: hslToRgb(0, 0, 45.1), // #737373
    primary: hslToRgb(0, 0, 9), // #171717
    secondary: hslToRgb(0, 0, 96.1), // #f5f5f5
    border: hslToRgb(0, 0, 89.8), // #e5e5e5
    accent: hslToRgb(0, 0, 96.1), // #f5f5f5
    destructive: hslToRgb(0, 84.2, 60.2), // #ef4444
  },
  dark: {
    foreground: hslToRgb(0, 0, 98), // #fafafa
    mutedForeground: hslToRgb(0, 0, 63.9), // #a3a3a3
    primary: hslToRgb(0, 0, 98), // #fafafa
    secondary: hslToRgb(0, 0, 14.9), // #262626
    border: hslToRgb(0, 0, 14.9), // #262626
    accent: hslToRgb(0, 0, 14.9), // #262626
    destructive: hslToRgb(0, 70.9, 59.4), // #ef4444
  },
};

export const useMarkdownStyles = (isUserMessage: boolean = false) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  // For user messages, use primary-foreground colors
  const textColor = isUserMessage
    ? isDark
      ? colors.dark.primary
      : colors.light.foreground
    : theme.foreground;

  return StyleSheet.create({
    body: {
      color: textColor,
      fontSize: 15,
      lineHeight: 22,
    },
    heading1: {
      color: textColor,
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 32,
      marginTop: 16,
      marginBottom: 8,
    },
    heading2: {
      color: textColor,
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 28,
      marginTop: 14,
      marginBottom: 6,
    },
    heading3: {
      color: textColor,
      fontSize: 18,
      fontWeight: '600',
      lineHeight: 24,
      marginTop: 12,
      marginBottom: 6,
    },
    heading4: {
      color: textColor,
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 22,
      marginTop: 10,
      marginBottom: 4,
    },
    heading5: {
      color: textColor,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      marginTop: 8,
      marginBottom: 4,
    },
    heading6: {
      color: textColor,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
      marginTop: 8,
      marginBottom: 4,
    },
    paragraph: {
      color: textColor,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 0,
      marginBottom: 12,
    },
    strong: {
      fontWeight: '700',
      color: textColor,
    },
    em: {
      fontStyle: 'italic',
      color: textColor,
    },
    s: {
      textDecorationLine: 'line-through',
      color: textColor,
    },
    code_inline: {
      backgroundColor: theme.accent,
      color: textColor,
      fontFamily: 'monospace',
      fontSize: 14,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    code_block: {
      backgroundColor: theme.accent,
      color: textColor,
      fontFamily: 'monospace',
      fontSize: 13,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    fence: {
      backgroundColor: theme.accent,
      color: textColor,
      fontFamily: 'monospace',
      fontSize: 13,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    blockquote: {
      backgroundColor: theme.secondary,
      borderLeftWidth: 4,
      borderLeftColor: theme.border,
      paddingLeft: 12,
      paddingRight: 12,
      paddingVertical: 8,
      marginVertical: 8,
      borderRadius: 4,
    },
    bullet_list: {
      marginVertical: 8,
    },
    ordered_list: {
      marginVertical: 8,
    },
    list_item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginVertical: 4,
    },
    bullet_list_icon: {
      marginLeft: 0,
      marginRight: 8,
      color: textColor,
      fontSize: 15,
      lineHeight: 22,
    },
    ordered_list_icon: {
      marginLeft: 0,
      marginRight: 8,
      color: textColor,
      fontSize: 15,
      lineHeight: 22,
    },
    hr: {
      backgroundColor: theme.border,
      height: 1,
      marginVertical: 16,
    },
    table: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      marginVertical: 8,
    },
    thead: {
      backgroundColor: theme.secondary,
    },
    th: {
      padding: 8,
      borderRightWidth: 1,
      borderRightColor: theme.border,
      fontWeight: '600',
      color: textColor,
    },
    tr: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    td: {
      padding: 8,
      borderRightWidth: 1,
      borderRightColor: theme.border,
      color: textColor,
    },
    link: {
      color: isDark ? '#60a5fa' : '#2563eb',
      textDecorationLine: 'underline',
    },
    image: {
      borderRadius: 8,
      marginVertical: 8,
    },
  });
};

// Custom rules for handling special markdown cases including YouTube embeds
export const markdownRules = {
  // Handle line breaks properly
  softbreak: () => '\n',

  // Handle hard breaks
  hardbreak: () => '\n\n',

  // Handle direct YouTube links
  link: (node: any, children: any, _parent: any, _styles: any) => {
    const href = node.attributes?.href;

    if (href) {
      const videoId = getYouTubeVideoId(href);

      // If it's a YouTube link and the link text is just the URL itself, embed the video
      // This catches cases where the link is not wrapped in a paragraph or list
      const linkText =
        typeof children === 'string'
          ? children
          : Array.isArray(children) && children.length === 1 && typeof children[0] === 'string'
            ? children[0]
            : '';

      const isStandaloneYouTubeLink =
        videoId &&
        (linkText === href || linkText.includes('youtube.com') || linkText.includes('youtu.be'));

      if (isStandaloneYouTubeLink) {
        return (
          <View key={node.key}>
            <ResponsiveYouTubePlayer videoId={videoId} />
          </View>
        );
      }
    }

    // Default link rendering - return null to use the default markdown renderer
    return null;
  },

  // Handle YouTube links in list items
  list_item: (node: any, children: any, _parent: any, styles: any) => {
    // Check if this list item contains a YouTube link
    const linkNode = findChild(node, (n: any) => n.type === 'link');

    if (linkNode && linkNode.attributes?.href) {
      const videoId = getYouTubeVideoId(linkNode.attributes.href);

      if (videoId) {
        return (
          <View key={node.key}>
            <ResponsiveYouTubePlayer videoId={videoId} />
          </View>
        );
      }
    }

    // Default list item rendering
    return (
      <View key={node.key} style={styles.list_item}>
        {children}
      </View>
    );
  },

  // Handle YouTube links in paragraphs
  paragraph: (node: any, children: any, _parent: any, styles: any) => {
    // Check if paragraph contains only a YouTube link
    const linkNode = findChild(node, (n: any) => n.type === 'link');

    if (linkNode && linkNode.attributes?.href) {
      const videoId = getYouTubeVideoId(linkNode.attributes.href);

      // Only embed if it's a standalone link (not mixed with other text)
      // Check if all non-link children are empty or whitespace
      const hasOnlyLink =
        node.children?.every((child: any) => {
          if (child.type === 'link') return true;
          if (typeof child === 'string') return child.trim() === '';
          if (child.type === 'text' && child.content) {
            return typeof child.content === 'string' && child.content.trim() === '';
          }
          return false;
        }) || false;

      if (videoId && hasOnlyLink) {
        return (
          <View key={node.key}>
            <ResponsiveYouTubePlayer videoId={videoId} />
          </View>
        );
      }
    }

    // Default paragraph rendering
    return (
      <View key={node.key} style={styles.paragraph}>
        {children}
      </View>
    );
  },
};
