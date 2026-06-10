# Sessions Implementation for Mobile App

## Overview
This document describes the implementation of session management for properties in the mobile app (mapp). Sessions allow users to create and manage chat conversations related to specific properties.

## Architecture

### 1. Session Context (`apps/common/src/contexts/session-context.tsx`)
The session context provides:
- `sessionsByProperty`: Record of sessions organized by property ID
- `draftsByProperty`: Draft sessions for each property
- `globalDraft`: A global draft session not tied to any property
- `createPropertyDraftSession()`: Creates a new draft session for a property
- `createGlobalDraftSession()`: Creates a global draft session
- `isLoading`: Loading state for session data

**Key Features:**
- Real-time synchronization with Firestore using `onSnapshot`
- Automatic draft session creation for properties
- Sessions sorted by `lastMessageAt` or `createdAt` (most recent first)
- Automatic cleanup and organization of sessions by property

### 2. API Integration (`apps/mapp/lib/api.ts`)
The API module provides the following functions:

- `createAgentSession()`: Creates a new agent session on the backend
- `deleteAgentSession()`: Deletes an agent session from the backend
- `streamAgentResponse()`: Streams AI responses with SSE support
- `extractDocInfo()`: Analyzes documents using AI
- `postFileToAgent()`: Uploads files to the RAG system

**Configuration:**
Uses EAS build configuration via `Constants.expoConfig.extra`:
- `agentSessionUrl`: Backend URL for session management
- `agentSseUrl`: SSE endpoint for streaming responses
- `ragFileUploadUrl`: RAG file upload endpoint
- `documentAnalysisUrl`: Document analysis endpoint
- `webAppUrl`: Web app URL for sharing links

### 3. Components

#### SessionsList (`apps/mapp/components/SessionsList.tsx`)
A comprehensive session management component with advanced features:

**Display Features:**
- Session list with name, creation date, message count, and last activity
- Search functionality to filter sessions by name
- Draft sessions are hidden from the list (auto-managed)
- Empty state with helpful messaging

**Selection & Bulk Operations:**
- Selection mode with checkboxes
- Long-press to enter selection mode
- Select all / Clear all functionality
- Bulk delete with confirmation dialog

**Individual Session Actions:**
- **Share**: Create public read-only links with update support
- **Rename**: Update session names with validation
- **Delete**: Remove sessions with confirmation

**Share Feature Details:**
- Checks for existing share links
- Option to update existing share or create new
- Copies messages to `sharedChats` collection
- Generates shareable web URLs
- Copy link to clipboard functionality

#### SessionsDrawerContent (`apps/mapp/components/property-details/SessionsDrawerContent.tsx`)
Drawer content wrapper for the sessions list:
- Rendered inside `PushDrawer` on the property details screen
- Property name in header
- Safe area support
- Auto-closes drawer on session selection

### 4. Property Details Integration
The sessions feature is integrated via a drawer in the property details screen:
- Uses `PushDrawer` component for smooth slide-in animation
- Sessions button in the property details interface
- Drawer shows all sessions for the current property
- Integrates with GiftedChat for message display
- Auto-selects draft session when creating new chats

## Data Structure

### Session Type
```typescript
export type Session = {
  id: string;
  name: string;
  createdAt: Timestamp;
  agentSessionId?: string;
  propertyId?: string | null;
  messageCount?: number;
  lastMessageAt?: Timestamp;
}
```

## Setup Required

### Environment Variables
Configure via EAS build configuration in `app.config.js` or `eas.json`:
```javascript
{
  "extra": {
    "agentSessionUrl": "<your-agent-session-api-url>",
    "agentSseUrl": "<your-agent-sse-url>",
    "ragFileUploadUrl": "<your-rag-upload-url>",
    "documentAnalysisUrl": "<your-doc-analysis-url>",
    "webAppUrl": "<your-web-app-url>"
  }
}
```

### Provider Setup
The SessionProvider is added to the root layout in `apps/mapp/app/_layout.tsx`:
```tsx
<FirebaseProvider app={app} auth={auth} db={db} storage={storage}>
  <AuthProvider>
    <SessionProvider createAgentSession={createAgentSession}>
      <PropertiesListProvider>
        <DocumentUploadProvider>
          <Routes />
        </DocumentUploadProvider>
      </PropertiesListProvider>
    </SessionProvider>
  </AuthProvider>
</FirebaseProvider>
```

## Usage

### Viewing Sessions
1. Navigate to a property details page
2. Tap the "Sessions" button to open the sessions drawer
3. View all sessions for that property with search capability
4. Tap any session to open it in the chat interface

### Creating New Sessions
1. Open the sessions drawer
2. Tap "New Session" button
3. A draft session is claimed (or created if none exists)
4. Start chatting immediately

### Managing Sessions

#### Search
- Use the search input to filter sessions by name
- Search is case-insensitive and filters in real-time

#### Selection Mode
- Long-press any session to enter selection mode
- Tap sessions to select/deselect
- Use "Select all" to select all visible sessions
- Use "Clear all" to deselect all

#### Bulk Delete
1. Enter selection mode
2. Select multiple sessions
3. Tap "Delete (N)" button
4. Confirm deletion in the dialog
5. All selected sessions and their messages are permanently deleted

#### Individual Session Actions
Access via the three-dot menu on each session:

**Share:**
1. Tap "Share" in the menu
2. System checks for existing share link
3. Choose to create new or update existing
4. Copy the generated link to clipboard
5. Share link gives read-only access to the conversation

**Rename:**
1. Tap "Rename" in the menu
2. Enter new session name
3. Tap "Save" to update

**Delete:**
1. Tap "Delete" in the menu
2. Confirm deletion
3. Session and all messages are permanently removed

## Implemented Features
- ✅ Navigate to session chat view when a session is selected
- ✅ Implement session chat interface (GiftedChat integration)
- ✅ Allow renaming sessions
- ✅ Delete sessions (individual and bulk)
- ✅ Show session preview/last message
- ✅ Add filters/search for sessions
- ✅ Session sharing between users (public read-only links)
- ✅ Draft session management
- ✅ Real-time synchronization
- ✅ Selection mode with bulk operations

## Future Enhancements
- [ ] Session templates
- [ ] Session tags/categories
- [ ] Export session transcripts
- [ ] Session archiving
- [ ] Collaborative sessions (multi-user editing)

## Files Created/Modified

### Created:
- `apps/mapp/lib/api.ts` - API functions for sessions, streaming, and document analysis
- `apps/mapp/components/SessionsList.tsx` - Comprehensive sessions list with search, selection, and actions
- `apps/mapp/components/property-details/SessionsDrawerContent.tsx` - Drawer content for sessions list
- `apps/mapp/components/PushDrawer.tsx` - Drawer component for sessions UI
- `apps/common/src/contexts/session-context.tsx` - Session state management and real-time sync

### Modified:
- `apps/mapp/app/_layout.tsx` - Added SessionProvider with proper provider nesting
- `apps/mapp/app/(tabs)/home/property-details/index.tsx` - Integrated sessions drawer with GiftedChat

## Technical Details

### Firestore Structure
```
users/{userId}/
  └── chats/{sessionId}/
      ├── name: string
      ├── createdAt: Timestamp
      ├── updatedAt: Timestamp (optional)
      ├── agentSessionId: string (optional)
      ├── propertyId: string | null
      ├── messageCount: number (optional)
      ├── lastMessageAt: Timestamp (optional)
      └── messages/{messageId}/
          ├── text: string
          ├── createdAt: Timestamp
          ├── role: 'user' | 'assistant'
          ├── attachments: FileAttachment[] (optional)
          └── agentSteps: AgentStep[] (optional)

sharedChats/{shareId}/
  ├── originalUserId: string
  ├── originalSessionId: string
  ├── name: string
  ├── propertyId: string | null
  ├── createdAt: Timestamp
  ├── updatedAt: Timestamp
  └── messages/{messageId}/
      └── (same structure as above)
```

### Draft Session Behavior
- Draft sessions have `name: 'draft'`
- Automatically created for each property
- Hidden from the sessions list
- Auto-claimed when creating a new session
- Converted to regular session on first message
- New draft automatically created after claiming

### Share Links
- Creates snapshot in `sharedChats` collection
- Generates URL: `{webAppUrl}/share/chat/{shareId}` (legacy `/share/{shareId}` redirects)
- Read-only access for recipients
- Can update existing shares with latest messages
- Messages stored with ISO timestamp strings for sharing

## Notes
- Sessions are stored in Firestore under `users/{userId}/chats` collection
- Each session has an optional `propertyId` field to associate it with a property
- Draft sessions are automatically created and managed by the SessionContext
- The SessionContext automatically syncs with Firestore in real-time using `onSnapshot`
- Session deletion also removes the associated agent session on the backend
- Share functionality creates a separate collection for public access
- All dialogs use proper loading states and error handling
