# Checkpoint Session Auto-Renaming

## Overview

When a checkpoint agent response is received, the session is automatically renamed using the title from the agent's response. This provides better context and makes sessions more discoverable.

## Implementation

### How It Works

1. **Checkpoint Agent Response Format**: Checkpoint agents (both `checkpoint_agent` and `checkpoint_analysis_agent`) return responses in dual format:
   - Markdown text (for display)
   - JSON code block with structured data (for parsing)

2. **Title Extraction**: The JSON structure contains an `analysis.title` field:
   ```json
   {
     "analysis": {
       "title": "Kitchen Checkpoint Comparison",
       "checkpointSummary": { ... },
       ...
     }
   }
   ```

3. **Session Renaming**: When the response is complete, the title is extracted and used to update the session name in Firestore.

### Files Modified

#### Webapp (`apps/webapp`)

1. **`src/lib/utils.ts`**
   - Added `extractCheckpointTitle()` function to parse checkpoint responses and extract the title

2. **`src/app/home/properties/[propertyId]/chat/[sessionId]/page.tsx`**
   - Import `extractCheckpointTitle` utility
   - After receiving checkpoint agent response, extract title and update session name
   - Added logic in the `handleSend` callback after `addMessageToFirestore`

#### Mobile App (`apps/mapp`)

1. **`lib/utils.ts`**
   - Created new file with `extractCheckpointTitle()` function (same implementation as webapp)

2. **`app/(tabs)/home/property-details/index.tsx`**
   - Import `extractCheckpointTitle` utility
   - Updated `onComplete` callback in `streamAgentResponse` to rename session
   - Added session renaming logic after message is saved

### Code Details

#### Title Extraction Logic

```typescript
export function extractCheckpointTitle(content: string): string | null {
  if (!content) return null;

  try {
    // Look for JSON code block in the response
    const jsonMatch = content.match(/```json\s*\n?([\s\S]*?)```/);
    if (!jsonMatch) return null;

    const jsonStr = jsonMatch[1].trim();
    const parsed = JSON.parse(jsonStr);

    // Check for checkpoint-specific fields to confirm this is a checkpoint response
    const analysis = parsed.analysis || parsed;
    const hasCheckpointData = !!(
      analysis.checkpointSummary ||
      analysis.checkpointDetails
    );

    if (!hasCheckpointData) return null;

    // Extract title from analysis.title
    if (analysis.title && typeof analysis.title === 'string') {
      return analysis.title.trim();
    }

    return null;
  } catch (error) {
    // Failed to parse JSON or extract title
    return null;
  }
}
```

#### Session Renaming (Webapp)

```typescript
// Check if this is a checkpoint agent response and rename session if needed
if (primaryAgent === 'checkpoint' && finalAssistantResponse.trim()) {
  const checkpointTitle = extractCheckpointTitle(finalAssistantResponse);
  if (checkpointTitle) {
    try {
      const sessionRef = doc(db, 'users', user.uid, 'chats', activeSessionId);
      await updateDoc(sessionRef, {
        name: checkpointTitle,
        updatedAt: serverTimestamp(),
      });
      console.log('Session renamed to:', checkpointTitle);
    } catch (error) {
      console.error('Failed to rename session:', error);
      // Don't show error to user as this is not critical
    }
  }
}
```

#### Session Renaming (Mobile App)

```typescript
onComplete: async (finalResponse) => {
  updateDoc(assistantMessageRef, {
    content: finalResponse,
    primaryAgent,
  }).catch((err) => console.error('Error completing message:', err));

  // Check if this is a checkpoint agent response and rename session if needed
  if (primaryAgent === 'checkpoint' && finalResponse.trim()) {
    const checkpointTitle = extractCheckpointTitle(finalResponse);
    if (checkpointTitle) {
      try {
        const sessionRef = doc(db, 'users', user.uid, 'chats', agentSessionId);
        await updateDoc(sessionRef, {
          name: checkpointTitle,
          updatedAt: serverTimestamp(),
        });
        console.log('Session renamed to:', checkpointTitle);
      } catch (error) {
        console.error('Failed to rename session:', error);
        // Don't show error to user as this is not critical
      }
    }
  }
},
```

## Behavior

### When Renaming Occurs

- **Trigger**: Only when `primaryAgent === 'checkpoint'`
- **Timing**: After the complete response is received and saved to Firestore
- **Condition**: Only if a valid checkpoint title is extracted from the response

### Title Examples

Based on the checkpoint agent prompts, titles are generated to be concise and descriptive:

- "Kitchen Checkpoint Comparison"
- "Kitchen & Bathroom Checkpoint Analysis"
- "Property Condition Assessment"
- "Maintenance Recommendations"
- "Bathroom Condition Comparison"
- "Kitchen Checkpoint History"

### Error Handling

- If title extraction fails, the session name remains unchanged
- Errors are logged but not shown to the user (non-critical operation)
- The session renaming happens asynchronously and doesn't block the UI

## Benefits

1. **Better Context**: Sessions are automatically named with meaningful titles
2. **Improved Discoverability**: Users can quickly identify checkpoint-related sessions
3. **Consistent Naming**: Titles follow the same format as the agent's analysis
4. **Automatic**: No manual intervention required from users

## Testing

To test this feature:

1. Create a new chat session
2. Select checkpoint as the primary agent
3. Select one or more checkpoints
4. Send a query (e.g., "What changed in my kitchen?")
5. Wait for the response
6. Check the session name in the sidebar - it should be updated to the title from the response

## Notes

- The feature only applies to checkpoint agent responses (not analysis or other agents)
- The session name is updated in Firestore, triggering real-time updates in the UI
- The `updatedAt` timestamp is also updated when renaming occurs
- The feature works identically in both webapp and mobile app
