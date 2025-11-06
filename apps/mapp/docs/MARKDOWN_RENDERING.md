# Markdown Rendering Implementation for Mobile App

## Overview
This document describes the implementation of rich text markdown rendering in the mobile app (mapp) chat messages, providing support for bold, italic, lists, code blocks, links, and more.

## Architecture

### 1. Markdown Library

**Package:** `react-native-markdown-display` (v7.0.2)

This is the most popular and well-maintained markdown rendering library for React Native, providing:
- Full CommonMark spec support
- Custom styling capabilities
- Rule customization for special rendering
- Native rendering (no WebView)
- Proper text selection support

### 2. Markdown Styles Configuration (`apps/mapp/lib/markdown-styles.ts`)

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

#### Custom Rules (`markdownRules`)

Special handling for:
- **Soft breaks** - Single newline
- **Hard breaks** - Double newline

### 3. ChatMessage Component Integration

The markdown rendering is integrated in three places:

#### A. MessageContent Component (lines 204-251)

```typescript
const MessageContent = ({ content, isUser }) => {
  const markdownStyles = useMarkdownStyles(isUser);

  // For structured responses with JSON
  if (structuredData) {
    return (
      <View>
        {plainContent && (
          <Markdown style={markdownStyles} rules={markdownRules}>
            {plainContent}
          </Markdown>
        )}
        <StructuredResponse data={structuredData} />
      </View>
    );
  }

  // For regular messages
  return (
    <Markdown style={markdownStyles} rules={markdownRules}>
      {content}
    </Markdown>
  );
};
```

#### B. StructuredResponse Sections (lines 117-185)

Markdown is used in accordion content sections:
- **Summary** section
- **Coverage** section
- **DIY Solutions** section (both Google and YouTube)

```typescript
<AccordionContent>
  <Markdown style={markdownStyles} rules={markdownRules}>
    {data.researchResults!.summaryOfFindings!}
  </Markdown>
</AccordionContent>
```

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
const content = `**Structured Data**: \`\`\`json
{
  "researchResults": {
    "summaryOfFindings": "Your **insurance policy** covers water damage up to *$50,000*. Here's what you need to know:\n\n- Deductible: $500\n- Coverage: Flood and pipe damage\n- Claim process: [File online](https://example.com)"
  }
}
\`\`\``;

<ChatMessage message={{ role: 'assistant', content }} />
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
Message arrives
      ↓
MessageContent component
      ↓
Check for JSON structure?
      ↓
  ┌───┴───┐
  ↓       ↓
 Yes      No
  ↓       ↓
Parse   Render
JSON    Markdown
  ↓       ↓
Plain   Display
text?   styled
  ↓       content
Render
Markdown
  ↓
Display structured
accordion sections
  ↓
Each section
renders content
with Markdown
```

## Performance Considerations

### Optimizations

1. **Style memoization**: `useMarkdownStyles` hook caches styles
2. **Native rendering**: No WebView overhead
3. **Selective parsing**: Only parses markdown when needed
4. **Lazy accordion**: Content only rendered when expanded

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
Check that code styles are defined in `markdown-styles.ts`:
```typescript
code_block: {
  backgroundColor: theme.accent,
  fontFamily: 'monospace',
  // ...
}
```

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
- [markdown-styles.ts](apps/mapp/lib/markdown-styles.ts) - Styles configuration and hook

### Modified:
- [ChatMessage.tsx](apps/mapp/components/ChatMessage.tsx) - Integrated Markdown component
  - Lines 11-12: Imports
  - Lines 118, 205: useMarkdownStyles hook usage
  - Lines 140-142, 156-158, 174-176, 180-182: Accordion sections
  - Lines 236-238, 247-249: MessageContent rendering
- [package.json](apps/mapp/package.json) - Added `react-native-markdown-display` dependency

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

## Future Enhancements

- [ ] **Syntax highlighting** - Add language-specific code highlighting
- [ ] **Custom link handler** - In-app navigation for certain URLs
- [ ] **Image optimization** - Lazy loading and caching
- [ ] **Math rendering** - LaTeX/KaTeX support for equations
- [ ] **Mermaid diagrams** - Render diagrams from markdown
- [ ] **Copy code button** - Quick copy for code blocks
- [ ] **Emoji picker** - Autocomplete for emoji shortcuts

## Notes

- Markdown rendering is now enabled by default for all messages
- The implementation is theme-aware and adapts to light/dark mode
- Text selection works natively across all markdown content
- Performance is excellent - no WebView overhead
- Styles match the app's design system perfectly
- Links are automatically tappable and open in the system browser
- The feature works identically across iOS and Android
