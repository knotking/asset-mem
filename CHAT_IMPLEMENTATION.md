# Chat Messages Implementation for Mobile App

## Overview
This document describes the implementation of chat messages functionality in the mobile app (mapp), allowing users to have conversations about their properties with an AI assistant.

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
  };
  documents?: {
    name: string;
    type: 'DEED' | 'INSURANCE_POLICY' | 'UTILITY_BILL' | 'INSPECTION_REPORT' | 'MORTGAGE_STATEMENT' | 'OTHER';
  }[];
  agentSteps?: AgentStep[];
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
Renders individual messages with:
- **Avatar**: User or Bot icon with different colors
- **Message bubble**: Different styles for user vs assistant
- **File previews**: Images, videos, and documents
- **Context documents**: Shows which documents were used
- **Agent steps**: Visual indicators of agent execution status
- **Loading state**: Shows "Thinking..." for incomplete assistant messages
- **Timestamps**: Formatted time for each message

#### ChatList (`apps/mapp/components/ChatList.tsx`)
Manages the message list:
- **Auto-scroll**: Scrolls to bottom when new messages arrive
- **Loading state**: Shows spinner while messages load
- **Empty state**: Welcoming message for new chats
- **ScrollView**: Scrollable container for all messages

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

✅ Real-time message loading from Firestore
✅ Message display with proper styling
✅ Send text messages
✅ Draft session claiming
✅ Auto-scroll to latest message
✅ Loading states and empty states
✅ Session selection and switching
✅ File and document display in messages
✅ Agent step indicators

## TODO: Future Enhancements

- [ ] **Agent Response Streaming**: Implement SSE connection to agent API
- [ ] **File Attachments**: Allow users to attach photos/videos to messages
- [ ] **Markdown Rendering**: Use react-native-markdown-display for rich text
- [ ] **Copy Message**: Long-press to copy message content
- [ ] **Message Actions**: Reply, react, or delete messages
- [ ] **Typing Indicators**: Show when assistant is typing
- [ ] **Message Search**: Search within conversation
- [ ] **Voice Messages**: Record and send audio messages
- [ ] **Push Notifications**: Notify when assistant responds
- [ ] **Offline Support**: Queue messages when offline
- [ ] **Message Retry**: Retry failed messages

## Environment Variables Required

```
EXPO_PUBLIC_AGENT_SSE_URL=<your-agent-streaming-endpoint>
```

## Files Created/Modified

### Created:
- `apps/common/src/contexts/messages-context.tsx` - Messages loading context
- `apps/mapp/components/ChatMessage.tsx` - Individual message component
- `apps/mapp/components/ChatList.tsx` - Message list component

### Modified:
- `apps/common/src/types.ts` - Added Message and AgentStep types
- `apps/mapp/app/(tabs)/home/property-details/index.tsx` - Integrated chat UI and send functionality

## Notes

- Messages are loaded in real-time using Firestore onSnapshot listeners
- Currently only user messages are sent (assistant responses need agent API integration)
- The chat automatically claims draft sessions on first message
- All messages are persisted in Firestore for history
- The UI is designed to be similar to the webapp implementation but optimized for mobile
