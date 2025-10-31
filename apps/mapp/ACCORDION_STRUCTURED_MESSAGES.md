# Accordion & Structured Message Display Implementation

## Overview
This document describes the implementation of accordion-based structured message display in the mobile app (mapp), similar to the webapp. The feature allows AI assistant responses to be displayed in collapsible sections with rich formatting.

## Architecture

### 1. Accordion Component (`apps/mapp/components/ui/accordion.tsx`)

Built on `@rn-primitives/accordion` with React Native Reanimated for smooth animations.

**Key Features:**
- **Collapsible sections**: Single item expansion mode
- **Animated transitions**: Smooth rotation of chevron icon using Reanimated
- **NativeWind styling**: Consistent with other UI components
- **Accessible**: Built on React Native primitives

**Components:**
```tsx
- Accordion: Root container with type="single" collapsible
- AccordionItem: Individual collapsible item
- AccordionTrigger: Clickable header with animated chevron
- AccordionContent: Expandable content area
```

**Animation:**
- ChevronDown icon rotates 180° when opened
- 200ms timing for smooth transition
- Uses `useSharedValue` and `withTiming` from Reanimated
- Properly initializes shared value to avoid render warnings

### 2. Structured Response Types (`@homeapp/common/types.ts`)

```typescript
export type ServiceProvider = {
  name: string;
  contact_info: string;
  location: string;
  reviews: string;
  ratings: string;
  directions: string | null;
  website: string | null;
  authorized: string;
  additional_information: string;
  specialties?: string;
  link?: string;
};

export type StructuredResponseData = {
  researchResults?: {
    summaryOfFindings?: string;
    yourDocuments?: string;
    googleSearch?: string;
    youtubeSearch?: string;
  };
  serviceProviderResults?: {
    serpAPIResults?: ServiceProvider[];
    yelpAPIResults?: ServiceProvider[];
  };
};
```

### 3. ChatMessage Component Updates

The [ChatMessage.tsx](apps/mapp/components/ChatMessage.tsx) component now includes:

#### A. JSON Parsing Logic

```typescript
const jsonRegex = /\*\*.*?\*\*\s*:\s*```json\s*\n([\s\S]*?)```/;
const match = content.match(jsonRegex);

if (match && match[1]) {
  // Clean up markdown which has unescaped characters
  const cleaned = match[1].trim().replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
  const parsed = JSON.parse(cleaned);
  if (parsed.researchResults || parsed.serviceProviderResults) {
    structuredData = parsed;
  }
}
```

**Pattern Explanation:**
- Matches: `**Label**: ```json\n{...}` ` ``
- Extracts JSON content between code fences
- Cleans unescaped backslashes before parsing
- Validates for expected data structure

#### B. StructuredResponse Component

Displays parsed JSON data in accordion sections:

**Sections:**
1. **Summary** (Info icon)
   - From `summaryOfFindings`
   - Default expanded

2. **Coverage** (ShieldCheck icon)
   - From `yourDocuments`
   - Insurance/policy information

3. **DIY Solutions** (Wrench icon)
   - Combines `googleSearch` and `youtubeSearch`
   - Research and tutorial links

4. **Service Providers** (Users icon)
   - Lists providers from Yelp and SERP APIs
   - Displays as cards with ratings, contact, links

#### C. ServiceProviderCard Component

Displays individual service providers with:
- **Name and Authorization badge**: "Authorized" badge for verified providers
- **Ratings**: Star icon with rating and review count
- **Information**: Description, contact, location
- **Specialties**: Provider expertise areas
- **Action buttons**:
  - Website/Yelp link (opens in browser)
  - Directions (opens in maps app)

**Features:**
- Link validation before display
- Touch-friendly button layout
- Proper text truncation for long content
- Icon-based visual hierarchy

### 4. User Experience Flow

#### For Regular Messages:
```
Message content → Display as text → No special formatting
```

#### For Structured Messages:
```
Message content → Regex match → Parse JSON → Extract sections
                                    ↓
                            StructuredResponse
                                    ↓
                      ┌─────────────┴─────────────┐
                      ↓                           ↓
              Accordion sections          Service Provider cards
                      ↓                           ↓
              Summary, Coverage,          Individual provider details
              DIY Solutions                with interactive buttons
```

## Implementation Details

### JSON Response Format

The agent backend returns responses in this format:

```markdown
Here's what I found:

**Structured Data**: ```json
{
  "researchResults": {
    "summaryOfFindings": "Based on your insurance policy...",
    "yourDocuments": "Your policy covers water damage...",
    "googleSearch": "Here are some DIY solutions...",
    "youtubeSearch": "Video tutorials: [Title](URL)"
  },
  "serviceProviderResults": {
    "yelpAPIResults": [
      {
        "name": "ABC Plumbing",
        "contact_info": "(555) 123-4567",
        "location": "123 Main St, City, State",
        "reviews": "125",
        "ratings": "4.8/5",
        "directions": "https://maps.google.com/...",
        "website": "https://example.com",
        "authorized": "True",
        "additional_information": "24/7 emergency service...",
        "specialties": "Water damage, pipe repair",
        "link": "https://yelp.com/..."
      }
    ],
    "serpAPIResults": []
  }
}
` ``
```

### Styling Patterns

**Accordion:**
- Border bottom between items
- Consistent padding (py-4 for trigger, p-4 for content)
- Rounded bottom borders on content
- Background color matches message bubble

**Service Provider Cards:**
- Rounded corners with border
- Hierarchical text sizes (semibold for name, small for details)
- Color-coded badges (blue for authorized)
- Star icon with yellow fill for ratings
- Gap-based spacing for clean layout

### Icons Used

```typescript
- Info: Summary section
- ShieldCheck: Coverage section
- Wrench: DIY Solutions section
- Users: Service Providers section
- Star: Rating display
- CheckCircle: Authorization badge
- Phone: Contact information
- Map: Location and directions
```

## Dependencies

### Installed Packages

```json
{
  "@rn-primitives/accordion": "latest",
  "@rn-primitives/portal": "~1.3.0",
  "@rn-primitives/slot": "^1.2.0",
  "react-native-reanimated": "~4.1.1",
  "lucide-react-native": "^0.545.0"
}
```

### Required Setup

1. **Reanimated Plugin** - Already configured in `babel.config.js`
2. **NativeWind** - For Tailwind styling
3. **TypeScript** - For type safety

## Features Implemented

✅ Accordion component with animations
✅ JSON parsing from markdown code blocks
✅ Structured response display
✅ Service provider cards
✅ Collapsible sections with icons
✅ Link handling (opens in browser)
✅ Directions linking (opens in maps)
✅ Authorization badges
✅ Star ratings display
✅ Responsive text truncation
✅ Type-safe implementation

## Comparison: Webapp vs Mobile

| Feature | Webapp | Mobile App |
|---------|--------|------------|
| **Library** | Radix UI | @rn-primitives |
| **Markdown** | react-markdown + remark-gfm | Plain text (TODO) |
| **Animations** | CSS transitions | Reanimated |
| **Layout** | Grid (2 columns on desktop) | Single column stack |
| **Links** | Browser navigation | Linking.openURL |
| **YouTube** | Embedded iframes | TODO: Video player |
| **Google Maps** | Direct link | Opens native maps app |

## Limitations & Future Work

### Current Limitations

- **No Markdown Rendering**: Content displayed as plain text
  - Missing: Bold, italic, links, lists, code blocks
  - Workaround: JSON structure compensates for formatting

- **No Video Embeds**: YouTube links not rendered inline
  - Workaround: Links open in browser

- **No Image Support**: Markdown images not displayed
  - Workaround: File attachments handle images separately

### Future Enhancements

- [ ] **Markdown Support**: Integrate `react-native-markdown-display`
  ```bash
  npm install react-native-markdown-display
  ```

- [ ] **Video Player**: Add YouTube iframe or native video component
  - Use `react-native-youtube-iframe` or `expo-av`

- [ ] **Link Detection**: Auto-detect and linkify URLs in text
  - Use `Autolink` or `react-native-hyperlink`

- [ ] **Copy to Clipboard**: Long-press to copy message sections
  - Use `@react-native-clipboard/clipboard`

- [ ] **Share Functionality**: Share provider info or message content
  - Use `react-native-share`

- [ ] **Map Preview**: Show map thumbnail for provider locations
  - Use `react-native-maps`

## Testing

### Manual Testing Scenarios

1. **Regular Message**: Send plain text, verify normal display
2. **Structured Message**: Send message with JSON block
3. **Summary Only**: JSON with only `summaryOfFindings`
4. **With Providers**: JSON with service provider results
5. **Authorization Badge**: Provider with `authorized: "True"`
6. **Links**: Tap website and directions buttons
7. **Accordion**: Expand/collapse each section
8. **Long Content**: Test text truncation in provider cards

### Sample Test Message

Create a test message in Firestore:

```json
{
  "role": "assistant",
  "content": "Based on your query, here's what I found:\n\n**Structured Data**: ```json\n{\n  \"researchResults\": {\n    \"summaryOfFindings\": \"Your water heater issue requires professional attention. Based on your insurance policy, this should be covered under your homeowner's policy.\",\n    \"yourDocuments\": \"Your policy includes water damage coverage up to $50,000 with a $500 deductible.\"\n  },\n  \"serviceProviderResults\": {\n    \"yelpAPIResults\": [\n      {\n        \"name\": \"Quick Fix Plumbing\",\n        \"contact_info\": \"(555) 123-4567\",\n        \"location\": \"123 Main St, San Francisco, CA\",\n        \"reviews\": \"125 reviews\",\n        \"ratings\": \"4.8/5\",\n        \"directions\": \"https://google.com/maps/dir/?api=1&destination=123+Main+St\",\n        \"website\": \"https://quickfixplumbing.com\",\n        \"authorized\": \"True\",\n        \"additional_information\": \"24/7 emergency service, licensed and insured\",\n        \"specialties\": \"Water heaters, pipe repair, drain cleaning\",\n        \"link\": \"https://yelp.com/biz/quick-fix-plumbing\"\n      }\n    ]\n  }\n}\n```\",\n  \"createdAt\": \"2025-01-15T10:30:00Z\"\n}
```

## Files Created/Modified

### Created:
- [accordion.tsx](apps/mapp/components/ui/accordion.tsx) - Accordion UI component

### Modified:
- [types.ts](apps/common/src/types.ts) - Added ServiceProvider and StructuredResponseData types
- [ChatMessage.tsx](apps/mapp/components/ChatMessage.tsx) - Complete rewrite with:
  - JSON parsing logic
  - StructuredResponse component
  - ServiceProviderCard component
  - MessageContent component with structured data handling

### Dependencies:
- Added `@rn-primitives/accordion` to `apps/mapp/package.json`

## Troubleshooting

### Reanimated Warning: "Reading from value during component render"

**Problem:**
```
[Reanimated] Reading from `value` during component render.
```

**Solution:**
Initialize shared values to a static value (e.g., 0) instead of computing from props:

```typescript
// ❌ Wrong - reads isOpen during render
const rotation = useSharedValue(isOpen ? 180 : 0);

// ✅ Correct - static initialization
const rotation = useSharedValue(0);

// Update in useEffect
React.useEffect(() => {
  rotation.value = withTiming(isOpen ? 180 : 0, { duration: 200 });
}, [isOpen, rotation]);
```

This warning has been fixed in the current implementation.

### Accordion Not Animating

**Possible causes:**
1. Reanimated plugin not configured in `babel.config.js`
2. Missing Reanimated dependency
3. App not restarted after adding Reanimated

**Solution:**
```bash
# Ensure Reanimated is installed
npm install react-native-reanimated

# Clear cache and restart
expo start -c
```

### Service Provider Links Not Opening

**Problem:** Tapping website/directions buttons does nothing.

**Solution:** Check URL validation and permissions:
```typescript
// Ensure URLs are properly formatted
const isPrimaryLinkValid = provider.link &&
  (provider.link.startsWith('http://') || provider.link.startsWith('https://'));

// Test link opening
Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
```

## Notes

- The implementation matches the webapp's visual design and functionality
- All styling uses NativeWind for consistency
- The accordion animations are smooth (200ms timing)
- Service provider cards are touch-friendly with proper spacing
- Links properly validate before displaying buttons
- The component is fully typed with TypeScript
- Error handling gracefully falls back to plain text display
- Content is selectable for copy-paste functionality
- Fixed Reanimated warnings by properly initializing shared values
