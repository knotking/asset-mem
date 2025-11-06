# Sessions Implementation for Mobile App

## Overview
This document describes the implementation of session management for properties in the mobile app (mapp). Sessions allow users to create and manage chat conversations related to specific properties.

## Architecture

### 1. Session Context (`@homeapp/common/contexts/session-context.tsx`)
The session context provides:
- `sessionsByProperty`: Record of sessions organized by property ID
- `draftsByProperty`: Draft sessions for each property
- `globalDraft`: A global draft session not tied to any property
- `createPropertyDraftSession()`: Creates a new draft session for a property
- `createGlobalDraftSession()`: Creates a global draft session

### 2. API Integration (`apps/mapp/lib/api.ts`)
- `createAgentSession()`: Makes API call to create a new agent session
- Requires `EXPO_PUBLIC_AGENT_SESSION_URL` environment variable

### 3. Components

#### SessionsList (`apps/mapp/components/SessionsList.tsx`)
Displays a list of sessions for a specific property:
- Shows draft sessions with a "Draft" badge
- Shows regular sessions with creation date and message counts
- Provides a "New Session" button to create new sessions
- Empty state when no sessions exist

#### SessionsModal (`apps/mapp/components/SessionsModal.tsx`)
A modal that wraps the SessionsList component:
- Full-screen modal presentation
- Property name in header
- Close button
- Handles session selection and creation callbacks

### 4. Property Details Integration
The sessions feature is integrated into the property details screen:
- Sessions header button in the navigation bar (Clock icon)
- Tapping the header opens the SessionsModal
- Modal shows all sessions for the current property

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
Add to your `.env` or app configuration:
```
EXPO_PUBLIC_AGENT_SESSION_URL=<your-agent-session-api-url>
```

### Provider Setup
The SessionProvider is added to the root layout in `apps/mapp/app/_layout.tsx`:
```tsx
<SessionProvider createAgentSession={createAgentSession}>
  <PropertiesListProvider>
    <Routes />
  </PropertiesListProvider>
</SessionProvider>
```

## Usage

### Viewing Sessions
1. Navigate to a property details page
2. Tap the "Sessions" button in the header (Clock icon)
3. View all sessions for that property
4. Tap any session to open it (implementation pending)

### Creating New Sessions
1. Open the sessions modal
2. Tap "New Session" button
3. A new draft session is created (implementation pending)

## TODO: Future Enhancements
- [ ] Navigate to session chat view when a session is selected
- [ ] Implement session chat interface
- [ ] Allow renaming sessions
- [ ] Delete sessions
- [ ] Show session preview/last message
- [ ] Add filters/search for sessions
- [ ] Session sharing between users
- [ ] Session templates

## Files Created/Modified

### Created:
- `apps/mapp/lib/api.ts` - API functions for agent session creation
- `apps/mapp/components/SessionsList.tsx` - Sessions list component
- `apps/mapp/components/SessionsModal.tsx` - Modal wrapper for sessions

### Modified:
- `apps/mapp/app/_layout.tsx` - Added SessionProvider
- `apps/mapp/app/(tabs)/home/property-details/index.tsx` - Integrated sessions modal
- `apps/common/src/contexts/auth-context.tsx` - Fixed TypeScript types

## Notes
- Sessions are stored in Firestore under `users/{userId}/chats` collection
- Each session has an optional `propertyId` field to associate it with a property
- Draft sessions are automatically created for properties
- The SessionContext automatically syncs with Firestore in real-time
