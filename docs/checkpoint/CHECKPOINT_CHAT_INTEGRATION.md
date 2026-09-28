> **Archived (May 2026):** Historical checkpoint docs. Current behavior: `gcp/agents/homecare/property_agent/checkpoint/` and [property_agent/ARCHITECTURE.md](../../gcp/agents/homecare/property_agent/ARCHITECTURE.md).

# Checkpoint Integration in AI Chat

## Overview
Successfully integrated checkpoint functionality into the webapp's AI chat interface, matching the mobile app's implementation.

## Implementation Date
December 28, 2025

## Features Implemented

### 1. Primary Agent Selection
- Added agent switcher in the chat input area
- Two chat modes (`primary_agent`):
  - **`docs`**: Document Q&A via `user_docs_retrieval`
  - **`checkpoint`**: Timeline queries and optional analysis via `run_checkpoint_pipeline`

### 2. Checkpoint Selection UI
- **CheckpointDrawer Component** (`src/components/checkpoints/checkpoint-drawer.tsx`):
  - Side panel (Sheet) for selecting checkpoints
  - Displays all available checkpoints for the property
  - Shows checkpoint name, location, date, and AI analysis summary
  - Multi-select functionality with visual feedback
  - Empty state for properties without checkpoints
  - Instructional text explaining how checkpoints provide context

### 3. Chat Input Enhancements
- Updated `ChatInput` component to support:
  - Primary agent selection (docs vs checkpoint)
  - Display of selected checkpoints as removable badges/chips
  - "Select checkpoints for context" button when no checkpoints are selected
  - "Add more" link when checkpoints are already selected
  - Conditional display of optional agents (checkpoint mode)

### 4. Backend Integration
- Updated API request payload to include:
  - `primary_agent`: `docs` or `checkpoint`
  - `checkpoint_ids`: Array of selected checkpoint IDs
- Backend can now use checkpoint data to answer property timeline questions

### 5. Smart Auto-Selection
- When user switches to Checkpoint agent, all checkpoints are automatically selected
- User can then deselect or add specific checkpoints as needed
- Similar to mobile app behavior

## Files Modified

### New Files
1. `/apps/webapp/src/components/checkpoints/checkpoint-drawer.tsx` - Checkpoint selection drawer

### Modified Files
1. `/apps/webapp/src/lib/types.ts`:
   - Added `PrimaryAgent` type

2. `/apps/webapp/src/components/chat/chat-input.tsx`:
   - Added primary agent selection UI
   - Added checkpoint display and management
   - Conditional rendering based on selected agent

3. `/apps/webapp/src/app/home/properties/[propertyId]/chat/[sessionId]/page.tsx`:
   - Added checkpoint state management
   - Integrated CheckpointDrawer component
   - Updated API request to include checkpoint data
   - Added auto-selection logic

## User Experience

### Selecting Checkpoints
1. User navigates to property chat
2. Clicks on "Checkpoints" agent button
3. All checkpoints automatically selected (or clicks "Select checkpoints for context")
4. CheckpointDrawer opens showing all available checkpoints
5. User can toggle checkpoints on/off
6. Selected checkpoints appear as chips below the agent selector
7. User can remove individual checkpoints via X button on chips
8. User can add more checkpoints by clicking "+ Add more"

### Querying with Checkpoints
1. With checkpoints selected, user asks questions like:
   - "What changed between the first and last checkpoint?"
   - "Show me the condition trends over time"
   - "What issues were detected in the kitchen?"
2. Backend uses checkpoint context to provide timeline-aware answers

## Technical Details

### State Management
- `primaryAgent`: 'analysis' | 'checkpoint'
- `selectedCheckpoints`: Array of Checkpoint objects
- `isCheckpointDrawerOpen`: Boolean for drawer visibility

### API Payload
```typescript
{
  user_id: string,
  session_id: string,
  user_query: string,
  property_id: string,
  primary_agent: 'analysis' | 'checkpoint',
  checkpoint_ids?: string[], // Only when checkpoints are selected
  analysis_optional_agents: AnalysisOptionalAgent[], // Only for analysis agent
  // ... other fields
}
```

### Component Hierarchy
```
PropertyChatSessionPage
├── ChatContextHeader
├── ChatList
├── ChatInput (with checkpoint props)
└── CheckpointDrawer
```

## Backward Compatibility
- Fully backward compatible with existing chat functionality
- Analysis agent works exactly as before
- No breaking changes to existing APIs
- Checkpoint data structure matches mobile app (shared via @asset-mem/common)

## Testing Recommendations
1. Test agent switching (Analysis ↔ Checkpoint)
2. Test checkpoint selection and deselection
3. Test auto-selection behavior
4. Test checkpoint removal via chips
5. Test empty state (property with no checkpoints)
6. Test API payload includes correct checkpoint_ids
7. Test backend responses with checkpoint context

## Future Enhancements
- Add checkpoint filtering in drawer (by date, location, condition)
- Show checkpoint thumbnails in selection drawer
- Add checkpoint comparison from chat
- Support checkpoint creation from chat
- Show checkpoint timeline visualization in chat

## Related Features

### Checkpoint AI Chat Analysis (January 2026)

The checkpoint chat integration has been extended with comprehensive analysis capabilities:

- **Coverage Analysis**: Check warranty/insurance for checkpoint issues
- **DIY Solutions**: Get repair guides and product recommendations
- **Service Providers**: Find local professionals for detected issues
- **Cost Estimates**: Compare DIY vs professional repair costs

See [Property Agent Architecture](../../gcp/agents/homecare/property_agent/ARCHITECTURE.md) and [Checkpoint Analysis API](./CHECKPOINT_ANALYSIS_API.md) for complete details.

## Notes
- Implementation matches mobile app patterns for consistency
- Uses shadcn/ui Sheet component for drawer (web equivalent of mobile drawer)
- Respects existing chat patterns and conventions
- All TODOs completed successfully
