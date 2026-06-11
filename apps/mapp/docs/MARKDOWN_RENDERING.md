# Markdown Rendering Implementation for Mobile App

## Overview
This document describes the implementation of rich text markdown rendering in the mobile app (mapp) chat messages, providing support for bold, italic, lists, code blocks, links, YouTube video embeds, and more.

## Architecture

### 1. Markdown Library

**Package:** `react-native-markdown-display` (^7.0.2)

This is the most popular and well-maintained markdown rendering library for React Native, providing:
- Full CommonMark spec support
- Custom styling capabilities
- Rule customization for special rendering
- Native rendering (no WebView)
- Proper text selection support

### 2. Markdown Styles Configuration (`apps/mapp/lib/markdown-styles.tsx`)

#### Color System

The styles are dynamically generated based on the app's color scheme (light/dark mode) using the HSL color values from [global.css](apps/mapp/global.css).

**Helper Function:**
```typescript
const hslToRgb = (h: number, s: number, l: number): string => {
  // Converts HSL color values to RGB for React Native StyleSheet
  // Returns: 'rgb(r, g, b)'
}
```

**Color Palettes:**
```typescript
colors = {
  light: {
    foreground: '#0a0a0a',
    mutedForeground: '#737373',
    primary: '#171717',
    secondary: '#f5f5f5',
    border: '#e5e5e5',
    // ...
  },
  dark: {
    foreground: '#fafafa',
    mutedForeground: '#a3a3a3',
    primary: '#fafafa',
    secondary: '#262626',
    border: '#262626',
    // ...
  }
}
```

#### Hook: `useMarkdownStyles(isUserMessage)`

Returns dynamically styled markdown configurations based on:
- Current color scheme (light/dark)
- Message type (user/assistant)

**Parameters:**
- `isUserMessage: boolean` - Whether the message is from the user (affects text color)

**Supported Markdown Elements:**

| Element | Styling |
|---------|---------|
| **Headings** | h1-h6 with appropriate sizes (24px → 13px) |
| **Paragraph** | 15px font, 22px line height |
| **Bold** | Font weight 700 |
| **Italic** | Font style italic |
| **Strikethrough** | Text decoration line-through |
| **Inline Code** | Monospace font, background color, padding, rounded |
| **Code Block** | Monospace font, background, border, padding |
| **Blockquote** | Left border, background, padding |
| **Lists** | Bullet and ordered with proper indentation |
| **Links** | Blue color with underline |
| **Tables** | Bordered with header styling |
| **Horizontal Rule** | 1px line with margin |
| **Images** | Rounded corners, margin |
| **YouTube Videos** | Embedded responsive player |

#### Custom Rules (`markdownRules`)

Special handling for:
- **Soft breaks** - Single newline
- **Hard breaks** - Double newline
- **YouTube links** - Automatically embedded as responsive video players
- **Paragraph links** - Standalone YouTube links in paragraphs are embedded
- **List item links** - YouTube links in list items are embedded

#### YouTube Video Embedding

The implementation includes a `ResponsiveYouTubePlayer` component that:
- Automatically detects YouTube links in markdown
- Embeds videos with responsive 16:9 aspect ratio
- Supports both `youtube.com` and `youtu.be` URLs
- Works in paragraphs, list items, and standalone links
- Uses `react-native-youtube-iframe` for native playback

### 3. ChatMessage Component Integration

The markdown rendering is integrated throughout the message flow:

#### A. MessageContent Component

The main `MessageContent` component resolves content via `@homeapp/common/lib/message-content-parts`.
Markdown is passed through `normalizeChatMarkdownSpacing` (collapses 3+ blank lines and tightens spacing around `---` rules) before render so replay prose like “Show full analysis” does not show large gaps between sections.

```typescript
import { resolveMessageContentParts } from '@homeapp/common/lib/message-content-parts';

const { markdown, contentJson } = resolveMessageContentParts(message);

// Structured responses (when contentJson has visible sections)
if (contentJson && structuredDataHasVisibleSections(contentJson)) {
  return <StructuredResponse data={contentJson} />;
}

// Markdown-only responses
return (
  <Markdown style={markdownStyles} rules={markdownRules}>
    {markdown}
  </Markdown>
);
```

#### B. StructuredResponse Sections

Markdown is used in accordion content sections within the `StructuredResponse` component:

- **Triage Summary** - Diagnosis information with markdown formatting
- **Coverage Analysis** - Warranty and insurance information
- **DIY Recommendations** - DIY summaries and instructions

```typescript
<AccordionContent className="border-t border-border bg-background p-4">
  <Markdown style={markdownStyles} rules={markdownRules}>
    {triage!.diagnosis!}
  </Markdown>
</AccordionContent>
```

#### C. Content Contract

Structured rendering no longer depends on parsing JSON/code fences from message text.

- Proxy persists `contentMarkdown` and `contentJson` separately
- UI reads these fields directly
- Legacy fenced JSON parsing is removed from hot-path rendering

## Supported Markdown Features

### Text Formatting

```markdown
**Bold text**
*Italic text*
~~Strikethrough text~~
```

### Headings

```markdown
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```

### Lists

```markdown
- Unordered item 1
- Unordered item 2
  - Nested item

1. Ordered item 1
2. Ordered item 2
   1. Nested ordered item
```

### Links

```markdown
[Link text](https://example.com)
```

Links are rendered with:
- Blue color (#2563eb light, #60a5fa dark)
- Underline text decoration
- Clickable (opens in browser)

### Code

**Inline code:**
```markdown
This is `inline code` in a sentence.
```

**Code blocks:**
````markdown
```
function example() {
  return "Hello, World!";
}
```
````

**Fenced code with language:**
````markdown
```javascript
const greeting = "Hello!";
console.log(greeting);
```
````

### Blockquotes

```markdown
> This is a blockquote
> It can span multiple lines
```

### Tables

```markdown
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
```

### Horizontal Rules

```markdown
---
***
___
```

### Images

```markdown
![Alt text](https://example.com/image.png)
```

Images are rendered with:
- Rounded corners (8px)
- Vertical margin
- Proper sizing

### YouTube Videos

YouTube videos are automatically embedded when you include YouTube links in your markdown:

**Standalone YouTube link:**
```markdown
https://www.youtube.com/watch?v=VIDEO_ID
```

**YouTube link in a list:**
```markdown
- https://www.youtube.com/watch?v=VIDEO_ID
- Another video: https://youtu.be/VIDEO_ID
```

**YouTube link in a paragraph (standalone):**
```markdown
Check out this tutorial:

https://www.youtube.com/watch?v=VIDEO_ID
```

Features:
- Automatically detects both `youtube.com/watch?v=` and `youtu.be/` formats
- Embeds as responsive 16:9 video player
- Works in paragraphs, lists, and standalone links
- Native playback using `react-native-youtube-iframe`
- Only standalone YouTube links are embedded (links with custom text remain as regular links)

## Usage Examples

### Basic Message

```typescript
// User message
<ChatMessage message={{
  role: 'user',
  content: 'How do I fix **water damage** in my basement?'
}} />

// Assistant message with formatting
<ChatMessage message={{
  role: 'assistant',
  content: `Here are the steps:

1. **Stop the water source**
2. *Remove standing water*
3. Dry the area completely

Visit [this guide](https://example.com) for more details.`
}} />
```

### Structured Response with Markdown

```typescript
<ChatMessage message={{
  role: 'assistant',
  content: '',
  contentMarkdown: 'Here are the steps:\n\n1. **Stop the water source**\n2. *Remove standing water*',
  contentJson: {
    analysis: {
      triageResult: {
        diagnosis: 'Your **insurance policy** covers water damage up to *$50,000*.'
      }
    }
  }
}} />
```

When `contentJson` has visible accordion sections, structured UI is shown; otherwise markdown prose is rendered.

### YouTube Video Embedding

```typescript
// Assistant message with YouTube video
<ChatMessage message={{
  role: 'assistant',
  content: `Here's a helpful tutorial on fixing water damage:

https://www.youtube.com/watch?v=dQw4w9WgXcQ

Follow these steps after watching the video:
1. Assess the damage
2. Remove standing water
3. Dry the area`
}} />
```

## Styling Customization

### Theme-Aware Styling

The markdown automatically adapts to:
- **Light mode** - Dark text on light backgrounds
- **Dark mode** - Light text on dark backgrounds
- **User messages** - Uses primary-foreground colors
- **Assistant messages** - Uses standard foreground colors

### Font Hierarchy

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 | 24px | 700 | 32px |
| H2 | 20px | 600 | 28px |
| H3 | 18px | 600 | 24px |
| H4 | 16px | 600 | 22px |
| H5 | 14px | 600 | 20px |
| H6 | 13px | 600 | 18px |
| Body | 15px | 400 | 22px |
| Code | 13-14px | 400 | mono |

### Spacing System

- **Headings**: Top margin 8-16px, bottom margin 4-8px
- **Paragraphs**: Bottom margin 12px
- **Code blocks**: Vertical margin 8px, padding 12px
- **Blockquotes**: Vertical margin 8px, padding 8-12px
- **Lists**: Vertical margin 8px, item margin 4px
- **Horizontal rules**: Vertical margin 16px

## Integration in Message Flow

```
Message arrives (Firestore)
      ↓
resolveMessageContentParts(message)
      ↓
contentJson has visible sections?
      ↓
  ┌───┴───┐
  ↓       ↓
 Yes      No
  ↓       ↓
StructuredResponse   Markdown
(accordion)          (contentMarkdown)
  ↓
Each section renders
fields with Markdown
where needed
```

## Performance Considerations

### Optimizations

1. **Style memoization**: `useMarkdownStyles` hook caches styles
2. **Native rendering**: No WebView overhead (except YouTube embeds which use native player)
3. **Selective parsing**: Only parses markdown when needed
4. **Lazy accordion**: Content only rendered when expanded
5. **Content extraction memoization**: `structuredDataHasVisibleSections` gates accordion rendering
6. **Responsive YouTube player**: Uses layout measurements for optimal sizing

### Text Selection

All markdown content maintains native text selection:
- Long-press to select
- Copy to clipboard
- Native selection handles

## Comparison: Before vs After

### Before (Plain Text)

```
**Bold** text
*Italic* text
[Link](https://example.com)
`code`
```

Displayed as: `**Bold** text *Italic* text [Link](https://example.com) `code``

### After (Markdown Rendered)

**Bold** text
*Italic* text
[Link](https://example.com)
`code`

## Browser Compatibility

The implementation works across:
- ✅ iOS (native rendering)
- ✅ Android (native rendering)
- ✅ Expo Go
- ✅ Development builds
- ✅ Production builds

## Known Limitations

### Not Supported (by library)

- [ ] **HTML tags** - Raw HTML is not rendered
- [ ] **Task lists** - `- [ ]` checkbox syntax
- [ ] **Footnotes** - `[^1]` reference style
- [ ] **Definition lists** - `term\n: definition`
- [ ] **Emoji shortcuts** - `:smile:` syntax (use actual emoji instead)

### Workarounds

**For HTML:**
Use markdown equivalents or plain text

**For task lists:**
Use regular lists with emoji:
```markdown
- ✅ Completed task
- ⬜ Pending task
```

**For emojis:**
Use actual emoji characters: 😊 👍 🏠

## Troubleshooting

### Markdown Not Rendering

**Problem:** Markdown syntax shows as plain text.

**Solution:**
1. Check that `react-native-markdown-display` is installed
2. Verify import: `import Markdown from 'react-native-markdown-display'`
3. Ensure styles are passed: `<Markdown style={markdownStyles}>`

### Links Not Clickable

**Problem:** Tapping links does nothing.

**Solution:**
Links in markdown are automatically clickable. If not working:
```typescript
// The library handles this automatically
// But ensure Linking is imported
import { Linking } from 'react-native';
```

### Code Blocks Not Styled

**Problem:** Code blocks appear as plain text without background.

**Solution:**
Check that code styles are defined in `markdown-styles.tsx`:
```typescript
code_block: {
  backgroundColor: theme.accent,
  fontFamily: 'monospace',
  // ...
}
```

### YouTube Videos Not Embedding

**Problem:** YouTube links show as regular links instead of embedded videos.

**Solution:**
1. Ensure `react-native-youtube-iframe` is installed
2. Check that the YouTube link is standalone (not wrapped with custom link text)
3. Verify the link format is valid (`youtube.com/watch?v=` or `youtu.be/`)
4. For links in paragraphs, ensure the link is the only content in the paragraph

### Dark Mode Colors Wrong

**Problem:** Text is hard to read in dark mode.

**Solution:**
The styles automatically adapt. Ensure `useColorScheme` is working:
```typescript
import { useColorScheme } from 'nativewind';
const { colorScheme } = useColorScheme();
```

## Files Created/Modified

### Created:
- [markdown-styles.tsx](apps/mapp/lib/markdown-styles.tsx) - Styles configuration, YouTube player component, and markdown rules
- [youtube-utils.ts](apps/mapp/lib/youtube-utils.ts) - YouTube video ID extraction utilities

### Modified:
- [ChatMessage.tsx](apps/mapp/components/ChatMessage.tsx) - Integrated Markdown component throughout
  - Line 42-43: Imports for Markdown and markdown styles
  - Line 450: useMarkdownStyles hook in StructuredResponse
  - Lines 582-584, 604-606, 614-616, 635-637: Markdown rendering in accordion sections
  - Line 991: useMarkdownStyles hook in MessageContent
  - Lines 1003-1010: Structured data rendering with StructuredResponse
  - Lines 1014-1017: Regular message rendering with Markdown
- [package.json](apps/mapp/package.json) - Added dependencies:
  - `react-native-markdown-display` (^7.0.2)
  - `react-native-youtube-iframe` (^2.4.1)

## Testing

### Test Cases

1. **Bold and Italic**
   ```markdown
   This is **bold** and this is *italic* text.
   ```

2. **Links**
   ```markdown
   Visit [our website](https://example.com) for more info.
   ```

3. **Code**
   ```markdown
   Use `console.log()` to debug your code.
   ```

4. **Lists**
   ```markdown
   Steps:
   1. First step
   2. Second step
   3. Third step
   ```

5. **Mixed Formatting**
   ```markdown
   ## Important Note

   You should **immediately** check your *insurance policy*. Here's a helpful [guide](https://example.com).

   Steps to follow:
   - Call `1-800-HELP`
   - Document everything
   - Contact adjuster
   ```

6. **YouTube Video Embedding**
   ```markdown
   Watch this tutorial:

   https://www.youtube.com/watch?v=dQw4w9WgXcQ

   Or check out this alternative:
   - https://youtu.be/VIDEO_ID
   ```

## Future Enhancements

- [ ] **Syntax highlighting** - Add language-specific code highlighting for code blocks
- [ ] **Custom link handler** - In-app navigation for certain URLs
- [ ] **Image optimization** - Lazy loading and caching for embedded images
- [ ] **Math rendering** - LaTeX/KaTeX support for mathematical equations
- [ ] **Mermaid diagrams** - Render diagrams from markdown code blocks
- [ ] **Copy code button** - Quick copy button for code blocks
- [ ] **Emoji picker** - Autocomplete for emoji shortcuts
- [ ] **Vimeo support** - Add support for Vimeo video embeds similar to YouTube
- [ ] **Video thumbnails** - Show thumbnails for YouTube videos before loading
- [ ] **Playlist support** - Support for YouTube playlist embeds

## Notes

- Markdown rendering is now enabled by default for all messages
- The implementation is theme-aware and adapts to light/dark mode
- Text selection works natively across all markdown content
- Performance is excellent - minimal WebView overhead (only for YouTube player)
- Styles match the app's design system perfectly using HSL to RGB conversion
- Links are automatically tappable and open in the system browser
- YouTube videos are automatically embedded when standalone links are detected
- The feature works identically across iOS and Android
- Content is read from persisted `contentMarkdown` / `contentJson` fields (Property Agent Architecture contract)
- Supports both nested (`analysis.*`) and flat structured data formats
