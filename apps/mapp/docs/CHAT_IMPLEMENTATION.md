# Chat Messages Implementation for Mobile App

## Overview
This document describes the implementation of chat messages functionality in the mobile app (mapp), allowing users to have conversations about their properties with an AI assistant.

> **Note**: This app now uses `react-native-gifted-chat` for the chat UI. See [GIFTED_CHAT_MIGRATION.md](../GIFTED_CHAT_MIGRATION.md) for migration details.

## Architecture

### 1. Message Types (`@homeapp/common/types.ts`)

```typescript
export type AgentStep = {
  name: string;
  status: 'transferredto' | 'executing' | 'completed' | 'failed';
};

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Timestamp | Date;
  followUpQuestions?: string[];
  file?: {
    name: string;
    type: string;
    url: string;
    gsURI?: string;
    width?: number;  // Image dimensions for aspect ratio preservation
    height?: number;
  };
  documents?: {
    name: string;
    type: 'DEED' | 'INSURANCE_POLICY' | 'UTILITY_BILL' | 'INSPECTION_REPORT' | 'MORTGAGE_STATEMENT' | 'OTHER';
  }[];
  agentSteps?: AgentStep[];
};

export type ServiceProvider = {
  name: string;
  website?: string;
  link?: string;
  directions?: string;
  contact_info?: string;
  location?: string;
  ratings?: string;
  reviews?: string;
  specialties?: string;
  additional_information?: string;
  authorized?: string;
};

export type Product = {
  product_name?: string;
  description?: string;
  vendor?: string;
  price?: string;
  item_price?: string;
  rating?: string;
  reviews?: string;
  url?: string;
  image_url?: string;
};

export type StructuredResponseData = {
  title?: string;
  analysis?: {
    title?: string;
    triageResult?: {
      diagnosis?: string;
      needs_clarification?: boolean;
      clarification_questions?: string[];
      message?: string;
    };
    coverageResult?: {
      warrantyInfo?: string;
      insuranceInfo?: string;
    };
    diyResults?: {
      diySteps?: {
        summary?: string;
        steps?: Array<{ description: string }>;
      };
      youtubeSearch?: {
        videos?: Array<{ url: string; title?: string; description?: string }>;
      };
      recommendedProducts?: {
        products?: Product[];
      };
    };
    serviceResults?: {
      providers?: any;
      localPros?: {
        googleSearchResults?: any;
        serpAPIResults?: any;
      };
      localProviders?: any;
      local_pros?: any;
      results?: any;
      nearbyProviders?: any;
    };
    costEstimationResults?: {
      costEstimates: any;
    };
  };
};
```

### 2. Messages Context (`@homeapp/common/contexts/messages-context.tsx`)

Provides real-time message loading for a session:
- `messages`: Array of messages for the current session
- `isLoading`: Loading state
- `error`: Error message if any

The context:
- Listens to Firestore for real-time message updates
- Orders messages by creation time (ascending)
- Limits to 100 messages per session
- Automatically cleans up on unmount

### 3. Components

#### ChatMessage (`apps/mapp/components/ChatMessage.tsx`)
The main message rendering component with comprehensive features:

**Core Features:**
- **Avatar**: User or Bot icon with different colors
- **Message bubble**: Different styles for user vs assistant
- **Markdown rendering**: Full markdown support with custom styles using `react-native-markdown-display`
- **File previews**: Images with aspect ratio preservation, videos with controls, and document icons
- **Typing indicators**: Shows animated typing dots when assistant is processing
- **Agent steps**: Visual indicators showing agent execution status
- **Timestamps**: Formatted time for each message
- **Long-press menu**: Context menu with copy and share options
- **Haptic feedback**: Touch feedback for interactions

**Structured Response Rendering:**
When the assistant returns structured data (JSON format), the component renders an accordion-based UI with:

1. **Triage Summary** (Stethoscope icon, blue)
   - Primary diagnosis or problem assessment
   - Clarification questions when more info is needed
   - Markdown-formatted detailed explanation

2. **Coverage Analysis** (Shield icon, green)
   - Warranty information
   - Insurance coverage details
   - Policy recommendations

3. **DIY Recommendations** (Wrench icon, yellow)
   - Step-by-step instructions
   - Embedded YouTube video tutorials with `react-native-youtube-iframe`
   - Recommended products with:
     - Product images with loading states and error handling
     - Pricing and ratings
     - Vendor information
     - Direct purchase links

4. **Service Recommendations** (Users icon, indigo)
   - Service provider cards with:
     - Business name and authorization badges
     - Star ratings and review counts
     - Contact information (phone, address)
     - SerpAPI/Google Search integration for reviews
     - Google Maps directions
     - Specialties and additional info

5. **Cost Estimates** (Dollar icon, purple)
   - DIY cost breakdown with complexity ratings
   - Professional service cost ranges
   - Comparison analysis with savings calculations
   - What's included in each option

**Message Content Extraction:**
The component intelligently parses assistant messages that contain both markdown and JSON:
- Extracts structured data from code blocks (```json ... ```)
- Preserves markdown content for display
- Handles various formats (nested analysis objects, flat structures)
- Strips wrapper code blocks for clean display

**File Preview Component:**
- **Images**: Aspect ratio preservation, lazy loading with skeleton, error fallback
- **Videos**: `expo-video` player with controls, Picture-in-Picture support
- **Documents**: Icon with filename display

**Copy/Share Functionality:**
- Long-press message to show context menu
- **Copy**: Converts markdown to WhatsApp-formatted text, copies to clipboard with haptic feedback
- **Share**: Uses native share sheet with formatted text
- Success/error alerts with auto-dismiss

#### GiftedChat Integration
> **Replaced ChatList**: The app now uses `react-native-gifted-chat` for message list management.

**GiftedChatBubble** (`apps/mapp/components/GiftedChatBubble.tsx`)
- Wraps the existing `ChatMessage` component
- Transforms GiftedChat's IMessage format to our Message type
- Preserves all existing UI and functionality

**GiftedChatInputToolbar** (`apps/mapp/components/GiftedChatInputToolbar.tsx`)
- Custom input toolbar with all features:
  - File attachments (camera, video, library)
  - Optional agent toggles
  - Document context display
  - Send/Stop buttons
  - Dark mode support

### 4. Integration in Property Details

The chat is integrated into the property details screen ([property-details/index.tsx](apps/mapp/app/(tabs)/home/property-details/index.tsx)):

**Key features:**
- **Session management**: Auto-selects draft session when property loads
- **Tab switching**: Toggle between Details and AI Chat tabs
- **Message sending**: Input bar at bottom for typing messages
- **Real-time updates**: Messages appear instantly via Firestore listeners

**State management:**
```typescript
const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
const [message, setMessage] = React.useState('');
const [isSending, setIsSending] = React.useState(false);
```

### 5. Message Sending Flow

1. **Draft Session Claiming**: First message in a draft session converts it to a named session
2. **User Message**: Message is added to Firestore with timestamp
3. **UI Update**: Message clears from input, keyboard dismisses
4. **Real-time Sync**: MessagesContext picks up the new message automatically

```typescript
const handleSendMessage = async () => {
  // Check if draft session needs claiming
  if (sessionDoc.data().name === 'draft') {
    await updateDoc(sessionRef, {
      name: message.substring(0, 30),
      propertyId: id,
    });
  }

  // Add message to Firestore
  await addDoc(collection(db, 'users', user.uid, 'chats', sessionId, 'messages'), {
    role: 'user',
    content: message,
    createdAt: serverTimestamp(),
  });
};
```

## Data Flow

```
User types message → Press send → handleSendMessage()
                                       ↓
                               Claim draft session (if needed)
                                       ↓
                               Add message to Firestore
                                       ↓
                               Clear input field
                                       ↓
                    MessagesContext listener triggers
                                       ↓
                    ChatList re-renders with new message
                                       ↓
                         Auto-scroll to bottom
```

## Firestore Structure

```
users/
  {userId}/
    chats/
      {sessionId}/
        - name: string
        - propertyId: string | null
        - agentSessionId: string
        - createdAt: Timestamp
        - messageCount: number
        - lastMessageAt: Timestamp

        messages/
          {messageId}/
            - role: 'user' | 'assistant'
            - content: string
            - createdAt: Timestamp
            - file?: {...}
            - documents?: [...]
            - agentSteps?: [...]
```

## UI Components

### Chat Input Bar
- **Attachment button**: Paperclip icon (currently disabled)
- **Text input**: Multiline with max height of 100px
- **Send button**:
  - Enabled when message has content
  - Shows loading spinner while sending
  - Primary color when enabled, secondary when disabled

### Message Bubbles
- **User messages**: Right-aligned with primary background
- **Assistant messages**: Left-aligned with secondary background
- **Timestamps**: Below each message in small muted text

## Features Implemented

### Core Messaging
✅ Real-time message loading from Firestore with listeners
✅ Message display with proper styling and animations
✅ Send text messages with server timestamps
✅ Draft session claiming on first message
✅ Auto-scroll to latest message
✅ Loading states with typing indicators
✅ Session selection and switching
✅ Agent step indicators with status visualization

### Rich Content
✅ **Markdown Rendering**: Full markdown support with custom styles
✅ **File Attachments**: Camera, video, and library picker integration
✅ **Image Previews**: Aspect ratio preservation, lazy loading with skeletons
✅ **Video Playback**: Expo-video player with controls and PiP support
✅ **YouTube Embeds**: Inline video players for tutorial content
✅ **Document Icons**: Visual indicators for file attachments

### Structured Responses
✅ **Accordion UI**: Collapsible sections for organized content
✅ **Triage Summary**: Problem diagnosis and clarification handling
✅ **Coverage Analysis**: Warranty and insurance information display
✅ **DIY Recommendations**: Step-by-step instructions with videos and products
✅ **Service Provider Cards**: Business listings with ratings, contact info, and directions
✅ **Product Cards**: E-commerce style product display with images and pricing
✅ **Cost Estimates**: Detailed breakdowns for DIY vs professional service options

### User Experience
✅ **Copy Message**: Long-press to copy with WhatsApp-style formatting
✅ **Share Message**: Native share sheet integration
✅ **Haptic Feedback**: Touch feedback for all interactions
✅ **Context Menu**: Modal with copy/share actions
✅ **Error Handling**: Graceful fallbacks for image/video loading failures
✅ **Dark Mode**: Full theming support across all components

## TODO: Future Enhancements

- [ ] **Agent Response Streaming**: Implement SSE connection to agent API for real-time responses
- [ ] **Message Actions**: Reply, react, or delete messages
- [ ] **Message Search**: Search within conversation history
- [ ] **Voice Messages**: Record and send audio messages
- [ ] **Push Notifications**: Notify when assistant responds
- [ ] **Offline Support**: Queue messages when offline and sync when online
- [ ] **Message Retry**: Retry failed messages with error indicators
- [ ] **Message Editing**: Edit sent messages within a time window
- [ ] **Pagination**: Load older messages on scroll
- [ ] **Message Reactions**: Quick emoji reactions to messages

## Environment Variables Required

```
EXPO_PUBLIC_AGENT_SSE_URL=<your-agent-streaming-endpoint>
```

## Dependencies

### Core Dependencies
- `react-native-gifted-chat` - Main chat UI framework
- `react-native-markdown-display` - Markdown rendering with custom styles
- `expo-image` - Optimized image loading with caching and transitions
- `expo-video` - Video playback with native controls
- `react-native-youtube-iframe` - YouTube video embeds
- `expo-clipboard` - Copy to clipboard functionality
- `expo-haptics` - Haptic feedback for interactions
- `lucide-react-native` - Icon library

### UI Components (from local UI library)
- `Accordion` - Collapsible sections for structured responses
- `Button`, `Text`, `Icon` - Styled base components
- `Alert` - Status messages for copy/share feedback
- `Skeleton` - Loading placeholders for images

## Files Created/Modified

### Created:
- `apps/common/src/contexts/messages-context.tsx` - Messages loading context with real-time listeners
- `apps/mapp/components/ChatMessage.tsx` - Individual message component with structured response rendering
- `apps/mapp/components/GiftedChatBubble.tsx` - GiftedChat bubble wrapper
- `apps/mapp/components/GiftedChatInputToolbar.tsx` - Custom input toolbar with attachments
- `apps/mapp/components/TypingIndicator.tsx` - Animated typing indicator
- `apps/mapp/components/AgentStatus.tsx` - Agent step visualization
- `apps/mapp/lib/gifted-chat-utils.ts` - Message transformation utilities
- `apps/mapp/lib/markdown-styles.ts` - Custom markdown styling
- `apps/mapp/lib/utils.ts` - Utility functions including `markdownToWhatsapp` converter

### Modified:
- `apps/common/src/types.ts` - Added Message, AgentStep, ServiceProvider, Product, and StructuredResponseData types
- `apps/mapp/app/(tabs)/home/property-details/index.tsx` - Integrated GiftedChat UI

### Removed:
- ~~`apps/mapp/components/ChatList.tsx`~~ - Replaced by react-native-gifted-chat

## Implementation Details

### Message Content Parsing
The `ChatMessage` component includes sophisticated content parsing logic:

1. **Content Extraction** (`extractContentParts` function):
   - Detects and parses JSON code blocks within assistant messages
   - Supports multiple formats: ````markdown ... ``` ```json ... ````, ````json ... ````, or plain JSON
   - Validates structured data by checking for specific keys (triageResult, coverageResult, diyResults, etc.)
   - Preserves markdown content separate from structured data

2. **Structured Data Keys**:
   - Supports both nested (`analysis.triageResult`) and flat (`triageResult`) structures
   - Handles various provider array locations (providers, localPros, googleSearchResults, etc.)

3. **Provider Normalization**:
   - Maps multiple field name variations (name/business_name/businessName/title/company)
   - Filters out invalid or empty providers
   - Normalizes URLs with protocol handling

### Helper Functions
The component includes several utility functions moved outside components for performance:

- **`hasValue(val)`**: Validates if a value exists and is not a placeholder (N/A, null, none, etc.)
- **`normalizeProvider(p)`**: Converts various provider data formats into standardized ServiceProvider type
- **`providerHasValidData(provider)`**: Checks if provider has minimum required data (name)
- **`getProvidersArray(providers)`**: Extracts provider arrays from various nested structures
- **`getYouTubeVideoId(url)`**: Extracts 11-character video ID from YouTube URLs
- **`normalizeUrl(u)`**: Adds https:// protocol and validates URL format
- **`hasStructuredDataKeys(parsed)`**: Validates if parsed JSON contains expected structured data keys
- **`getPreviewText(value, max)`**: Generates truncated preview text from markdown (max 240 chars)

### Performance Optimizations
- **React.memo**: All sub-components wrapped for render optimization (MessageAvatar, ProductCard, YouTubeEmbed, ServiceProviderCard, StructuredResponse, MessageContent, FilePreview)
- **useMemo**: Expensive computations cached (provider arrays, dimensions, content parsing, section visibility flags)
- **useCallback**: Event handlers memoized to prevent re-renders (copy, share, long-press, link opening)
- **Lazy Loading**: Images load with skeleton placeholders using expo-image transitions
- **Image Caching**: Expo-image configured with memory-disk cache policy for offline access
- **Conditional Rendering**: Accordion sections only render if they have data to display

### UI/UX Patterns

**Message Display:**
- User messages: Right-aligned with muted background (`bg-muted`)
- Assistant messages: Left-aligned with secondary background (`bg-secondary`)
- Full-width content for structured responses
- Natural text width for simple text messages

**Interaction Patterns:**
- Long-press (500ms) to open context menu
- Haptic feedback on menu open (light impact)
- Success haptic on successful copy (notification)
- Error haptic on copy failure (notification)
- Modal overlay for context menu with blur background
- Touch outside modal to dismiss

**Loading States:**
- Typing indicator (3 animated dots) for simple assistant thinking
- Agent status component when agent steps are available
- Image skeleton with animated pulse during image load
- "Image unavailable" fallback with file icon

**Visual Hierarchy:**
- Accordion default opens on "triage" section (most important)
- Color-coded sections (blue=triage, green=coverage, yellow=DIY, indigo=service, purple=cost)
- Icon indicators for each section type
- Authorization badges for verified providers
- Star ratings with warning color for visibility

### Accessibility
- Haptic feedback for all interactive elements (copy, share, link navigation)
- Error states with clear messaging and fallback UI
- Long-press for context menu with 500ms delay (not too sensitive)
- Auto-dismiss alerts after 2 seconds (non-intrusive)
- Proper text truncation with ellipsis (`numberOfLines` prop)
- Touch targets sized appropriately for mobile (buttons, cards)
- Semantic color coding (success=green, warning=yellow, destructive=red)

## Example Structured Response Format

Assistant messages can include structured data for rich UI rendering:

```markdown
**Analysis Agent**: Here's what I found...

\```json
{
  "title": "Leaky Faucet Repair Options",
  "analysis": {
    "triageResult": {
      "diagnosis": "Your kitchen faucet has a worn O-ring causing the leak..."
    },
    "coverageResult": {
      "warrantyInfo": "Plumbing fixtures typically have a 1-year manufacturer warranty...",
      "insuranceInfo": "Standard homeowners insurance generally doesn't cover wear and tear..."
    },
    "diyResults": {
      "diySteps": {
        "summary": "This is a beginner-friendly repair...",
        "steps": [
          { "description": "Turn off water supply under sink" },
          { "description": "Remove faucet handle..." }
        ]
      },
      "youtubeSearch": {
        "videos": [
          { "url": "https://youtube.com/watch?v=...", "title": "How to Fix..." }
        ]
      },
      "recommendedProducts": {
        "products": [
          {
            "product_name": "Universal Faucet Repair Kit",
            "vendor": "Home Depot",
            "price": "$12.99",
            "rating": "4.5",
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
            "ratings": "4.8/5",
            "reviews": "127 reviews",
            "contact_info": "(555) 123-4567",
            "location": "123 Main St, City, ST",
            "link": "https://yelp.com/...",
            "directions": "https://maps.google.com/...",
            "authorized": "True"
          }
        ]
      }
    },
    "costEstimationResults": {
      "costEstimates": {
        "repair_type": "Faucet O-ring Replacement",
        "DIY": {
          "cost_range": "$10-$25",
          "complexity": "Easy",
          "savings": "70-85% compared to professional service"
        },
        "Service": {
          "cost_range": "$100-$150",
          "complexity": "Quick repair",
          "benefits": "Warranty on work, professional guarantee"
        }
      }
    }
  }
}
\```
```

The component automatically detects this format and renders the structured UI.

## Notes

- Messages are loaded in real-time using Firestore onSnapshot listeners
- Assistant responses with structured data are automatically parsed and rendered in accordion UI
- The chat automatically claims draft sessions on first message
- All messages are persisted in Firestore for history
- The UI is designed to be similar to the webapp implementation but optimized for mobile
- Image dimensions are stored in Firestore for instant aspect ratio calculations
- YouTube videos are embedded inline using the video ID extracted from URLs
- Service provider data supports multiple API sources (SerpAPI/Google Search, SERP, custom providers)
- The component gracefully handles missing or incomplete structured data sections
- Both nested (`analysis.*`) and flat (top-level) structured data formats are supported
