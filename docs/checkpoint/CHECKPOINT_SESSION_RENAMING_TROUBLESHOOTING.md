# Checkpoint Session Renaming - Troubleshooting Guide

## Issue: Session Not Renaming

If the session is not being renamed after a checkpoint agent response, follow these debugging steps:

### Step 1: Check Browser Console Logs

Open the browser console (F12) and look for these log messages:

#### Expected Success Flow:
```
[extractCheckpointTitle] Successfully extracted title: Kitchen Checkpoint Comparison
Session renamed to: Kitchen Checkpoint Comparison
```

#### Possible Error Messages:

1. **No JSON code block found**
   ```
   [extractCheckpointTitle] No JSON code block found in response
   ```
   **Cause**: The agent response doesn't contain a ```json code block
   **Solution**: Check if the checkpoint agent is returning the dual format (Markdown + JSON)

2. **No checkpoint data found**
   ```
   [extractCheckpointTitle] No checkpoint data found in JSON
   ```
   **Cause**: The JSON doesn't contain `checkpointSummary` or `checkpointDetails`
   **Solution**: Verify the response is actually from a checkpoint agent

3. **No title field found**
   ```
   [extractCheckpointTitle] No title field found in analysis
   ```
   **Cause**: The JSON structure doesn't have `analysis.title`
   **Solution**: Check the agent prompt to ensure it's generating the title field

4. **Error parsing response**
   ```
   [extractCheckpointTitle] Error parsing response: [error details]
   ```
   **Cause**: Invalid JSON in the response
   **Solution**: Check the agent's JSON output for syntax errors

### Step 2: Verify Agent Response Format

Check the "Final Assistant Response" debug logs in the console:

```
=== Final Assistant Response ===
Length: 2543
Has ```json: true
First 500 chars: # Kitchen Checkpoint Comparison...
Last 500 chars: ...}
```
================================
```

The response should:
- Have `Has ```json: true`
- Start with markdown (# Title)
- End with a ```json code block

### Step 3: Check Request Parameters

Verify the request includes checkpoint-related parameters:

#### Option 1: Primary Agent Set
```javascript
{
  primary_agent: "checkpoint",
  checkpoint_ids: ["abc123", "def456"],
  property_id: "prop123"
}
```

#### Option 2: Legacy Mode (Checkpoints Selected)
```javascript
{
  checkpoint_ids: ["abc123", "def456"],
  property_id: "prop123"
}
```

### Step 4: Verify Backend Routing

The backend should route to `checkpoint_agent` when:
1. `primary_agent === "checkpoint"` (highest priority), OR
2. `checkpoint_ids` are provided (legacy mode)

Check backend logs for agent routing decisions.

### Step 5: Manual Test

You can manually test the extraction function in the browser console:

```javascript
// Copy the agent response
const response = `# Kitchen Checkpoint Comparison

... markdown content ...

\`\`\`json
{
  "analysis": {
    "title": "Kitchen Checkpoint Comparison",
    "checkpointSummary": {
      "checkpointsAnalyzed": 2
    }
  }
}
\`\`\`
`;

// Test extraction
extractCheckpointTitle(response);
// Should log: "Kitchen Checkpoint Comparison"
```

### Step 6: Check Firestore Permissions

Verify the user has permission to update the session document:

```javascript
// Check if session update succeeds
const sessionRef = doc(db, 'users', user.uid, 'chats', sessionId);
await updateDoc(sessionRef, {
  name: 'Test Title',
  updatedAt: serverTimestamp(),
});
```

If this fails, check Firestore security rules.

### Step 7: Verify Session ID

Ensure the correct session ID is being used:

**Webapp:**
```javascript
console.log('Active Session ID:', activeSessionId);
```

**Mobile App:**
```javascript
console.log('Agent Session ID:', agentSessionId);
```

The session ID should match the document ID in Firestore.

## Common Issues and Solutions

### Issue: Title extracted but session not updating

**Symptoms:**
- Console shows: `Successfully extracted title: [title]`
- But no "Session renamed to:" message

**Possible Causes:**
1. Firestore update failing silently
2. Session ID mismatch
3. Permission issues

**Solution:**
Add error logging to catch the issue:
```javascript
try {
  await updateDoc(sessionRef, { name: checkpointTitle, updatedAt: serverTimestamp() });
  console.log('Session renamed to:', checkpointTitle);
} catch (error) {
  console.error('Failed to rename session:', error);
}
```

### Issue: Response doesn't contain JSON

**Symptoms:**
- Console shows: `No JSON code block found in response`

**Possible Causes:**
1. Agent prompt not being followed
2. Response truncated
3. Backend parsing issue

**Solution:**
1. Check the full response in console logs
2. Verify the checkpoint agent prompt includes the JSON requirement
3. Check if response is being truncated

### Issue: JSON missing title field

**Symptoms:**
- Console shows: `No title field found in analysis`

**Possible Causes:**
1. Agent not generating title
2. Incorrect JSON structure

**Solution:**
1. Review checkpoint agent prompt to ensure title generation
2. Check if `analysis.title` is present in the JSON
3. Verify the agent is following the dual format requirement

## Testing Checklist

- [ ] Create a new chat session
- [ ] Select "Checkpoint" as primary agent (or select checkpoints)
- [ ] Send a checkpoint query (e.g., "What changed in my kitchen?")
- [ ] Check browser console for extraction logs
- [ ] Verify session name updates in the sidebar
- [ ] Refresh page to confirm persistence

## Debug Mode

To enable verbose debugging, add this to your browser console:

```javascript
// Enable debug mode
localStorage.setItem('DEBUG_CHECKPOINT_RENAME', 'true');

// Disable debug mode
localStorage.removeItem('DEBUG_CHECKPOINT_RENAME');
```

Then add conditional logging in the code:

```javascript
if (localStorage.getItem('DEBUG_CHECKPOINT_RENAME')) {
  console.log('Full response:', finalAssistantResponse);
  console.log('Extracted title:', checkpointTitle);
  console.log('Session ID:', activeSessionId);
}
```

## Contact

If the issue persists after following these steps, provide:
1. Browser console logs
2. Sample agent response
3. Request parameters sent to backend
4. Firestore session document structure
