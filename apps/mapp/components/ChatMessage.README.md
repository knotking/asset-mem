# ChatMessage Component - Implementation Guide

## Overview

The `ChatMessage` component is a sophisticated React Native component that displays chat messages with support for rich, structured agent responses. This implementation is aligned with the web app's chat message display to ensure feature parity and consistent user experience across platforms.

## Architecture

### Component Structure

```
ChatMessage (Main Component)
├── MessageAvatar
├── ProductCard
├── ServiceProviderCard
├── StructuredResponse
├── MessageContent
├── FilePreview
└── DocumentsList
```

## Key Features

### 1. **Structured Data Parsing**

The component implements a sophisticated 4-method JSON parsing strategy to extract structured data from various message formats:

#### Method 1: Direct JSON Parsing
- Detects when entire message content is pure JSON
- Handles messages that start with `{` and end with `}`
- Example: `{"analysis": {"triageResult": {...}}}`

#### Method 2: Markdown Code Block Extraction
- Extracts JSON from markdown code fences
- Supports both ` ```json ` and ` ``` ` formats
- Example:
  ```markdown
  Here's the analysis:
  ```json
  {"analysis": {...}}
  ```
  ```

#### Method 3: Pattern-Based Detection
- Uses regex patterns to find JSON objects with known keys
- Searches for specific keys like `analysis`, `triageResult`, `serviceResults`
- Handles embedded JSON within text

#### Method 4: Brace Matching with Cleanup
- Finds first `{` and last `}` in content
- Applies intelligent cleaning:
  - Removes block comments (`/* ... */`)
  - Removes line comments (`//`)
  - Fixes trailing commas
  - Repairs escape sequences
- Last-resort fallback for malformed JSON

### 2. **Data Structure Support**

#### Nested Structure (New Format)
```typescript
{
  analysis: {
    triageResult: { diagnosis: string },
    coverageResult: { warrantyInfo: string, insuranceInfo: string },
    diyResults: {
      diySteps: { summary: string, steps: Array<{...}> },
      youtubeSearch: { videos: Array<{...}> },
      recommendedProducts: { products: Array<Product> }
    },
    serviceResults: {
      costEstimates: string,
      localPros: { yelpAPIResults: [], serpAPIResults: [] }
    }
  }
}
```

#### Flat/Legacy Structure (Backward Compatibility)
```typescript
{
  researchResults: {
    summaryOfFindings: string,
    yourDocuments: string,
    googleSearch: string,
    youtubeSearch: string
  },
  serviceProviderResults: {
    yelpAPIResults: ServiceProvider[],
    serpAPIResults: ServiceProvider[]
  }
}
```

### 3. **Service Provider Normalization**

The component includes comprehensive normalization logic to handle providers from various APIs:

```typescript
// Supported name variations
name: p.name || p.business_name || p.businessName || p.title ||
      p.company || p.provider || p.store

// URL handling
website: p.website || p.url || p.link
link: p.link || p.url || p.website

// Contact information
contact_info: p.contact_info || p.phone || p.phoneNumber ||
              p.contact || p.contactInfo
location: p.location || p.address || p.address_line

// Ratings and reviews
ratings: p.ratings || p.rating
reviews: p.reviews || p.review_count || p.reviewCount
```

#### Provider Container Detection
Checks multiple possible container keys:
- `providers`
- `results`
- `items`
- `pros`
- `list`
- `yelpAPIResults`
- `serpAPIResults`
- `localPros`
- `localProviders`
- `nearbyProviders`

### 4. **Validation and Filtering**

#### hasValue() Function
Filters out meaningless values:
- Empty strings
- `"N/A"`
- `"Not available"`
- `"None"`
- `"null"`
- Null/undefined values

#### Provider Validation
Only displays providers with:
- Valid name (non-empty, meaningful)
- At least one valid data field
- Proper normalization applied

### 5. **URL Normalization**

Smart URL handling with automatic protocol addition:

```typescript
const normalizeUrl = (url?: string): string | undefined => {
  if (!url || url.trim() === '') return undefined;

  // Add https:// if missing
  const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  // Validate URL format
  try {
    return new URL(withProto).toString();
  } catch {
    return undefined;
  }
};
```

## Component Breakdown

### ProductCard

Displays product recommendations with:
- Product name/description
- Vendor information
- Product image (if available)
- Price display
- Star ratings and review counts
- Clickable link to product page

**Props:**
```typescript
interface ProductCardProps {
  product: Product;
}
```

### ServiceProviderCard

Displays service provider information with:
- Provider name
- Authorization badge (if verified)
- Star ratings and reviews
- Additional information
- Contact details (phone)
- Location
- Specialties
- Action buttons (Website/Yelp, Directions)

**Props:**
```typescript
interface ServiceProviderCardProps {
  provider: ServiceProvider;
}
```

**Features:**
- Conditional field rendering (only shows fields with data)
- Smart URL handling (prefers link over website)
- Yelp detection for appropriate labeling
- Validation of all displayed fields

### StructuredResponse

Main component for rendering structured agent responses:

**Sections:**
1. **Triage Summary** (Blue badge)
   - Displays AI diagnosis
   - Markdown rendering support

2. **Coverage Analysis** (Green badge)
   - Warranty information
   - Insurance information
   - Legacy document analysis

3. **DIY Recommendations** (Orange badge)
   - Summary
   - Step-by-step instructions
   - Video tutorials (clickable links)
   - Recommended products

4. **Service Recommendations** (Purple badge)
   - Local service providers
   - Complete provider cards
   - Fallback message if none found

**Props:**
```typescript
interface StructuredResponseProps {
  data: StructuredResponseData;
}
```

## Type Definitions

Located in `@homeapp/common/types`:

### Product
```typescript
export type Product = {
  // Legacy fields
  product_name?: string;
  item_price?: string | null;
  image_url?: string | null;
  rating?: string | null;
  reviews?: string | null;

  // New fields
  vendor?: string | null;
  url?: string | null;
  description?: string | null;
  price?: string | null;
}
```

### ServiceProvider
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
}
```

### StructuredResponseData
See [Data Structure Support](#2-data-structure-support) section above.

## Usage Example

```typescript
import ChatMessage from '@/components/ChatMessage';

// Basic usage
<ChatMessage message={message} />

// Message structure
const message: Message = {
  id: '123',
  role: 'assistant',
  content: `Here's what I found:
    \`\`\`json
    {
      "analysis": {
        "triageResult": {
          "diagnosis": "Your water heater needs attention..."
        },
        "diyResults": {
          "diySteps": {
            "summary": "You can fix this yourself...",
            "steps": [...]
          },
          "recommendedProducts": {
            "products": [...]
          }
        }
      }
    }
    \`\`\`
  `,
  createdAt: Timestamp.now(),
  agentSteps: [],
};
```

## Styling

The component uses NativeWind (Tailwind CSS for React Native):

### Color Scheme
- **Primary**: User messages, primary actions
- **Secondary**: Assistant messages, secondary actions
- **Muted**: Subtle text, borders
- **Accent Colors**:
  - Blue (600): Triage/Info
  - Green (600/700): Coverage/Warranty
  - Orange (600/700): DIY/Recommendations
  - Purple (600/700): Service providers
  - Yellow (500): Star ratings

### Layout
- Responsive flex layouts
- Conditional rendering based on data
- Gap utilities for spacing
- Border radius for cards

## Debugging

The component includes console logging for JSON parsing:

```typescript
console.log('✓ Parsed JSON directly from content (Method 1)');
console.log('✓ Parsed JSON from code block (Method 2)');
console.log('✓ Parsed JSON from pattern match (Method 3)');
console.log('✓ Parsed JSON from brace matching (Method 4)');
console.log('✓ Parsed JSON after cleaning (Method 4b)');
```

To debug parsing issues:
1. Check console for parsing method used
2. Verify JSON structure matches expected format
3. Ensure required keys exist (`analysis`, `triageResult`, etc.)
4. Check for malformed JSON (missing quotes, trailing commas)

## Performance Considerations

1. **Memoization**: Consider wrapping in `React.memo()` for large message lists
2. **Image Loading**: Images are lazy-loaded with proper error handling
3. **Markdown Rendering**: Uses optimized `react-native-markdown-display`
4. **Filtering**: Provider filtering happens once during render

## Testing Recommendations

### Unit Tests
```typescript
// Test JSON parsing methods
describe('MessageContent JSON Parsing', () => {
  it('should parse direct JSON (Method 1)', () => {
    const content = '{"analysis": {"triageResult": {"diagnosis": "test"}}}';
    // Assert structured data extracted
  });

  it('should parse markdown code blocks (Method 2)', () => {
    const content = '```json\n{"analysis": {...}}\n```';
    // Assert structured data extracted
  });
});

// Test provider normalization
describe('Provider Normalization', () => {
  it('should normalize various name formats', () => {
    const provider = { business_name: 'ABC Plumbing' };
    // Assert normalized to { name: 'ABC Plumbing' }
  });
});

// Test validation
describe('Data Validation', () => {
  it('should filter N/A values', () => {
    const provider = { contact_info: 'N/A' };
    // Assert field not rendered
  });
});
```

### Integration Tests
- Test with real agent responses
- Verify all sections render correctly
- Test video link opening
- Test product/provider card interactions

## Migration Guide

### From Old Implementation

1. **Update imports:**
   ```typescript
   // Old
   import type { Message, StructuredResponseData, ServiceProvider } from '@homeapp/common/types';

   // New (no change, but types are extended)
   import type { Message, StructuredResponseData, ServiceProvider, Product } from '@homeapp/common/types';
   ```

2. **No component API changes:**
   - Props remain the same
   - Backward compatible with old data formats

3. **Rebuild common package:**
   ```bash
   cd apps/common
   npm run build
   ```

## Alignment with Web App

This mobile implementation is fully aligned with [apps/webapp/src/components/chat/chat-message.tsx](../../../webapp/src/components/chat/chat-message.tsx):

### Shared Features
✅ 4-method JSON parsing
✅ Nested and flat structure support
✅ Provider normalization
✅ Product card rendering
✅ Validation and filtering
✅ URL normalization
✅ Legacy format support

### Platform Differences
- **Web**: Uses Next.js Image component, HTML elements, ReactMarkdown
- **Mobile**: Uses React Native Image, View/Text components, react-native-markdown-display
- **Web**: Recursive accordion rendering for cost estimates (advanced feature)
- **Mobile**: Simplified accordion rendering (may add recursive support later)

## Future Enhancements

1. **Cost Estimates Section**: Add recursive rendering like web app
2. **Embedded Video Player**: Show YouTube videos inline instead of links
3. **Image Carousel**: For products with multiple images
4. **Provider Filtering**: Add filters for ratings, distance, specialties
5. **Offline Support**: Cache provider/product data
6. **Analytics**: Track section expansions, link clicks

## Troubleshooting

### Issue: Structured data not rendering
**Solution**: Check console for parsing logs, verify JSON format

### Issue: Providers not showing
**Solution**: Ensure provider objects have valid `name` field

### Issue: Images not loading
**Solution**: Check image URLs are valid, HTTPS preferred

### Issue: TypeScript errors after update
**Solution**: Rebuild common package: `cd apps/common && npm run build`

## Related Files

- **Types**: [apps/common/src/types.ts](../../common/src/types.ts)
- **Web Implementation**: [apps/webapp/src/components/chat/chat-message.tsx](../../webapp/src/components/chat/chat-message.tsx)
- **Markdown Styles**: [apps/mapp/lib/markdown-styles.ts](../lib/markdown-styles.ts)
- **Message Types**: [apps/common/src/types.ts](../../common/src/types.ts)

## Support

For issues or questions:
1. Check this README
2. Review web app implementation for reference
3. Check TypeScript type definitions
4. Review console logs for parsing details

---

**Last Updated**: 2025-01-03
**Version**: 2.0.0
**Platform**: React Native (Mobile)
