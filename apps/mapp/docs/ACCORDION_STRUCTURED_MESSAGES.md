# Accordion & Structured Message Display Implementation

## Overview
This document describes the implementation of accordion-based structured message display in the mobile app (mapp), similar to the webapp. The feature allows AI assistant responses to be displayed in collapsible sections with rich formatting, including markdown rendering, video embeds, product cards, and interactive service provider listings.

## Architecture

### 1. Accordion Component ([apps/mapp/components/ui/accordion.tsx](apps/mapp/components/ui/accordion.tsx))

Built on `@rn-primitives/accordion` with React Native Reanimated for smooth animations.

**Key Features:**
- **Collapsible sections**: Single item expansion mode with default open section
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

### 2. Structured Response Types ([apps/common/src/types.ts](apps/common/src/types.ts))

The type system supports structured analysis payloads consumed via `contentJson`:

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

export type Product = {
  // Legacy fields (kept for backward compatibility)
  product_name?: string;
  item_price?: string | null;
  image_url?: string | null;
  rating?: string | null;
  reviews?: string | null;
  // New structured fields
  vendor?: string | null;
  url?: string | null;
  description?: string | null;
  price?: string | null;
};

export type StructuredResponseData = {
  title?: string;

  // Nested structure (preferred format)
  analysis?: {
    title?: string;
    triageResult?: {
      diagnosis?: string;
      needs_clarification?: boolean;
      message?: string;
      clarification_questions?: string[];
    };
    coverageResult?: {
      warrantyInfo?: string;
      insuranceInfo?: string;
    };
    diyResults?: {
      diySteps?: {
        summary?: string;
        steps?: Array<{ stepNumber: number; description: string }>;
      };
      youtubeSearch?: {
        videos?: Array<{ title: string; url: string; description?: string }>;
      };
      recommendedProducts?: {
        products?: Product[];
      };
    };
    serviceResults?: {
      costEstimates?: string;
      /** When provider search fails (e.g. SerpAPI quota), backend sets these; UI shows Service accordion with `searchError`. */
      searchStatus?: 'failed' | 'ok';
      searchError?: string;
      localPros?: {
        serpAPIResults?: ServiceProvider[];
        googleSearchResults?: ServiceProvider[];
      };
    };
    costEstimationResults?: {
      costEstimates?: string | {
        repair_type?: string;
        DIY?: {
          cost_range?: string;
          savings?: string;
          complexity?: string;
          includes?: string[];
        };
        Service?: {
          cost_range?: string;
          benefits?: string;
          complexity?: string;
          includes?: string[];
        };
        comparison?: {
          diy_savings?: string;
          professional_benefits?: string;
          considerations?: string;
        };
      };
    };
  };

  // Flat structure fields (backward compatibility)
  triageResult?: { ... };
  coverageResult?: { ... };
  diyResults?: { ... };
  serviceResults?: { ... };

  // Legacy format (backward compatibility)
  researchResults?: {
    summaryOfFindings?: string;
    yourDocuments?: string;
    googleSearch?: string;
    youtubeSearch?: string;
  };
  serviceProviderResults?: {
    serpAPIResults?: ServiceProvider[];
    googleSearchResults?: ServiceProvider[];
  };
};
```

### 3. ChatMessage Component ([apps/mapp/components/ChatMessage.tsx](apps/mapp/components/ChatMessage.tsx))

The ChatMessage component includes comprehensive parsing and rendering capabilities:

#### A. Structured Data Source

Orchestrator V2 uses persisted `contentJson` as the single source for structured UI.

**Current behavior:**
- Proxy persists `contentJson` + `contentMarkdown`
- When `contentJson` has visible accordion sections, UI renders **hybrid** display:
  - `analysis.title` title card
  - Structured accordions from `contentJson` (collapsed only while optional branches or synthesis are in flight — checkpoint-only opens **Checkpoint Summary** by default)
  - **Summary & Next Steps** last accordion from filtered `contentMarkdown` (collapsed by default; inline preview in trigger; placeholder **Preparing summary…** only while `analysisStatus.synthesis` is `pending`/`running` or the synthesis agent step is executing — not for checkpoint-only turns; does not auto-open when synthesis arrives)
  - Native accordion `value` uses `STRUCTURED_ACCORDION_COLLAPSED` (`__collapsed__`) instead of `undefined` so `@rn-primitives/accordion` stays controlled on collapse (avoids preview + content showing together on first tap)
  - Structured **title card** includes a full-report icon that opens a page sheet with all accordion sections expanded for read-through
  - In-flight branch/synthesis progress uses **CheckpointAnalysisProgressFooter** above the composer context chips (not a strip below accordions)
  - **Suggested-action** quick-reply chips below accordions are hidden while `isTurnInFlight`; they appear when the turn completes
  - `suggestedActions` quick-reply chips below the bubble
- Plain markdown-only messages still use full `contentMarkdown` prose
- Message text is not parsed for fenced JSON in hot paths

**Content resolution:**
```typescript
import { resolveMessageContentParts } from '@homeapp/common/lib/message-content-parts';
import { getMessageDisplayParts } from '@/lib/chat-content-parse';

const { markdown, contentJson } = resolveMessageContentParts(message);
const { structuredData, summaryMarkdown } = getMessageDisplayParts(message);
// structuredData → StructuredResponse accordions
// summaryMarkdown → last accordion (Summary & Next Steps) when structured
// markdown → prose fallback when no structured UI
```

**Cost accordion:** renders `costEstimates.recommendation.notes` and `next_steps` when present in JSON.

#### B. StructuredResponse Component

Displays parsed JSON data in accordion sections with intelligent content detection:

**Sections (in order):**

1. **Triage Summary** ([ChatMessage.tsx:553-588](apps/mapp/components/ChatMessage.tsx#L553-L588))
   - Icon: Stethoscope (Info color)
   - Shows diagnosis from `triageResult.diagnosis`
   - **Clarification Mode**: If `needs_clarification === true`
     - Displays `clarification_questions` as numbered list
     - Shows `message` explaining what information is needed
   - Renders markdown content for diagnosis
   - Default expanded

2. **Coverage Analysis** ([ChatMessage.tsx:590-621](apps/mapp/components/ChatMessage.tsx#L590-L621))
   - Icon: ShieldCheck (Success color)
   - Shows warranty information from `coverageResult.warrantyInfo`
   - Shows insurance information from `coverageResult.insuranceInfo`
   - Renders markdown content for both sections
   - Hidden if clarification needed

3. **DIY Recommendations** ([ChatMessage.tsx:623-693](apps/mapp/components/ChatMessage.tsx#L623-L693))
   - Icon: Wrench (Warning color)
   - **DIY Steps Summary**: Markdown rendered summary
   - **Step-by-Step Instructions**: Numbered list with descriptions
   - **Video Tutorials**: YouTube video embeds with titles and descriptions
   - **Recommended Products**: Product cards with images and purchase links
   - Hidden if clarification needed

4. **Service Recommendations** ([ChatMessage.tsx:695-718](apps/mapp/components/ChatMessage.tsx#L695-L718))
   - Icon: Users (Indigo color)
   - Lists local service providers from multiple sources:
     - `localPros.googleSearchResults`
     - `localPros.serpAPIResults`
     - `providers`, `localProviders`, `local_pros`, `results`, `nearbyProviders`
   - Normalizes provider data from various field name variations
   - Renders as ServiceProviderCard components
   - Hidden if clarification needed

5. **Cost Estimates** ([ChatMessage.tsx:720-886](apps/mapp/components/ChatMessage.tsx#L720-L886))
   - Icon: DollarSign (Purple color)
   - Shows repair type
   - **DIY Option**: Cost range, savings, complexity, included items
   - **Professional Service**: Cost range, benefits, complexity, included items
   - **Comparison**: DIY savings vs professional benefits
   - Supports both string and structured object formats
   - Hidden if clarification needed

**Title Display:**
- Extracted from `analysis.title` or `data.title`
- Falls back to preview text from diagnosis or clarification message
- Displayed in rounded border box above accordion
- Shimmers via `DisplayTitleGradientText` while `shouldShowDisplayTitleGradient` is true (`isTurnInFlight`, in-flight `analysisStatus`, or executing branch/synthesis `agentSteps`)

#### C. ServiceProviderCard Component ([ChatMessage.tsx:320-447](apps/mapp/components/ChatMessage.tsx#L320-L447))

Displays individual service providers with comprehensive information:

**Layout:**
- **Header**: Provider name + "Authorized" badge (if verified)
- **Ratings**: Star icon with rating value and review count
- **Description**: Additional information (max 3 lines)
- **Contact Info**: Phone icon + phone number
- **Location**: Map icon + address (max 1 line)
- **Specialties**: Services offered
- **Action Buttons**:
  - Primary link (Website or "View on SerpAPI/Google Search")
  - Directions (opens native maps app)

**Features:**
- URL normalization with protocol detection
- Link validation before displaying buttons
- Special handling for SerpAPI/Google Search URLs
- Touch-friendly button layout
- Proper text truncation for long content
- Icon-based visual hierarchy
- Authorization badge with info color styling

#### D. ProductCard Component ([ChatMessage.tsx:212-297](apps/mapp/components/ChatMessage.tsx#L212-L297))

Displays recommended products with rich media:

**Features:**
- **Product Image**:
  - 128px height, responsive width
  - Loading skeleton with placeholder
  - Error fallback with icon
  - Uses expo-image with caching
- **Product Name**: Bold, 2-line max with ellipsis
- **Vendor**: Small gray text
- **Price**: Prominent display from `price` or `item_price`
- **Rating**: Star icon with rating value
- **Reviews**: Review count in parentheses
- **View Product Button**: Opens product URL in browser

**Image Handling:**
- Loading state with skeleton animation
- Error state with fallback icon
- Memory + disk caching via expo-image
- 200ms fade-in transition

#### E. YouTubeEmbed Component ([ChatMessage.tsx:299-318](apps/mapp/components/ChatMessage.tsx#L299-L318))

Embeds YouTube videos inline:

**Features:**
- Extracts video ID from various URL formats
- 192px height, full width
- Paused by default
- Hardware layer for Android performance
- Uses `react-native-youtube-iframe`

#### F. FilePreview Component ([ChatMessage.tsx:1021-1120](apps/mapp/components/ChatMessage.tsx#L1021-L1120))

Displays file attachments with type-specific rendering:

**Supported Types:**
- **Images**: Rendered with expo-image, maintains aspect ratio
- **Videos**: Native video player with controls
- **Other files**: Icon + filename display

**Image Features:**
- Stored dimensions used for aspect ratio
- Max 200px width/height
- Blurhash placeholder
- Error fallback
- Aligned based on message sender

#### G. Message Context Menu ([ChatMessage.tsx:1136-1204](apps/mapp/components/ChatMessage.tsx#L1136-L1204))

Long-press interaction for message actions:

**Actions:**
1. **Copy Message**:
   - Copies markdown content converted to WhatsApp format
   - Strips code block wrappers
   - Shows success/error feedback
   - Haptic feedback on action
2. **Share**:
   - Uses native share sheet
   - Same formatting as copy

**Features:**
- Modal overlay with touch-to-dismiss
- Haptic feedback on long-press
- Auto-dismiss alerts after 2 seconds
- Preserves markdown formatting via `markdownToWhatsapp()`

### 4. User Experience Flow

#### For Regular Messages:
```
Message content → Display with markdown → No special formatting
```

#### For Structured Messages:
```
Message content → Multi-stage parsing → Extract JSON + markdown
                            ↓
                    StructuredResponse
                            ↓
        ┌───────────────────┴───────────────────┐
        ↓                                       ↓
  Accordion sections                    Rich components
        ↓                                       ↓
  Triage (default open)              Product cards with images
  Coverage analysis                  YouTube video embeds
  DIY recommendations                Service provider cards
  Service providers                  Cost comparison tables
  Cost estimates                     Interactive buttons
```

#### For Clarification Needed:
```
Message → Parse JSON → Detect needs_clarification
                ↓
        Display questions only
                ↓
        Numbered question list
        No DIY/Service/Cost sections
```

## Implementation Details

### JSON Response Format

The agent backend returns responses in these formats:

#### Format 1: Combined Markdown + JSON (Preferred)
```markdown
```markdown
Here's my analysis of your water heater issue...
```

```json
{
  "analysis": {
    "title": "Water Heater Repair Analysis",
    "triageResult": {
      "diagnosis": "Your water heater appears to have a faulty heating element..."
    },
    "coverageResult": {
      "warrantyInfo": "Your appliance warranty covers...",
      "insuranceInfo": "Homeowner's insurance typically covers..."
    },
    "diyResults": {
      "diySteps": {
        "summary": "This repair requires basic plumbing skills...",
        "steps": [
          { "stepNumber": 1, "description": "Turn off power and water supply" },
          { "stepNumber": 2, "description": "Drain the water heater" }
        ]
      },
      "youtubeSearch": {
        "videos": [
          {
            "title": "How to Replace a Water Heater Element",
            "url": "https://www.youtube.com/watch?v=...",
            "description": "Complete step-by-step tutorial..."
          }
        ]
      },
      "recommendedProducts": {
        "products": [
          {
            "product_name": "Universal Water Heater Element",
            "vendor": "Home Depot",
            "price": "$24.99",
            "rating": "4.5",
            "reviews": "1,234",
            "url": "https://...",
            "image_url": "https://..."
          }
        ]
      }
    },
    "serviceResults": {
      "localPros": {
        "googleSearchResults": [
          {
            "name": "ABC Plumbing",
            "contact_info": "(555) 123-4567",
            "location": "123 Main St, City, State",
            "reviews": "125",
            "ratings": "4.8/5",
            "directions": "https://maps.google.com/...",
            "website": "https://example.com",
            "authorized": "True",
            "additional_information": "24/7 emergency service",
            "specialties": "Water heaters, pipe repair",
            "link": "https://yelp.com/..."
          }
        ]
      }
    },
    "costEstimationResults": {
      "costEstimates": {
        "repair_type": "Water heater element replacement",
        "DIY": {
          "cost_range": "$25-$50",
          "savings": "Save $150-$250 vs professional",
          "complexity": "Moderate - requires basic plumbing skills",
          "includes": ["Heating element", "Gasket", "Basic tools"]
        },
        "Service": {
          "cost_range": "$175-$300",
          "benefits": "Professional diagnosis, warranty on work, code compliance",
          "complexity": "Simple - technician handles everything",
          "includes": ["Labor", "Element", "Testing", "1-year warranty"]
        },
        "comparison": {
          "diy_savings": "60-70% cost savings",
          "professional_benefits": "Expert diagnosis, warranty coverage, safety assurance",
          "considerations": "DIY requires 2-3 hours and basic skills"
        }
      }
    }
  }
}
```
```

#### Format 2: JSON Code Block Only
```markdown
Based on your query, here's what I found:

```json
{
  "triageResult": {
    "diagnosis": "..."
  },
  "diyResults": { ... }
}
```
```

#### Format 3: Clarification Needed
```json
{
  "analysis": {
    "triageResult": {
      "needs_clarification": true,
      "message": "I need more information to provide accurate recommendations:",
      "clarification_questions": [
        "How old is your water heater?",
        "Is the water completely cold or just lukewarm?",
        "Do you hear any unusual noises?"
      ]
    }
  }
}
```

### Helper Functions

#### Provider Normalization ([ChatMessage.tsx:68-107](apps/mapp/components/ChatMessage.tsx#L68-L107))

The `normalizeProvider` function handles field name variations:
- Name: `name`, `business_name`, `businessName`, `title`, `company`, `provider`, `store`
- Links: `website`, `url`, `link`
- Contact: `contact_info`, `phone`, `phoneNumber`, `contact`, `contactInfo`
- Location: `location`, `address`, `address_line`

#### Provider Array Extraction ([ChatMessage.tsx:121-139](apps/mapp/components/ChatMessage.tsx#L121-L139))

The `getProvidersArray` function searches for provider arrays in:
- Direct array
- Nested: `providers`, `results`, `items`, `pros`, `list`
- JSON string parsing

### Styling Patterns

**Accordion:**
- Border bottom between items (`border-b border-border`)
- Consistent padding (`px-2 py-3` for trigger, `p-4` for content)
- Background color: `bg-background` for content
- Default value: `"triage"` (first section open)

**Service Provider Cards:**
- Rounded corners with border (`rounded-lg border border-border`)
- White background (`bg-background`)
- Hierarchical text sizes:
  - Name: `font-semibold text-foreground`
  - Details: `text-sm text-foreground`
  - Meta: `text-xs text-muted-foreground`
- Color-coded badges: `bg-info/10` with `text-info` for authorized
- Star ratings: `text-warning` (yellow)
- Spacing: `space-y-1`, `gap-2`, `mb-3`

**Product Cards:**
- Similar structure to provider cards
- Image container: `h-32 w-full rounded-md`
- Loading skeleton: Multiple animated bars
- Price: `text-sm font-semibold text-primary`
- Button: `variant="outline" w-full`

**Cost Estimate Cards:**
- Nested rounded boxes (`rounded-lg border border-border`)
- Purple accent color: `text-purple-600`
- Comparison section: `rounded-lg bg-muted p-3`
- Bullet lists for included items

### Icons Used

```typescript
// Section headers
- Stethoscope: Triage Summary
- ShieldCheck: Coverage Analysis
- Wrench: DIY Recommendations
- Users: Service Providers
- DollarSign: Cost Estimates

// Content elements
- Star: Rating display (yellow/warning)
- CheckCircle: Authorization badge, success states
- Phone: Contact information
- Map: Location and directions
- FileText: File/image fallbacks
- Copy: Copy message action
- Share2: Share message action
- AlertCircle: Error states

// UI elements
- User: User message avatar
- Bot: Assistant message avatar
- ChevronDown: Accordion expand/collapse (in ui/accordion.tsx)
```

## Dependencies

### Installed Packages

```json
{
  "@rn-primitives/accordion": "latest",
  "@rn-primitives/portal": "~1.3.0",
  "@rn-primitives/slot": "^1.2.0",
  "react-native-reanimated": "~4.1.1",
  "lucide-react-native": "^0.545.0",
  "react-native-markdown-display": "latest",
  "react-native-youtube-iframe": "latest",
  "expo-clipboard": "latest",
  "expo-haptics": "latest",
  "expo-image": "latest",
  "expo-video": "latest"
}
```

### Required Setup

1. **Reanimated Plugin** - Configured in `babel.config.js`
2. **NativeWind** - For Tailwind styling
3. **TypeScript** - For type safety
4. **Expo modules** - For clipboard, haptics, image, video

## Features Implemented

✅ Accordion component with smooth animations
✅ Orchestrator V2 `contentMarkdown` / `contentJson` message contract
✅ Structured response display with 5 sections
✅ Service provider cards with normalization
✅ Product cards with image loading
✅ YouTube video embeds
✅ Collapsible sections with icons
✅ Link handling (opens in browser)
✅ Directions linking (opens in maps)
✅ Authorization badges
✅ Star ratings display
✅ Responsive text truncation
✅ Type-safe implementation
✅ Markdown rendering with custom styles
✅ Copy to clipboard with formatting
✅ Share functionality
✅ Long-press context menu
✅ Haptic feedback
✅ File preview support
✅ Clarification question handling
✅ Cost estimation breakdowns
✅ DIY step-by-step instructions

## Comparison: Webapp vs Mobile

| Feature | Webapp | Mobile App |
|---------|--------|------------|
| **Library** | Radix UI | @rn-primitives |
| **Markdown** | react-markdown + remark-gfm | react-native-markdown-display ✅ |
| **Animations** | CSS transitions | Reanimated |
| **Layout** | Grid (2 columns on desktop) | Single column stack |
| **Links** | Browser navigation | Linking.openURL |
| **YouTube** | Embedded iframes | react-native-youtube-iframe ✅ |
| **Google Maps** | Direct link | Opens native maps app |
| **Copy/Share** | Browser APIs | expo-clipboard + Share API ✅ |
| **Images** | Standard img tags | expo-image with caching ✅ |
| **Videos** | HTML5 video | expo-video ✅ |

## Future Enhancements

- [ ] **Map Preview**: Show map thumbnail for provider locations
  - Use `react-native-maps` for inline preview
  - Currently: Opens native maps app

- [ ] **Product Price Tracking**: Show price history or deals
  - Integration with price tracking APIs

- [ ] **Provider Favorites**: Save preferred service providers
  - Store in user profile

- [ ] **Calendar Integration**: Schedule service appointments
  - Link to calendar app with pre-filled details

- [ ] **Multi-language Support**: Translate content
  - Add i18n for all UI strings

- [ ] **Offline Support**: Cache structured responses
  - Store in AsyncStorage for offline viewing

- [ ] **Analytics**: Track which sections users interact with
  - Understand user preferences

## Testing

### Manual Testing Scenarios

1. **Regular Message**: Send plain text, verify markdown rendering
2. **Structured Message**: Send message with nested JSON block
3. **Triage Only**: JSON with only diagnosis
4. **Clarification Needed**: JSON with clarification questions
5. **Full Analysis**: All 5 sections populated
6. **DIY with Products**: Product cards with images
7. **DIY with Videos**: YouTube embeds
8. **Service Providers**: Multiple providers from different sources
9. **Cost Estimates**: DIY vs Service comparison
10. **Authorization Badge**: Provider with `authorized: "True"`
11. **Links**: Tap website, SerpAPI/Google Search, and directions buttons
12. **Accordion**: Expand/collapse each section
13. **Long Content**: Test text truncation in provider cards
14. **Long Press**: Test copy and share actions
15. **Image Loading**: Test product images with slow connection
16. **Image Error**: Test with invalid image URLs
17. **Legacy Format**: Test old JSON structure compatibility

### Sample Test Message

Create a test message in Firestore with separate V2 fields:

```json
{
  "role": "assistant",
  "content": "",
  "contentMarkdown": "Here's my complete analysis of your water heater issue.",
  "contentJson": {
    "analysis": {
      "title": "Water Heater Repair Analysis",
      "triageResult": {
        "diagnosis": "Your water heater has a **faulty heating element**. This is a common issue..."
      },
      "coverageResult": {
        "warrantyInfo": "Your appliance warranty covers parts for up to 5 years...",
        "insuranceInfo": "Standard homeowner's insurance typically covers sudden failures..."
      },
      "diyResults": {
        "diySteps": {
          "summary": "This repair requires **moderate skill**...",
          "steps": [
            { "stepNumber": 1, "description": "Turn off power at breaker" },
            { "stepNumber": 2, "description": "Shut off water supply" }
          ]
        }
      },
      "serviceResults": {
        "localPros": {
          "googleSearchResults": [
            {
              "name": "Quick Fix Plumbing",
              "contact_info": "(555) 123-4567",
              "authorized": "True"
            }
          ]
        }
      },
      "costEstimationResults": {
        "costEstimates": {
          "repair_type": "Heating element replacement",
          "DIY": { "cost_range": "$25-$50" },
          "Service": { "cost_range": "$175-$300" }
        }
      }
    }
  },
  "createdAt": "2025-01-15T10:30:00Z"
}
```

### Clarification Test Message

```json
{
  "role": "assistant",
  "content": "",
  "contentMarkdown": "",
  "contentJson": {
    "analysis": {
      "triageResult": {
        "needs_clarification": true,
        "message": "I need more information to help diagnose your issue:",
        "clarification_questions": [
          "How old is your water heater?",
          "Is the water completely cold or lukewarm?",
          "Do you hear any unusual noises?"
        ]
      }
    }
  }
}
```

## Files Created/Modified

### Created:
- [accordion.tsx](apps/mapp/components/ui/accordion.tsx) - Accordion UI component
- [markdown-styles.ts](apps/mapp/lib/markdown-styles.ts) - Custom markdown styling
- [utils.ts](apps/mapp/lib/utils.ts) - `markdownToWhatsapp` conversion

### Modified:
- [types.ts](apps/common/src/types.ts) - Comprehensive type definitions with backward compatibility
- [ChatMessage.tsx](apps/mapp/components/ChatMessage.tsx) - Complete implementation with:
  - `resolveMessageContentParts` + `structuredDataHasVisibleSections`
  - StructuredResponse component with 5 sections
  - ServiceProviderCard with normalization
  - ProductCard with image handling
  - YouTubeEmbed component
  - FilePreview component
  - MessageContent with markdown rendering
  - Context menu for copy/share
  - Helper functions for data normalization

### Dependencies:
- Added `@rn-primitives/accordion` to `apps/mapp/package.json`
- Added `react-native-markdown-display` for markdown rendering
- Added `react-native-youtube-iframe` for video embeds
- Added `expo-clipboard` for copy functionality
- Added `expo-haptics` for tactile feedback

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
npx expo install react-native-reanimated

# Clear cache and restart
npx expo start -c
```

### Service Provider Links Not Opening

**Problem:** Tapping website/directions buttons does nothing.

**Solution:** Check URL validation and permissions:
```typescript
// The code uses normalizeUrl helper
const normalizeUrl = (u?: string): string | undefined => {
  if (!u || typeof u !== 'string') return undefined;
  const trimmed = u.trim();
  if (trimmed === '') return undefined;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProto);
    return url.toString();
  } catch {
    return undefined;
  }
};

// Test link opening
Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
```

### YouTube Videos Not Loading

**Problem:** YouTube embeds show blank or error.

**Possible causes:**
1. Invalid video ID extraction
2. YouTube API restrictions
3. Network connectivity

**Solution:**
```typescript
import { getYouTubeVideoId } from '@/lib/youtube-utils';

// Test with known good video
const videoId = getYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
```

### Markdown Not Rendering

**Problem:** Markdown displays as plain text.

**Check:**
1. `react-native-markdown-display` installed
2. `markdownStyles` properly imported
3. Content wrapped in `<Markdown>` component

**Solution:**
```bash
npx expo install react-native-markdown-display
```

### Product Images Not Loading

**Problem:** Product cards show skeleton indefinitely.

**Possible causes:**
1. Invalid image URL
2. CORS restrictions
3. expo-image not installed

**Debug:**
```typescript
// Check error handler
onError={(e) => {
  console.error('Image load error:', e.error);
  setImageError(true);
}}

// Verify URL format
console.log('Image URL:', product.image_url);
```

### Copy/Share Not Working

**Problem:** Long-press doesn't show menu or actions fail.

**Check:**
1. `expo-clipboard` installed
2. `expo-haptics` installed for feedback
3. Share API available on platform

**Solution:**
```bash
npx expo install expo-clipboard expo-haptics
```

## Performance Considerations

### Memoization

The implementation uses extensive memoization to prevent unnecessary re-renders:

```typescript
// Section visibility flags
const hasTriage = useMemo(() => { ... }, [triage]);
const hasCoverage = useMemo(() => { ... }, [coverage]);
const hasDIY = useMemo(() => { ... }, [diy]);
const hasService = useMemo(() => { ... }, [service]);

// Provider normalization
const allProviders = useMemo(() => {
  // Expensive array processing
}, [service]);

// Content split
const displayParts = useMemo(
  () => getMessageDisplayParts(message),
  [message, message.contentJson, message.contentMarkdown, message.content]
);
```

### Component Optimization

All display components use `React.memo`:
- `MessageAvatar`
- `ProductCard`
- `YouTubeEmbed`
- `ServiceProviderCard`
- `StructuredResponse`
- `MessageContent`
- `FilePreview`

### Image Optimization

Product and attachment images use expo-image with:
- Memory + disk caching: `cachePolicy="memory-disk"`
- Lazy loading with priorities
- Blurhash placeholders
- Progressive loading

## Notes

- Structured UI follows the `contentJson` contract directly
- All styling uses NativeWind for consistency with the rest of the app
- The accordion animations are smooth (200ms timing) and performant
- Service provider cards handle various field name variations gracefully
- Product cards include proper loading and error states
- Links are validated and normalized before display
- The component is fully typed with TypeScript for type safety
- Error handling gracefully falls back to plain text display
- Copy functionality preserves markdown formatting
- Fixed Reanimated warnings by properly initializing shared values
- Clarification mode hides irrelevant sections and focuses on questions
- Cost estimates support both simple string and complex object formats
- YouTube embeds extract video IDs from multiple URL formats
- File previews maintain aspect ratios and support multiple media types
