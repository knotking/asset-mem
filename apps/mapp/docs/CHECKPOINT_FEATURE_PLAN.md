# Checkpoint Tab Feature Implementation Plan

## Overview
Add a new "Checkpoints" tab to the property details page that allows users to capture photos/videos at regular intervals, with AI analysis to identify and visualize changes over time. Includes comprehensive bidirectional integration with the AI Chat feature for natural language querying, conversational checkpoint creation, and proactive insights.

## Key Features Summary

### Core Checkpoint Features:
- 📸 Photo/video capture with existing camera integration
- 📊 Visual timeline view of all checkpoints
- 🔍 AI-powered analysis of each checkpoint (damage detection, condition assessment)
- ⚖️ Before/after comparison with interactive slider
- 📍 Location-based organization (kitchen, bathroom, exterior, etc.)
- 🏷️ Tagging system for categorization

### AI Chat Integration (Option C - Full Integration):
- 💬 **Natural Language Queries**: Ask questions like "What changed in my kitchen?" or "Show me roof damage"
- 🎯 **Conversational Creation**: Create checkpoints by saying "Take a checkpoint of my living room"
- 🔗 **Bidirectional Linking**: Messages and checkpoints reference each other with clickable links
- 🔔 **Proactive Notifications**: AI alerts you about significant changes or maintenance needs
- 📈 **Trend Analysis**: Agent provides insights on condition trends over time
- ⚡ **Quick Actions**: One-tap buttons to create checkpoints, compare, or view timeline from chat
- 🖼️ **Rich Previews**: See checkpoint thumbnails and comparisons inline in chat messages
- 🧠 **Context-Aware Agent**: Agent has full awareness of all property checkpoints for intelligent responses

### NotebookLM-Inspired Analytics:
- 🔍 **Enhanced Timeline**: Multi-scale zoom (year/month/week/day), event markers, color-coded severity, advanced filtering
- 🕸️ **Property Mind Map**: Visual graph showing relationships between locations and issues with interactive exploration
- ❓ **Smart FAQs**: Auto-generated questions and answers about your property that update dynamically
- 📊 **Professional Reports**: Generate PDF/Word reports for insurance, contractors, or property sales
- 👥 **Collaborative Features**: Share property with family, invite contractors with time-limited access
- 🔬 **Deep Research**: AI-powered research for maintenance solutions, costs, and contractor recommendations
- 🎧 **Audio Overviews**: Monthly property update podcasts with AI-generated audio summaries

## Phase 1: Core Data Models & Backend Setup

### 1.1 Create Checkpoint Type in `apps/common/src/types.ts`
```typescript
export type Checkpoint = {
  id: string;
  userId: string;
  propertyId: string;
  name: string; // e.g., "Monthly Inspection - Jan 2025"
  description?: string;
  createdAt: Timestamp;
  capturedAt?: Timestamp; // When the media was captured (vs when uploaded)
  media: CheckpointMedia[];
  location?: string; // e.g., "Kitchen", "Living Room", "Exterior"
  tags?: string[]; // e.g., ["monthly", "winter", "pre-storm"]
  aiAnalysis?: CheckpointAnalysis;
  comparisonWithPrevious?: CheckpointComparison;
}

export type CheckpointMedia = {
  id: string;
  url: string;
  gsURI: string;
  contentType: string;
  storagePath: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

export type CheckpointAnalysis = {
  summary: string;
  detectedItems: string[]; // e.g., ["furniture", "appliances", "flooring"]
  conditions: string[]; // e.g., ["good", "minor wear", "damage detected"]
  aiConfidence?: number;
  analyzedAt: Timestamp;
}

export type CheckpointComparison = {
  previousCheckpointId: string;
  differences: string[]; // AI-detected textual differences
  changeScore: number; // 0-100, how much changed
  addedItems: string[];
  removedItems: string[];
  comparedAt: Timestamp;
}
```

### 1.2 Update Property Type
Add checkpoint count to Property type:
```typescript
checkpoints?: number;
checkpointsCount?: number;
```

### 1.3 Firestore Collections
- Create `checkpoints` subcollection under each property
- Add indexes for sorting by `createdAt` and filtering by `location`

## Phase 2: UI Components - Checkpoints Tab

### 2.1 Create `PropertyCheckpointsTab.tsx`
New component at `apps/mapp/components/property-details/PropertyCheckpointsTab.tsx`

**Features:**
- **Timeline View** (Default): Vertical timeline showing checkpoints chronologically
  - Each checkpoint card shows: thumbnail, name, date, location, quick summary
  - Circle indicators on left margin
  - Color-coded by time periods (e.g., this month, last month, older)

- **Grid View** (Optional): Photo grid layout for visual browsing

- **Floating Action Button**: Quick capture button to create new checkpoint

### 2.2 Create `CheckpointCard.tsx`
Component at `apps/mapp/components/property-details/CheckpointCard.tsx`

**Features:**
- Thumbnail/preview image
- Checkpoint name & description
- Date/time with relative time (e.g., "2 days ago")
- Location tag/chip
- Change indicator (if differences detected)
- Tap to open detail modal

### 2.3 Create `CheckpointDetailModal.tsx`
Full-screen modal showing checkpoint details:

**Features:**
- **Media Gallery**: Swipeable carousel for multiple photos/videos
- **Before/After Slider**: Compare with previous checkpoint
  - Interactive slider component (similar to libraries found in research)
  - Overlay mode with opacity slider
  - Side-by-side view option
- **AI Analysis Section**:
  - Summary text
  - Detected items chips
  - Condition assessment
  - Change highlights (color-coded: added=green, removed=red, changed=orange)
- **Metadata**: Date, time, location, tags
- **Actions**: Edit, Delete, Share, Add to Report

### 2.4 Create `CheckpointCaptureModal.tsx`
Modal for creating new checkpoint:

**Features:**
- Reuse existing `CameraModal` component
- Add form fields: name, description, location, tags
- Multi-photo/video capture option
- Option to compare with specific previous checkpoint
- "Capture & Analyze" button triggers AI analysis

## Phase 3: State Management

### 3.1 Create CheckpointContext
New context at `apps/common/src/contexts/checkpoint-context.tsx`

**Provides:**
- `checkpoints: Checkpoint[]` - All checkpoints for current property
- `loading: boolean`
- `createCheckpoint(data)` - Create new checkpoint with media
- `updateCheckpoint(id, data)` - Update checkpoint details
- `deleteCheckpoint(id)` - Delete checkpoint
- `compareCheckpoints(id1, id2)` - Trigger AI comparison
- `selectedCheckpoint: Checkpoint | null` - For detail view
- `setSelectedCheckpoint(checkpoint)` - Open detail modal

### 3.2 Real-time Listeners
Subscribe to Firestore checkpoints subcollection with live updates

## Phase 4: AI Integration

### 4.1 Add API Functions to `apps/mapp/lib/api.ts`

**New Functions:**
```typescript
// Analyze single checkpoint media
analyzeCheckpointMedia(gsURI: string, userId: string): Promise<CheckpointAnalysis>

// Compare two checkpoints
compareCheckpoints(
  checkpointId1: string,
  checkpointId2: string,
  userId: string
): Promise<CheckpointComparison>
```

### 4.2 Backend Agent Integration
- Create new optional agent: `checkpoint` for analysis
- Agent capabilities:
  - Vision analysis of photos/videos
  - Object/item detection
  - Condition assessment
  - Change detection between images
  - Natural language summary generation

### 4.3 AI Processing Flow
1. User captures media → Upload to Firebase Storage
2. Call `analyzeCheckpointMedia` → Agent analyzes
3. Save analysis to Firestore
4. If previous checkpoint exists → Auto-compare
5. Update UI with results

## Phase 5: Advanced Features (Enhanced Checkpoint Capabilities)

Based on research, here are additional features to consider:

### 5.1 Smart Scheduling & Reminders
- Recurring checkpoint schedules (weekly, monthly, seasonal)
- Push notifications to remind users
- Weather-triggered checkpoints (e.g., after storms)
- Integration with calendar

### 5.2 Location-Based Organization
- Organize checkpoints by room/area
- 3D floor plan view with checkpoint markers (future)
- Filter timeline by location
- Per-location comparison view

### 5.3 Condition Tracking & Alerts
- Track condition scores over time (chart visualization)
- Alert on degradation trends
- Predictive maintenance suggestions
- Issue severity classification (minor, moderate, severe)

### 5.4 Annotation & Markup Tools
- Draw on images to highlight areas
- Add notes/pins to specific image regions
- Voice notes attached to checkpoints
- Collaborative annotations (share with contractors)

### 5.5 Reports & Export
- Generate PDF reports with checkpoint timeline
- Before/after comparison exports
- Share checkpoints with insurance/inspectors
- Export data as JSON/CSV

### 5.6 Seasonal Intelligence
- Automatically tag checkpoints by season
- Seasonal comparison view (e.g., Winter 2024 vs Winter 2025)
- Weather data integration (conditions during capture)

### 5.7 Video Analysis Enhancements
- Frame-by-frame analysis for videos
- Extract key frames automatically
- Motion detection (e.g., structural movement)
- 360° video support for panoramic checkpoints

### 5.8 Damage Detection & Assessment
- Automatic crack detection
- Water damage identification
- Mold detection
- Paint/surface degradation analysis
- Measurements from photos (using AR/computer vision)

### 5.9 Integration Features
- Link checkpoints to service requests
- Associate with insurance claims
- Export to property listing platforms
- Share with real estate agents

### 5.10 Gamification & Engagement
- Streaks for regular checkpoints
- Property health score (0-100)
- Maintenance achievements
- Comparison with similar properties

### 5.11 Full AI Chat Integration
Comprehensive bidirectional integration between checkpoints and AI Chat.

### 5.12 NotebookLM-Inspired Analytics & Intelligence
Advanced analytical features inspired by Google's NotebookLM to provide deeper property insights.

#### 5.11.1 Query Checkpoints from Chat
**User Experience:**
Users can naturally ask questions about checkpoints in the AI Chat tab:
- "What changed in my kitchen between January and March?"
- "Show me all checkpoints where damage was detected"
- "When was the last time I checked the roof?"
- "Compare the condition of my bathroom now vs 6 months ago"
- "What's the trend for my basement condition?"

**Implementation:**
- Pass checkpoint metadata to agent as context (similar to `docGsURIs`)
- Add checkpoint gsURIs to agent session when checkpoint queries detected
- Agent can access checkpoint images and analysis data

**Files to Modify:**
- `apps/mapp/components/property-details/PropertyChatTab.tsx` - Add checkpoint context
- Update `streamAgentResponse` to include checkpoint URIs

#### 5.11.2 Create Checkpoints from Chat
**User Experience:**
Users can create checkpoints via conversational requests:
- "Create a checkpoint for my living room"
- "Take a checkpoint of the exterior damage we just discussed"
- "Save this image as a checkpoint"

**Implementation:**
- Agent returns structured action: `{ type: 'create_checkpoint', location: 'Living Room' }`
- Chat UI intercepts action and opens `CheckpointCaptureModal`
- Pre-fill location/description based on chat context
- After capture, send confirmation back to chat

**New Types:**
```typescript
type AgentAction = {
  type: 'create_checkpoint' | 'view_checkpoint' | 'compare_checkpoints';
  data: {
    location?: string;
    description?: string;
    checkpointId?: string;
    compareIds?: string[];
  };
}
```

**Files to Modify:**
- `apps/mapp/components/property-details/PropertyChatTab.tsx` - Handle agent actions
- Backend agent - Return structured actions in response

#### 5.11.3 Link Chat Messages to Checkpoints
**User Experience:**
When users attach photos/videos in chat, AI suggests creating checkpoints:
- "I see you've shared a photo of your kitchen. Would you like to save this as a checkpoint?"
- Checkbox option: "Save as checkpoint" when uploading media in chat

**Implementation:**
- Add `linkedCheckpointId` field to Message type
- Display checkpoint badge on chat messages linked to checkpoints
- Tap badge to navigate to checkpoint detail
- When viewing checkpoint, show "Discussed in chat" with link back to message

**New Type Fields:**
```typescript
type Message = {
  // ... existing fields
  linkedCheckpointId?: string;
  suggestCheckpoint?: boolean; // AI suggests saving as checkpoint
}

type Checkpoint = {
  // ... existing fields
  linkedMessageIds?: string[]; // Messages that reference this checkpoint
  createdFromChat?: boolean; // Created via chat vs manual capture
}
```

**Files to Create:**
- `apps/mapp/components/property-details/CheckpointLinkBadge.tsx` - Badge UI in chat

**Files to Modify:**
- `apps/common/src/types.ts` - Add fields to Message and Checkpoint
- `apps/mapp/components/property-details/PropertyChatTab.tsx` - Handle media upload with checkpoint option

#### 5.11.4 Deep Links Between Chat and Checkpoints
**User Experience:**
Agent responses include clickable checkpoint references:
- "I found significant water damage in your [Kitchen Checkpoint - Jan 15](#checkpoint/abc123)"
- Tapping link navigates to checkpoint detail modal
- Back button returns to chat

**Implementation:**
- Agent returns markdown links with checkpoint:// protocol or anchor tags
- Chat message renderer detects checkpoint links
- Links trigger `setSelectedCheckpoint()` from CheckpointContext
- Navigation stack maintains chat → checkpoint → chat flow

**Files to Modify:**
- Chat message renderer - Parse and handle checkpoint links
- `apps/mapp/components/property-details/CheckpointDetailModal.tsx` - Support navigation origin tracking

#### 5.11.5 Proactive Checkpoint Notifications in Chat
**User Experience:**
Agent proactively mentions checkpoint insights in chat:
- "👀 I noticed significant changes in your basement checkpoint from yesterday. Would you like me to analyze?"
- "⏰ Reminder: It's been 30 days since your last exterior checkpoint"
- "📉 The condition score for your kitchen has declined from 85 to 72 over the past 3 months"
- "🎯 Based on your checkpoints, I recommend scheduling HVAC maintenance"

**Implementation:**
- Background jobs analyze new checkpoints
- When significant changes detected, create system message in chat
- System messages from agent with checkpoint insights
- User can tap to see details or dismiss

**New Type:**
```typescript
type SystemNotification = {
  type: 'checkpoint_alert' | 'checkpoint_reminder' | 'checkpoint_insight';
  checkpointId?: string;
  message: string;
  actionLabel?: string; // e.g., "View Details", "Analyze Now"
  actionType?: 'view' | 'analyze' | 'compare';
  dismissed?: boolean;
}
```

**Files to Create:**
- `apps/mapp/components/property-details/CheckpointNotificationCard.tsx` - Special message card for notifications

**Files to Modify:**
- Backend - Create notification generation service
- `apps/mapp/components/property-details/PropertyChatTab.tsx` - Render notification cards

#### 5.11.6 Checkpoint-Aware Agent Context
**Backend Enhancement:**
Enhance the checkpoint agent with property-wide context:

**Agent Context Includes:**
- All checkpoint summaries for the property
- Condition score trends
- Detected issues and their history
- Location-specific patterns
- Temporal patterns (seasonal, monthly)

**Agent Capabilities:**
- Answer comparative questions across multiple checkpoints
- Identify patterns and trends
- Provide predictive insights
- Generate maintenance recommendations
- Summarize property condition holistically

**API Function:**
```typescript
// Enhanced agent call with checkpoint context
streamAgentResponseWithCheckpoints({
  message: string,
  checkpointIds?: string[], // Specific checkpoints to focus on
  includeAllCheckpoints?: boolean, // Include all property checkpoints as context
  // ... other existing params
})
```

#### 5.11.7 Quick Actions from Chat
**User Experience:**
After chat discussions, quick action buttons appear:
- [📸 Create Checkpoint] - Opens capture modal with context
- [🔍 Compare Checkpoints] - Opens comparison view
- [📊 View Timeline] - Switches to Checkpoints tab

**Implementation:**
- Agent returns suggested actions in response
- Render action buttons below agent message
- Actions are context-aware based on conversation

**Files to Modify:**
- Chat message component - Render action buttons
- `apps/mapp/components/property-details/PropertyChatTab.tsx` - Handle action button clicks

#### 5.11.8 Checkpoint Data in Agent Response
**Enhancement:**
When agent discusses checkpoints, include rich data:

**Features:**
- Inline thumbnail previews of checkpoints
- Mini before/after sliders in chat
- Condition score badges
- Change indicators (↑ improved, ↓ declined, = stable)

**Implementation:**
- Agent returns structured checkpoint data
- Custom message renderer for checkpoint data
- Expandable cards for detailed view

**New Message Content Type:**
```typescript
type MessageContent =
  | { type: 'text', text: string }
  | { type: 'checkpoint_summary', checkpointIds: string[] }
  | { type: 'checkpoint_comparison', compareIds: string[] }
  | { type: 'condition_trend', location: string, scores: number[] }
```

#### 5.12.1 Enhanced Timeline Visualization
**User Experience:**
Multi-scale interactive timeline with advanced navigation and filtering.

**Features:**
- **Zoom Controls**: Year / Month / Week / Day view modes
- **Timeline Scrubbing**: Drag to quickly navigate through time periods
- **Event Markers**: Visual indicators for significant changes/events
- **Color-Coded Severity**:
  - Green: Good condition
  - Yellow: Attention needed
  - Orange: Deteriorating
  - Red: Urgent/critical
- **Filtering Options**:
  - By location (Kitchen, Bathroom, etc.)
  - By severity level
  - By checkpoint type (scheduled, incident, post-repair)
- **Timeline Export**: Export as PDF, PNG image, or shareable link

**Implementation:**
- Use React Native gesture handlers for smooth scrubbing
- Implement zoom state management (year/month/week/day)
- Create timeline marker components with icons and colors
- Add filter chips above timeline
- PDF generation using react-native-pdf-lib or similar

**New Components:**
- `TimelineZoomControls.tsx` - Zoom in/out buttons and current scale indicator
- `TimelineEventMarker.tsx` - Visual marker on timeline
- `TimelineFilterBar.tsx` - Filter chips for location/severity

**Files to Modify:**
- `PropertyCheckpointsTab.tsx` - Integrate zoom and filter controls

#### 5.12.2 Property Health Mind Map
**User Experience:**
Interactive graph visualization showing relationships between property issues and locations.

**⚠️ WEB-ONLY FEATURE**: This feature is designed for web application only due to complexity of graph rendering and better desktop interaction. Mobile app will show a "View on Web" link.

**Features:**
- **Central Node**: Property name/address
- **Location Branches**: Kitchen, Bathroom, Roof, Exterior, etc.
- **Issue Nodes**: Problems detected at each location
- **Relationship Lines**:
  - Solid lines: Direct relationship (e.g., same location)
  - Dashed lines: Potential cause-effect (e.g., roof leak → ceiling damage)
  - Color-coded by severity
- **Interactive** (Web):
  - Click node to see related checkpoints
  - Mouse wheel to zoom
  - Drag to pan and explore
  - Hover for node details
  - Drag nodes to rearrange layout
- **Issue Relationship Graph**: Shows how problems might be causally related
- **Export**: Share as PNG image or interactive web link

**Implementation:**
- **Web**: Use D3.js or React Flow for graph rendering
- **Mobile**: Show preview image + "View on Web" button with deep link
- Graph layout algorithm (force-directed or hierarchical)
- Data structure to represent graph relationships
- AI analysis to suggest causal relationships

**New Components:**
- `PropertyMindMap.tsx` - Main mind map view (web-only)
- `MindMapNode.tsx` - Individual node component (web-only)
- `MindMapEdge.tsx` - Connection line component (web-only)
- `MindMapLegend.tsx` - Explains node types and colors (web-only)
- `MindMapPreview.tsx` - Mobile preview with "View on Web" (mobile-only)

**New Types:**
```typescript
export type PropertyGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type GraphNode = {
  id: string;
  type: 'property' | 'location' | 'issue';
  label: string;
  severity?: 'good' | 'attention' | 'warning' | 'critical';
  checkpointIds: string[];
  position?: { x: number; y: number };
}

export type GraphEdge = {
  from: string;
  to: string;
  type: 'direct' | 'causal' | 'temporal';
  confidence?: number; // AI confidence in relationship
}
```

**Files to Create:**
- `apps/webapp/components/property-details/PropertyMindMap.tsx` - Web-only mind map view
- `apps/webapp/components/property-details/MindMapNode.tsx` - Web-only node component
- `apps/webapp/components/property-details/MindMapEdge.tsx` - Web-only edge component
- `apps/webapp/components/property-details/MindMapLegend.tsx` - Web-only legend
- `apps/webapp/utils/graphLayoutEngine.ts` - Web-only graph layout (D3.js/React Flow)
- `apps/mapp/components/property-details/MindMapPreview.tsx` - Mobile preview with "View on Web" link

#### 5.12.3 Smart FAQ Generation
**User Experience:**
Automatically generated frequently asked questions about the property based on checkpoint history.

**Features:**
- **Auto-Generated Questions**:
  - "When was the last time the HVAC was checked?"
  - "What maintenance is due this month?"
  - "Which areas show the most deterioration?"
  - "How does my property condition compare to last year?"
  - "What's the estimated cost for pending repairs?"
  - "Are there any recurring issues?"
- **Dynamic Updates**: FAQs refresh as new checkpoints are added
- **Categorized**: Group by maintenance, condition, history, costs
- **Voice-Activated**: Tap to ask question via voice in chat
- **Expandable Answers**: Tap FAQ to see detailed answer with relevant checkpoints
- **Share FAQs**: Export as document for insurance or contractors

**Implementation:**
- Backend AI generates FAQs from checkpoint summaries
- Periodic regeneration (weekly or after N new checkpoints)
- Store FAQs in Firestore with property
- Link FAQs to specific checkpoints for evidence

**New Type:**
```typescript
export type PropertyFAQ = {
  id: string;
  propertyId: string;
  question: string;
  answer: string;
  category: 'maintenance' | 'condition' | 'history' | 'costs' | 'predictions';
  relatedCheckpointIds: string[];
  confidence: number;
  generatedAt: Timestamp;
  popularity?: number; // Track which FAQs users view most
}
```

**New Component:**
- `PropertyFAQList.tsx` - Scrollable FAQ list
- `FAQItem.tsx` - Individual FAQ card with expand/collapse
- `FAQCategoryTabs.tsx` - Category filter tabs

**API Function:**
```typescript
generatePropertyFAQs(propertyId: string, userId: string): Promise<PropertyFAQ[]>
```

#### 5.12.4 Property Briefing Reports
**User Experience:**
Professional, exportable reports summarizing property condition and maintenance.

**Features:**
- **One-Tap Generation**: "Generate Report" button
- **Report Types**:
  - **Executive Summary**: High-level overview (1-2 pages)
  - **Detailed Inspection Report**: Comprehensive with all checkpoints
  - **Seasonal Report**: Focus on specific time period
  - **Issue-Specific Report**: Deep dive on particular problem
  - **Maintenance History**: All repairs and checkpoints chronologically
  - **Insurance Claim Report**: Damage documentation with before/after
- **Customizable Templates**:
  - Include/exclude sections
  - Add custom notes
  - Select date range
  - Choose checkpoints to include
- **Export Formats**:
  - PDF (primary)
  - Microsoft Word (.docx)
  - Email (formatted HTML)
  - Print-friendly
- **Professional Formatting**:
  - Cover page with property photo
  - Table of contents
  - Checkpoint photos with captions
  - Charts showing condition trends
  - Maintenance schedule
  - Recommendations section
  - Signature/date fields

**Implementation:**
- Template engine for different report types
- PDF generation library (react-pdf or similar)
- Chart generation for trends (react-native-chart-kit)
- Email integration for sending reports
- Storage of generated reports for re-access

**New Types:**
```typescript
export type PropertyReport = {
  id: string;
  propertyId: string;
  userId: string;
  title: string;
  type: 'executive' | 'detailed' | 'seasonal' | 'issue' | 'maintenance' | 'insurance';
  dateRange: { start: Timestamp; end: Timestamp };
  checkpointIds: string[];
  generatedAt: Timestamp;
  pdfUrl?: string;
  customNotes?: string;
  template: ReportTemplate;
}

export type ReportTemplate = {
  includeCoverPage: boolean;
  includeTOC: boolean;
  includePhotos: boolean;
  includeCharts: boolean;
  includeRecommendations: boolean;
  sections: string[]; // e.g., ['summary', 'timeline', 'by-location', 'recommendations']
}
```

**New Components:**
- `ReportGeneratorModal.tsx` - Report configuration UI
- `ReportPreview.tsx` - Preview before generating
- `ReportTemplateSelector.tsx` - Choose report type
- `ReportCustomizer.tsx` - Customize sections and options

**API Function:**
```typescript
generatePropertyReport(config: ReportConfig): Promise<{ reportId: string; pdfUrl: string }>
```

**Files to Create:**
- `apps/mapp/components/property-details/ReportGeneratorModal.tsx`
- `apps/mapp/utils/reportTemplates.ts` - Report template definitions
- `apps/mapp/utils/pdfGenerator.ts` - PDF generation logic

#### 5.12.5 Collaborative Checkpoints
**User Experience:**
Multiple people can contribute to property monitoring and maintenance tracking.

**Features:**
- **Family Sharing**:
  - Invite family members via email
  - Each member can add checkpoints
  - Shared timeline view
  - Collaborative maintenance planning
  - Activity feed: "John added a checkpoint for Kitchen"
- **Role-Based Permissions**:
  - **Owner**: Full control, can delete, manage members
  - **Contributor**: Can add/edit checkpoints, view all
  - **Viewer**: Read-only access, can view but not modify
- **Contractor Collaboration**:
  - Temporary invite system (link expires)
  - Contractor can view specific checkpoints
  - Contractor can add notes, estimates, completion photos
  - Time-limited access (e.g., 30 days)
- **Activity Feed**:
  - "Sarah created checkpoint: Basement Water Damage"
  - "Mike added note to Kitchen Checkpoint"
  - "Contractor Joe uploaded repair completion photo"
  - Real-time notifications for important updates
- **Comments & Discussions**:
  - Threaded comments on checkpoints
  - @mentions to notify specific people
  - Resolve/unresolve issues

**Implementation:**
- Firestore security rules for multi-user access
- Invitation system via email or shareable links
- Real-time activity feed with Firestore snapshots
- Push notifications for important events
- Time-based access expiration for contractors

**New Types:**
```typescript
export type PropertyMember = {
  userId: string;
  email: string;
  name?: string;
  role: 'owner' | 'contributor' | 'viewer' | 'contractor';
  invitedBy: string;
  invitedAt: Timestamp;
  joinedAt?: Timestamp;
  expiresAt?: Timestamp; // For contractors
  status: 'pending' | 'active' | 'expired';
}

export type PropertyActivity = {
  id: string;
  propertyId: string;
  userId: string;
  userName: string;
  type: 'checkpoint_created' | 'checkpoint_updated' | 'comment_added' | 'member_invited' | 'report_generated';
  description: string;
  checkpointId?: string;
  timestamp: Timestamp;
}

export type CheckpointComment = {
  id: string;
  checkpointId: string;
  userId: string;
  userName: string;
  content: string;
  mentions?: string[]; // User IDs mentioned
  createdAt: Timestamp;
  parentCommentId?: string; // For threaded replies
}
```

**New Components:**
- `PropertyMembersModal.tsx` - Manage property members
- `InviteMemberForm.tsx` - Invite new members
- `ActivityFeed.tsx` - Show property activity
- `CheckpointComments.tsx` - Comment thread on checkpoint
- `MemberRoleBadge.tsx` - Display user role

**Files to Modify:**
- Update Firestore security rules to handle multi-user access
- `PropertyContext.tsx` - Add members and activity to context
- `CheckpointDetailModal.tsx` - Add comments section

**API Functions:**
```typescript
invitePropertyMember(propertyId: string, email: string, role: string): Promise<void>
removePropertyMember(propertyId: string, userId: string): Promise<void>
addCheckpointComment(checkpointId: string, content: string, mentions?: string[]): Promise<void>
```

#### 5.12.6 Deep Research Assistant
**User Experience:**
AI-powered research to help solve property maintenance problems.

**Features:**
- **Maintenance Research**:
  - User: "Research how to fix the water damage I found"
  - AI: Browses repair guides, costs, DIY vs professional
  - Returns comprehensive report with:
    - Problem explanation
    - Common causes
    - Solution options (DIY, contractor)
    - Estimated costs
    - Time to complete
    - Recommended contractors nearby
    - Preventive measures
- **Issue Deep Dive**:
  - Research similar issues in comparable homes
  - Industry best practices
  - Building code requirements
  - Insurance considerations
- **Product Recommendations**:
  - Research best materials/products for repairs
  - Price comparisons
  - Reviews and ratings
  - Where to buy locally
- **Contractor Research**:
  - Find qualified contractors for specific issues
  - Check licenses and reviews
  - Get rough cost estimates
  - Compare multiple quotes

**Implementation:**
- Integration with web search APIs
- AI to synthesize research into actionable reports
- Save research reports linked to checkpoints
- Cache results to reduce API costs

**API Function:**
```typescript
deepResearch(query: string, checkpointIds?: string[]): Promise<ResearchReport>
```

**New Type:**
```typescript
export type ResearchReport = {
  id: string;
  query: string;
  summary: string;
  sections: ResearchSection[];
  sources: ResearchSource[];
  recommendations: string[];
  estimatedCost?: { min: number; max: number };
  generatedAt: Timestamp;
}

export type ResearchSection = {
  title: string;
  content: string;
  type: 'causes' | 'solutions' | 'costs' | 'prevention' | 'products';
}

export type ResearchSource = {
  title: string;
  url: string;
  snippet: string;
}
```

**New Component:**
- `DeepResearchModal.tsx` - Trigger and display research
- `ResearchReport.tsx` - Display research results

#### 5.12.7 Audio Overviews
**User Experience:**
AI-generated audio summaries for hands-free property updates.

**Features:**
- **Monthly Property Podcast**:
  - "Your Property Update - February 2025"
  - Two AI voices discussing changes
  - 5-10 minute audio summary
  - Highlights important changes
  - Maintenance reminders
  - Trend discussions
- **Checkpoint Audio Descriptions**:
  - Voice description of each checkpoint
  - "In this checkpoint, we detected water staining on the ceiling..."
- **Accessibility**:
  - Audio descriptions for visually impaired users
  - Hands-free mode while driving or doing chores
- **Playback Controls**:
  - Standard audio player (play, pause, skip)
  - Adjustable playback speed
  - Download for offline listening

**Implementation:**
- Text-to-speech API (Google Cloud TTS or ElevenLabs)
- Multi-voice generation for conversational style
- Script generation from checkpoint summaries
- Audio file storage and streaming
- Background audio playback support

**New Type:**
```typescript
export type AudioOverview = {
  id: string;
  propertyId: string;
  title: string;
  duration: number; // seconds
  audioUrl: string;
  transcript: string;
  dateRange: { start: Timestamp; end: Timestamp };
  generatedAt: Timestamp;
  listened: boolean;
}
```

**New Component:**
- `AudioOverviewPlayer.tsx` - Audio player component
- `AudioOverviewList.tsx` - List of available audio summaries

**API Function:**
```typescript
generateAudioOverview(propertyId: string, dateRange: DateRange): Promise<AudioOverview>
```

## Phase 6: Tab Integration

### 6.1 Update Property Details Screen
In `apps/mapp/app/(tabs)/home/property-details/index.tsx`:

- Change tab state type: `'chat' | 'details' | 'checkpoints'`
- Add "Checkpoints" tab button to UI
- Import and render `PropertyCheckpointsTab` component
- Show checkpoint count badge on tab

### 6.2 Navigation Flow
- Deep link support: `/property-details/:id?tab=checkpoints`
- Camera capture button visible from all tabs
- Quick access from property list (show latest checkpoint preview)

## Phase 7: Testing & Polish

### 7.1 Testing Scenarios
- Create checkpoint with single/multiple photos
- Create checkpoint with video
- Compare adjacent checkpoints
- Compare non-adjacent checkpoints
- Delete checkpoints
- Edit checkpoint metadata
- Timeline scrolling performance with 50+ checkpoints
- Offline mode (cache recent checkpoints)

### 7.2 UI/UX Polish
- Loading states for AI analysis
- Optimistic UI updates
- Pull-to-refresh on timeline
- Search/filter checkpoints
- Sort options (date, location, change magnitude)
- Empty state illustrations
- Error handling & retry logic
- Accessibility (screen reader support)

### 7.3 Performance Optimization
- Image lazy loading in timeline
- Thumbnail generation for faster loading
- Pagination for long timelines
- Cache AI analysis results
- Background processing for comparisons

## Phase 8: Cloud-First Visual Diff Analysis

Leverage server-side processing and Gemini 3 Pro to perform sophisticated visual comparison without requiring heavy native libraries on the mobile device. This approach maintains compatibility with Expo Go and provides superior semantic understanding of changes.

### 8.1 Cloud Architecture for Analysis

Instead of processing images on the phone, we will offload the heavy lifting to Google Cloud Platform:

**Workflow:**
1.  **Trigger:** User captures a new checkpoint or requests a comparison.
2.  **Upload:** App uploads the image to Firebase Storage.
3.  **Cloud Function:** A background function (`analyzeCheckpointDiff`) is triggered.
4.  **AI Analysis:** The function calls **Gemini 3 Pro (Vertex AI)** with both the new and previous checkpoint images.
5.  **Processing:**
    *   **Semantic Diff:** Gemini identifies actual physical changes (e.g., "The crack has widened," "A water stain appeared") vs. lighting differences.
    *   **Heatmap Generation:** A Python script (using OpenCV/NumPy in the Cloud Function) generates a heatmap overlay based on the structural differences.
    *   **Region Detection:** Gemini returns bounding box coordinates for specific areas of interest.
6.  **Storage:** The analysis results (JSON + Heatmap Image URL) are saved to Firestore.
7.  **UI Update:** The mobile app listens to the Firestore document and updates the UI when the analysis is ready (~3-5s latency).

### 8.2 Advanced Comparison Algorithms (Server-Side)

By running on the server, we can use powerful Python libraries without bloating the app bundle:

**Gemini 3 Pro Vision Analysis**
- **Semantic Change Detection:** "What changed?" (e.g., "The furniture was moved," "The paint is peeling").
- **Condition Assessment:** "Is this worse than before?" (e.g., "Severe deterioration detected").
- **Tool & Repair Recommendations:** Leveraging the Robotic LLM capabilities to suggest specific tools and repair steps.

**Server-Side OpenCV Pipeline**
- **Image Registration:** Align the two images perfectly using feature matching (SIFT/ORB) to correct for slight camera angle differences.
- **Structural Similarity (SSIM):** Calculate precise pixel-level difference maps.
- **Heatmap Generation:** Create a transparent PNG overlay where "hot" colors indicate changes.

### 8.3 Mobile UI Components (Lightweight)

The mobile app becomes a "viewer" for the sophisticated server-side analysis:

**Heatmap Overlay Viewer**
- Simply renders the generated heatmap PNG on top of the checkpoint image.
- Uses `react-native-reanimated` to fade the overlay in/out.
- **No heavy computation on the phone.**

**Interactive Region Boxes**
- Renders bounding boxes based on the JSON coordinates returned by the cloud.
- Tapping a box shows the text description generated by Gemini (e.g., "Water damage detected").

**Split-Screen Comparison**
- Uses standard `react-native-reanimated` to show the Before/After images side-by-side.
- Smooth 60 FPS performance using standard Expo libraries.

### 8.4 API & Data Structure Updates

**New Cloud Function:**
```typescript
export const analyzeCheckpointDiff = onCall(async (request) => {
  const { checkpointId, comparisonCheckpointId } = request.data;
  // 1. Fetch images from Storage
  // 2. Call Vertex AI (Gemini 3 Pro) for semantic analysis
  // 3. Run Python script (via Cloud Run) for image alignment & heatmap generation
  // 4. Save results to Firestore
});
```

**Updated `VisualDiffAnalysis` Type:**
```typescript
export type VisualDiffAnalysis = {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  semanticChanges: string[]; // Gemini-generated descriptions
  heatmapUrl?: string;       // URL to the generated overlay image
  regions: ChangeRegion[];   // Bounding boxes from Gemini
  similarityScore: number;   // 0-1 score
  completedAt: Timestamp;
}
```

### 8.5 Benefits of Cloud-First Approach

1.  **Expo Go Compatible:** No need for `opencv-react-native` or `react-native-tflite`. The app remains pure JavaScript/TypeScript.
2.  **Better AI:** Gemini 3 Pro in the cloud is exponentially more powerful than any on-device mobile model.
3.  **Battery Life:** Heavy processing happens on Google's servers, not the user's battery.
4.  **OTA Updates:** We can improve the analysis algorithms in the cloud without forcing users to update their app.

### 8.6 Implementation Strategy

1.  **Phase 8.1:** Implement the `analyzeCheckpointDiff` Cloud Function (Python/FastAPI or Node.js).
2.  **Phase 8.2:** Update the mobile app to trigger this function and display a "Analyzing..." state.
3.  **Phase 8.3:** Build the `HeatmapOverlay` and `RegionBox` components in the app to render the results.

## Phase 9: Innovative Mobile Visualizations

Advanced mobile-native visualization techniques for checkpoint comparison and timeline navigation, leveraging touch gestures, haptic feedback, and AR capabilities.

### 9.1 Tier 1: Recommended Features (Highest Impact)

These features provide the best user experience and leverage existing libraries in the project.

#### 9.1.1 Multi-Touch Split Screen with Haptic Feedback

**What it is**: Synchronized before/after view with tactile damage severity feedback

**User Experience**:
- Vertical/horizontal split that adjusts with finger drag
- Pinch zoom affects both images simultaneously
- Pan gesture moves both images in sync
- **Haptic patterns**:
  - Light tap: Minor damage detected
  - Medium tap: Moderate damage detected
  - Heavy buzz: Major damage detected
  - Error buzz: Critical damage detected
- Two-finger swipe to adjust split position
- Device tilt (optional): Tilt left/right to reveal more before/after

**Implementation**:
```typescript
// Using react-native-reanimated (4.1.1 - installed!)
// Using react-native-gesture-handler (via expo - installed!)
// Using expo-haptics (15.0.7 - installed!)

// Multi-gesture detection:
- Pan gesture: Adjust split position
- Pinch gesture: Synchronized zoom on both images
- Two-finger drag: Pan both images
- Tap on damage region: Trigger haptic feedback based on severity
```

**Libraries Used** (Already Installed):
- `react-native-reanimated: ~4.1.1`
- `react-native-gesture-handler` (via expo)
- `expo-haptics: ^15.0.7`
- `react-native-worklets: 0.5.1`

**Performance**: 60 FPS using native thread animations with worklets

**Accessibility**: Haptic feedback makes damage severity accessible to visually impaired users

**Component**: `apps/mapp/components/property-details/visualizations/MultiTouchSplitScreen.tsx`

---

#### 9.1.2 Camera Overlay AR Comparison

**What it is**: Point camera at location, see previous checkpoint as semi-transparent overlay

**User Experience**:
- Open camera from checkpoint detail view
- Previous checkpoint displays as 30% opacity "ghost image" over live camera feed
- Alignment guides (grid, corner markers) help match perspective
- Capture button: Take new checkpoint with perfect alignment
- Side-by-side preview shows before/after alignment quality
- **Use case**: Ensures consistent photo angles over months/years of checkpoints

**Implementation**:
```typescript
// Using expo-camera (17.0.9 - installed!)
// Using expo-image (3.0.10 - installed!)

// Features:
- Live camera preview
- Overlay previous checkpoint with adjustable opacity (10% - 50%)
- Optional grid overlay for alignment
- Corner detection for perspective matching
- Flash previous image briefly on capture (visual confirmation)
- Save alignment quality score with checkpoint
```

**Unique Value**: Solves a real property inspection problem - angle consistency. No competitors have this!

**Component**: `apps/mapp/components/property-details/visualizations/CameraOverlayComparison.tsx`

---

#### 9.1.3 Story-Style Vertical Timeline

**What it is**: Full-screen vertical scrolling (TikTok/Instagram Reels pattern)

**User Experience**:
- Each checkpoint = one full-screen page
- **Swipe up**: Next (newer) checkpoint
- **Swipe down**: Previous (older) checkpoint
- **Swipe left**: Compare with previous checkpoint (split-screen)
- **Swipe right**: Open detail modal with full info
- **Pull down from top**: Show date picker overlay to jump to specific time
- **Auto-play videos**: Videos play automatically when in viewport (using expo-video)
- **Snap to checkpoint**: Smooth momentum scrolling with snap

**Implementation**:
```typescript
// Using expo-video (3.0.12 - installed!)
// Using react-native-reanimated for smooth scrolling
// Using FlatList with snapToInterval for paging

// Pagination strategy:
- Virtualized list (only render visible + 2 adjacent items)
- Lazy load images as they enter viewport
- Preload adjacent checkpoints for instant swipes
- Unload images outside viewport to free memory
```

**Performance**:
- Virtualized rendering: Handles 1000+ checkpoints smoothly
- Image lazy loading: Loads only visible + adjacent items
- Video auto-play: Only plays when in viewport (80% visible)

**Familiar UX**: Users already know this pattern from social media apps

**Component**: `apps/mapp/components/property-details/visualizations/StoryTimeline.tsx`

---

### 9.2 Tier 2: Optional Enhanced Features

Additional visualization techniques that provide incremental value. Implement based on user feedback and priorities.

#### 9.2.1 Interactive Spotlight Reveal

**What it is**: Drag a circular "spotlight" to reveal before image underneath after image

**User Experience**:
- After image fills screen
- Drag finger: Circular spotlight follows, revealing before image underneath
- Pinch gesture: Adjust spotlight size (20% - 80% of screen width)
- Double-tap: Freeze spotlight position, then pan image underneath
- **Use case**: Focus on specific damage areas without clutter

**Implementation**:
- GPU-accelerated rendering with `@shopify/react-native-skia` (recommended addition)
- Circular mask with smooth edge feathering
- 60 FPS performance on mid-range devices

**Component**: `apps/mapp/components/property-details/visualizations/SpotlightReveal.tsx`

---

#### 9.2.2 Animated Heatmap with Pulse Effect

**What it is**: Color-coded overlay showing change intensity with animated pulse on damage

**User Experience**:
- Color-gradient overlay on after image:
  - Cool colors (blue/green): No change (0-10%)
  - Warm colors (yellow/orange): Moderate change (10-50%)
  - Hot colors (red): Significant change (50-100%)
- **Pulse animation**: 1-second breathing effect on detected damage regions
- Adjustable sensitivity slider (0.1 - 0.9)
- Layer toggle: Show/hide heatmap overlay
- Opacity control: 30% - 80% transparency
- **Haptic feedback**: Tap damage region → buzz intensity matches severity

**Implementation**:
- Server-side heatmap generation (Python + OpenCV)
- Return heatmap as image URL overlay
- Pulse animation with react-native-reanimated
- Haptic integration with expo-haptics

**Component**: `apps/mapp/components/property-details/visualizations/AnimatedHeatmap.tsx`

---

#### 9.2.3 Filmstrip Scrubber

**What it is**: Horizontal scrollable timeline with drag-to-scrub - quickly jump through months/years

**User Experience**:
- Horizontal row of checkpoint thumbnails at bottom of screen
- Drag horizontally: Scrub through timeline with momentum
- Current checkpoint: Enlarged in center (scale: 1.2x)
- **Snap to checkpoint**: Snaps to nearest checkpoint on release
- Date labels: Slide smoothly as you scrub
- **Fast forward**: Drag faster → larger time jumps per pixel
- Tap thumbnail: Jump directly to that checkpoint

**Implementation**:
```typescript
// Using expo-image for optimized thumbnail loading
// Using react-native-reanimated for smooth scrolling

// Performance optimizations:
- Generate thumbnails server-side (300x300)
- Cache thumbnails aggressively (expo-image built-in LRU)
- Virtualized rendering: Only render visible + 5 adjacent thumbnails
- Blurhash placeholders while loading
```

**Component**: `apps/mapp/components/property-details/visualizations/FilmstripScrubber.tsx`

---

#### 9.2.4 Device Tilt Parallax

**What it is**: Tilt device to see depth between before/after layers

**User Experience**:
- Before image: Background layer (moves slower with tilt)
- After image: Foreground layer (moves faster with tilt)
- **Parallax effect**: Creates illusion of 3D depth
- Gyroscope-based: Small image shifts (±5-10px) based on device angle
- Subtle effect: Not disorienting, just adds visual interest
- **Auto-disable**: Turns off when device is flat (on table) to save battery

**Implementation**:
```typescript
// Using expo-sensors (add as new dependency)
// Using react-native-reanimated for smooth transforms

import { Gyroscope } from 'expo-sensors';

// Parallax calculation:
- Before layer: translateX = gyro.x * 5, translateY = gyro.y * 5
- After layer: translateX = gyro.x * 10, translateY = gyro.y * 10
- Smooth interpolation with spring animation
```

**New Dependency**: `expo-sensors: ~14.0.0` (small addition)

**Component**: `apps/mapp/components/property-details/visualizations/TiltParallax.tsx`

---

#### 9.2.5 Circular Timeline (Clock Metaphor)

**What it is**: Checkpoints arranged in a circle, grouped by seasons, with rotate gesture

**User Experience**:
- Center: Property image or current checkpoint
- **12 o'clock**: Most recent checkpoint
- **Clockwise**: Older checkpoints (full rotation = 1 year)
- **Seasons marked by color zones**:
  - Spring (Mar-May): Green arc
  - Summer (Jun-Aug): Yellow arc
  - Fall (Sep-Nov): Orange arc
  - Winter (Dec-Feb): Blue arc
- **Rotate gesture**: Spin the timeline with finger
- **Tap checkpoint**: Zoom in and show detail
- **Pinch zoom**: See more checkpoints in detail

**Implementation**:
```typescript
// Using react-native-svg (15.12.1 - installed!)
// Using react-native-gesture-handler for rotation

// Layout algorithm:
- Calculate checkpoint positions on circle (trigonometry)
- Group by month, show count badge for multiple per month
- Smooth rotation animation with momentum
- Haptic feedback on checkpoint snap
```

**Visual Appeal**: Beautiful, unique visualization. Great for marketing/demos!

**Component**: `apps/mapp/components/property-details/visualizations/CircularTimeline.tsx`

---

#### 9.2.6 Progressive Reveal Animation

**What it is**: Animated wipe transition from before → after

**User Experience**:
- **Wipe directions**:
  - Left-to-right: Timeline progression (past → present)
  - Right-to-left: Reverse timeline (present → past)
  - Top-to-bottom: Seasonal progression (roof → foundation)
  - Bottom-to-top: Reverse seasonal
  - Radial (center out): Focus on specific damage point
- **Adjustable speed**: 0.5s - 3s duration slider
- **Manual control**: Long-press and drag to manually control wipe position (like video scrubbing)
- **Auto-play**: Automatically cycles through wipe on loop for presentations

**Implementation**:
```typescript
// Using react-native-reanimated for smooth transitions
// Using react-native-svg for clipping paths

// Wipe types:
- Linear: Simple horizontal/vertical wipe
- Radial: Circular reveal from center or tap point
- Curtain: Wipe from both sides meeting in middle
```

**Use Case**: Great for presentations to clients, contractors, insurance

**Component**: `apps/mapp/components/property-details/visualizations/ProgressiveReveal.tsx`

---

#### 9.2.7 Bounding Boxes with Swipe Navigation

**What it is**: Auto-detected change regions with numbered labels - swipe to navigate between detected changes

**User Experience**:
- AI-detected change regions highlighted with colored boxes:
  - **Red boxes**: Damage/removed items
  - **Green boxes**: Improvements/additions
  - **Yellow boxes**: Modified areas
- **Numbered labels**: "Change #1", "Change #2", etc.
- **Confidence badges**: Show AI confidence % on each box
- **Tap box**: Show cropped before/after comparison of that region
- **Swipe left/right**: Navigate between detected changes
- **Long press box**: Save specific region annotation
- **Filter controls**: Show/hide boxes by type (damage/improvement/modified)

**Implementation**:
```typescript
// AI integration: Bounding boxes from server-side analysis
// Using react-native-svg for box rendering
// Using react-native-gesture-handler for swipe

// Region data structure:
type DetectedRegion = {
  id: string;
  bbox: { x, y, width, height };
  type: 'damage' | 'improvement' | 'modified';
  confidence: number; // 0-1
  description: string;
};
```

**Integration**: Works with Phase 8 (Visual Diff Analysis) region detection

**Component**: `apps/mapp/components/property-details/visualizations/BoundingBoxNavigation.tsx`

---

### 9.3 Implementation Components

**New Components to Create**:

**Tier 1 (Recommended):**
- `apps/mapp/components/property-details/visualizations/MultiTouchSplitScreen.tsx`
- `apps/mapp/components/property-details/visualizations/CameraOverlayComparison.tsx`
- `apps/mapp/components/property-details/visualizations/StoryTimeline.tsx`

**Tier 2 (Optional):**
- `apps/mapp/components/property-details/visualizations/SpotlightReveal.tsx`
- `apps/mapp/components/property-details/visualizations/AnimatedHeatmap.tsx`
- `apps/mapp/components/property-details/visualizations/FilmstripScrubber.tsx`
- `apps/mapp/components/property-details/visualizations/TiltParallax.tsx`
- `apps/mapp/components/property-details/visualizations/CircularTimeline.tsx`
- `apps/mapp/components/property-details/visualizations/ProgressiveReveal.tsx`
- `apps/mapp/components/property-details/visualizations/BoundingBoxNavigation.tsx`

**Shared Utilities:**
- `apps/mapp/utils/hapticFeedback.ts` - Haptic pattern manager
- `apps/mapp/utils/visualizationHelpers.ts` - Common animation/gesture utilities

---

### 9.4 New Types to Add

Add to `apps/common/src/types.ts`:

```typescript
export type VisualizationMode =
  | 'split-screen'           // Multi-touch split screen
  | 'camera-overlay'         // AR camera overlay
  | 'story-timeline'         // Vertical scrolling timeline
  | 'spotlight'              // Interactive spotlight reveal
  | 'heatmap'                // Animated heatmap
  | 'filmstrip'              // Horizontal scrubber
  | 'parallax'               // Device tilt parallax
  | 'circular'               // Circular timeline
  | 'progressive-reveal'     // Animated wipe transition
  | 'bounding-boxes';        // AI-detected regions

export type HapticPattern = {
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  feedbackType: 'impact' | 'notification' | 'selection';
  intensity: 'light' | 'medium' | 'heavy';
};

export type ComparisonGesture = {
  type: 'pan' | 'pinch' | 'rotate' | 'swipe' | 'long-press' | 'double-tap';
  enabled: boolean;
  onComplete?: (data: any) => void;
};

export type VisualizationSettings = {
  defaultMode: VisualizationMode;
  enabledModes: VisualizationMode[];
  hapticFeedback: boolean;
  autoPlay: boolean;          // For story timeline and progressive reveal
  syncZoom: boolean;           // For split-screen
  overlayOpacity: number;      // For camera overlay and spotlight
  animationSpeed: number;      // 0.5 - 3.0 seconds
};
```

---

### 9.5 Implementation Strategy & Priority

**Phase 1: Tier 1 Recommended (Weeks 1-3)**
1. **Multi-Touch Split Screen** (~1 week)
   - Uses only existing libraries (reanimated, gesture-handler, haptics)
   - High impact, familiar pattern
   - Day 1-2: Basic split screen with drag
   - Day 3-4: Synchronized zoom/pan
   - Day 5: Haptic feedback integration

2. **Story-Style Timeline** (~1 week)
   - Uses expo-video, reanimated, FlatList
   - Mobile-native pattern, high engagement
   - Day 1-2: Vertical scrolling with snap
   - Day 3-4: Video auto-play
   - Day 5: Swipe gestures (left/right for actions)

3. **Camera Overlay** (~1 week)
   - Uses expo-camera, expo-image
   - Unique differentiator, solves real problem
   - Day 1-2: Camera integration with overlay
   - Day 3-4: Alignment guides and quality scoring
   - Day 5: Polish and testing

**Phase 2: Tier 2 Optional (Weeks 4-6)**
- Implement based on user feedback and priorities
- 2-3 days per feature
- Can be done in parallel with other phases

**Phase 3: Polish & Optimization (Week 7)**
- Performance optimization (60 FPS target)
- Accessibility improvements
- User testing and refinements
- Documentation

---

### 9.6 Libraries & Dependencies

**Already Installed (No Action Needed):**
- ✅ `react-native-reanimated: ~4.1.1`
- ✅ `react-native-gesture-handler` (via expo)
- ✅ `expo-haptics: ^15.0.7`
- ✅ `expo-camera: ~17.0.9`
- ✅ `expo-image: ~3.0.10`
- ✅ `expo-video: ~3.0.12`
- ✅ `react-native-svg: 15.12.1`
- ✅ `react-native-worklets: 0.5.1`

**Recommended Additions (Optional):**
- `@shopify/react-native-skia: ^1.0.0` - GPU-accelerated graphics (for spotlight reveal)
- `expo-sensors: ~14.0.0` - Accelerometer/gyroscope (for tilt parallax)
- `react-native-fast-image: ^8.7.0` - Enhanced image caching (for filmstrip)

---

### 9.7 Performance Considerations

**Target Performance:**
- 60 FPS for all animations and gestures
- <500ms initial render time
- <200 MB memory usage with 50+ checkpoints
- Smooth operation on mid-range devices (iPhone 11, Samsung A-series)

**Optimization Strategies:**
- **Native thread animations**: Use `react-native-reanimated` worklets
- **Virtualized lists**: FlatList with `getItemLayout` optimization
- **Image lazy loading**: Load only visible + 2 adjacent items
- **Thumbnail caching**: Aggressive caching with expo-image LRU
- **Gesture debouncing**: Limit gesture callbacks to 60 FPS
- **Memory management**: Unload off-screen images, compress videos

---

### 9.8 Accessibility Features

**Haptic Feedback** (Primary Accessibility Feature):
- Makes damage severity accessible to visually impaired users
- Different patterns for different severities
- Can be disabled in settings for users with sensory sensitivities

**Screen Reader Support**:
- All visualizations have text descriptions
- Gesture alternatives for screen reader users
- Announce checkpoint dates and damage descriptions

**Adjustable Settings**:
- Animation speed control (0.5x - 2x)
- Haptic intensity control
- High contrast mode for overlays
- Large touch targets (min 44x44pt)

---

### 9.9 Technical Considerations

**Gesture Conflicts**:
- Prioritize gestures: Pan > Pinch > Rotate > Swipe
- Use `Gesture.Simultaneous()` for multi-gesture support
- Debounce rapid gestures to prevent conflicts

**Battery Impact**:
- Camera overlay: High battery usage (warn user)
- Tilt parallax: Moderate battery usage (auto-disable when flat)
- Video auto-play: Moderate battery usage (disable on low battery)
- Haptics: Low battery usage

**Network Considerations**:
- Preload adjacent checkpoints over WiFi
- Compress images for cellular data
- Cache heatmaps locally (7-day expiry)
- Queue video downloads for WiFi only

**Cross-Platform Compatibility**:
- All features work on iOS and Android
- Platform-specific haptic patterns (iOS has richer haptics)
- Fallbacks for unsupported features (e.g., gyroscope not available)

## Implementation Order (Recommended)

### Core Feature (MVP)
1. **Phase 1** (Data Models) - Foundation for everything
2. **Phase 2.1 & 2.2** (Tab + Timeline Card) - Basic UI
3. **Phase 3** (State Management) - Data flow
4. **Phase 2.3** (Capture Modal) - Create checkpoints
5. **Phase 4.1-4.2** (AI Basic Analysis) - Single checkpoint analysis
6. **Phase 6** (Tab Integration) - Add checkpoints tab to property details
7. **Phase 2.4** (Detail Modal - basic) - View checkpoints

### Enhanced Features (Post-MVP)
8. **Phase 4.3** (AI Comparison) - Before/after comparison
9. **Phase 2.4 enhancement** (Before/After Slider) - Visual comparison
10. **Phase 5.11.1** (Query Checkpoints from Chat) - Basic chat integration
11. **Phase 5.11.4** (Deep Links) - Navigation between chat and checkpoints
12. **Phase 5.11.3** (Link Messages to Checkpoints) - Bidirectional linking

### Advanced Chat Integration
13. **Phase 5.11.2** (Create Checkpoints from Chat) - Conversational checkpoint creation
14. **Phase 5.11.6** (Checkpoint-Aware Agent) - Enhanced agent context
15. **Phase 5.11.7** (Quick Actions) - Action buttons in chat
16. **Phase 5.11.8** (Rich Checkpoint Data) - Embedded checkpoint previews in chat
17. **Phase 5.11.5** (Proactive Notifications) - AI-driven insights in chat

### NotebookLM-Inspired Analytics (High Value Features)
18. **Phase 5.12.1** (Enhanced Timeline Visualization) - Zoom controls, event markers, filtering
19. **Phase 5.12.2** (Property Health Mind Map) - Visual relationship explorer
20. **Phase 5.12.3** (Smart FAQ Generation) - Auto-generated property questions
21. **Phase 5.12.4** (Property Briefing Reports) - Professional PDF/Word reports
22. **Phase 5.12.5** (Collaborative Checkpoints) - Family & contractor sharing

### NotebookLM-Inspired Analytics (Medium Value Features)
23. **Phase 5.12.6** (Deep Research Assistant) - AI-powered solution research
24. **Phase 5.12.7** (Audio Overviews) - Monthly property podcasts

### Sophisticated Visual Diff Analysis (High Value Features)
25. **Phase 8.1-8.2** (Basic Visual Diff) - SSIM + perceptual hash + heatmap overlays
26. **Phase 8.3-8.4** (Advanced UI & Processing) - Split-screen, metrics dashboard, multi-stage pipeline
27. **Phase 8.5-8.6** (Mobile Optimization) - GPU acceleration, region analysis components
28. **Phase 8.7-8.9** (Advanced Algorithms) - CNN-based comparison, caching, batch processing

### Innovative Mobile Visualizations (Cutting-Edge UX)
29. **Phase 9.1.1-9.1.3** (Tier 1 Visualizations) - Multi-touch split screen, camera overlay AR, story-style timeline
30. **Phase 9.2** (Tier 2 Visualizations) - Optional features: spotlight reveal, animated heatmap, filmstrip scrubber, parallax, circular timeline, progressive reveal, bounding boxes

### Additional Advanced Features
31. **Phase 5.1-5.10** (Other Advanced Features) - Iterative enhancements
32. **Phase 7** (Polish) - Throughout development

## Technical Considerations

### Storage & Performance
- **Storage Costs**: Checkpoints may generate many large images/videos - consider compression
- **Real-time Performance**: Use pagination and lazy loading
- **Offline Support**: Allow checkpoint creation offline, sync later
- **Security**: Ensure checkpoints are properly scoped to user/property
- **Thumbnail Generation**: Generate thumbnails for all checkpoint media to reduce bandwidth

### AI & Chat Integration
- **AI Costs**: Each analysis costs tokens - batch processing or throttle
- **Context Window**: When passing checkpoint data to agent, summarize older checkpoints to fit context limits
- **Agent Routing**: Checkpoint queries should route to specialized checkpoint agent for optimal performance
- **Structured Responses**: Agent needs to return structured data (actions, checkpoint IDs) in addition to text
- **Background Jobs**: Proactive notifications require background analysis of new checkpoints
- **Rate Limiting**: Prevent excessive AI comparisons from rapid checkpoint creation

### Chat-Checkpoint Synchronization
- **Bi-directional Updates**: When checkpoint is deleted, update linked chat messages
- **Message History**: Include checkpoint context when resuming chat sessions
- **Deep Link Handling**: Maintain navigation state when moving between chat and checkpoint views
- **Optimistic UI**: Show checkpoint creation immediately in chat, update on completion

## Estimated Complexity

- **Core Feature (Phases 1-7 MVP)**: Medium complexity, ~3-5 days
- **With Basic Chat Integration (Steps 8-12)**: Medium-high, ~1-2 weeks
- **Advanced Chat Integration (Steps 13-17)**: High, ~2-3 weeks
- **With NotebookLM-Inspired Analytics (Steps 18-24)**: Very high, ~3-4 weeks additional
- **With Sophisticated Visual Diff (Steps 25-28)**: Very high, ~2-4 weeks additional
  - Basic visual diff (SSIM + heatmaps): ~1-2 weeks
  - Advanced features (CNN, regions, batch): ~2-3 weeks
- **With Innovative Visualizations (Steps 29-30)**: High, ~2-3 weeks for Tier 1, ~2-3 weeks additional for Tier 2
  - Tier 1 (Multi-touch split, camera overlay, story timeline): ~2-3 weeks
  - Tier 2 (7 optional visualizations): ~2-3 weeks additional
- **Full Feature Set (All phases)**: Very high complexity, ~13-20 weeks total

## Key Files to Modify/Create

### Files to Create (Core Feature):
- `apps/common/src/contexts/checkpoint-context.tsx` - Checkpoint state management
- `apps/mapp/components/property-details/PropertyCheckpointsTab.tsx` - Main checkpoints tab
- `apps/mapp/components/property-details/CheckpointCard.tsx` - Timeline card component
- `apps/mapp/components/property-details/CheckpointDetailModal.tsx` - Full checkpoint view
- `apps/mapp/components/property-details/CheckpointCaptureModal.tsx` - Create checkpoint modal
- `apps/mapp/components/ui/BeforeAfterSlider.tsx` - Image comparison slider (if not using library)

### Files to Create (Chat Integration):
- `apps/mapp/components/property-details/CheckpointLinkBadge.tsx` - Badge for linked checkpoints in chat
- `apps/mapp/components/property-details/CheckpointNotificationCard.tsx` - System notification cards
- `apps/mapp/components/property-details/CheckpointPreviewCard.tsx` - Inline checkpoint previews in chat
- `apps/mapp/components/property-details/CheckpointActionButtons.tsx` - Quick action buttons in chat
- `apps/mapp/hooks/useCheckpointChat.ts` - Custom hook for chat-checkpoint integration

### Files to Create (NotebookLM-Inspired Analytics):

**Mobile Components:**
- `apps/mapp/components/property-details/TimelineZoomControls.tsx` - Timeline zoom/scale controls
- `apps/mapp/components/property-details/TimelineEventMarker.tsx` - Event markers on timeline
- `apps/mapp/components/property-details/TimelineFilterBar.tsx` - Filter controls for timeline
- `apps/mapp/components/property-details/MindMapPreview.tsx` - Mobile preview + "View on Web" link
- `apps/mapp/components/property-details/PropertyFAQList.tsx` - FAQ list component
- `apps/mapp/components/property-details/FAQItem.tsx` - Individual FAQ card
- `apps/mapp/components/property-details/FAQCategoryTabs.tsx` - FAQ category filters
- `apps/mapp/components/property-details/ReportGeneratorModal.tsx` - Report configuration UI
- `apps/mapp/components/property-details/ReportPreview.tsx` - Preview generated reports
- `apps/mapp/components/property-details/ReportTemplateSelector.tsx` - Choose report type
- `apps/mapp/components/property-details/ReportCustomizer.tsx` - Customize report sections
- `apps/mapp/components/property-details/PropertyMembersModal.tsx` - Manage property members
- `apps/mapp/components/property-details/InviteMemberForm.tsx` - Invite new members
- `apps/mapp/components/property-details/ActivityFeed.tsx` - Property activity timeline
- `apps/mapp/components/property-details/CheckpointComments.tsx` - Comment thread UI
- `apps/mapp/components/property-details/MemberRoleBadge.tsx` - Display user role badge
- `apps/mapp/components/property-details/DeepResearchModal.tsx` - Research interface
- `apps/mapp/components/property-details/ResearchReport.tsx` - Display research results
- `apps/mapp/components/property-details/AudioOverviewPlayer.tsx` - Audio player component
- `apps/mapp/components/property-details/AudioOverviewList.tsx` - List of audio summaries
- `apps/mapp/utils/reportTemplates.ts` - Report template definitions
- `apps/mapp/utils/pdfGenerator.ts` - PDF generation logic

**Web-Only Components:**
- `apps/webapp/components/property-details/PropertyMindMap.tsx` - Interactive graph visualization
- `apps/webapp/components/property-details/MindMapNode.tsx` - Graph node component
- `apps/webapp/components/property-details/MindMapEdge.tsx` - Graph edge/connection component
- `apps/webapp/components/property-details/MindMapLegend.tsx` - Graph legend
- `apps/webapp/utils/graphLayoutEngine.ts` - Graph layout algorithm (D3.js/React Flow)

### Files to Modify (Core Feature):
- `apps/common/src/types.ts` - Add Checkpoint, CheckpointMedia, CheckpointAnalysis, CheckpointComparison types
- `apps/mapp/app/(tabs)/home/property-details/index.tsx` - Add checkpoints tab to UI
- `apps/mapp/lib/api.ts` - Add analyzeCheckpointMedia, compareCheckpoints, streamAgentResponseWithCheckpoints functions

### Files to Modify (Chat Integration):
- `apps/common/src/types.ts` - Add AgentAction, SystemNotification, MessageContent union type, linkedCheckpointId to Message, linkedMessageIds to Checkpoint
- `apps/mapp/components/property-details/PropertyChatTab.tsx` - Handle checkpoint context, agent actions, checkpoint suggestions, notification cards
- `apps/mapp/lib/api.ts` - Enhance agent API with checkpoint context support
- Chat message renderer component - Parse checkpoint links, render rich checkpoint content

### Files to Modify (NotebookLM-Inspired Analytics):
- `apps/common/src/types.ts` - Add PropertyGraph, GraphNode, GraphEdge, PropertyFAQ, PropertyReport, ReportTemplate, PropertyMember, PropertyActivity, CheckpointComment, ResearchReport, ResearchSection, ResearchSource, AudioOverview types
- `apps/mapp/components/property-details/PropertyCheckpointsTab.tsx` - Integrate timeline zoom/filter controls, add view switcher (timeline/FAQ), add "View Mind Map on Web" link
- `apps/mapp/components/property-details/CheckpointDetailModal.tsx` - Add comments section, member activity
- `apps/common/src/contexts/property-context.tsx` - Add property members and activity
- `apps/mapp/lib/api.ts` - Add generatePropertyFAQs, generatePropertyReport, invitePropertyMember, addCheckpointComment, deepResearch, generateAudioOverview, generatePropertyGraph functions
- Firestore security rules - Multi-user access permissions

**Web App Modifications:**
- `apps/webapp/pages/property/[id].tsx` - Add mind map view option
- `apps/webapp/components/property-details/PropertyCheckpointsTab.tsx` - Include full mind map integration

### Files to Create (Sophisticated Visual Diff):
- `apps/mapp/components/property-details/HeatmapOverlay.tsx` - GPU-accelerated heatmap visualization
- `apps/mapp/components/property-details/SplitScreenComparison.tsx` - Synchronized dual-image view
- `apps/mapp/components/property-details/ComparisonMetricsDashboard.tsx` - Statistics and scores display
- `apps/mapp/components/property-details/SensitivityControls.tsx` - User-adjustable detection thresholds
- `apps/mapp/components/property-details/RegionAnalysisList.tsx` - List/grid of detected change regions
- `apps/mapp/components/property-details/ChangeRegionDetail.tsx` - Deep dive into specific region
- `apps/mapp/components/property-details/BoundingBoxOverlay.tsx` - Interactive bounding boxes on images
- `apps/mapp/components/property-details/RegionNavigator.tsx` - Swipe between detected regions
- `apps/mapp/components/property-details/ImageAlignmentPreview.tsx` - Show alignment result
- `apps/mapp/components/property-details/ProcessingProgress.tsx` - Multi-stage progress indicator
- `apps/mapp/components/property-details/ComparisonHistoryList.tsx` - Previous comparisons cache
- `apps/mapp/utils/imageProcessing.ts` - Image preprocessing utilities (alignment, normalization, denoising)
- `apps/mapp/utils/visualDiffAlgorithms.ts` - SSIM, pHash, MSE implementations
- `apps/mapp/utils/regionDetection.ts` - Change region detection and classification

### Files to Modify (Sophisticated Visual Diff):
- `apps/common/src/types.ts` - Add VisualDiffAnalysis, ChangeRegion, ComparisonSettings, ComparisonCache types
- `apps/mapp/lib/api.ts` - Add analyzeVisualDiff, generateHeatmap, quickCompareCheckpoints, getCachedComparison, batchCompareCheckpoints functions
- `apps/mapp/components/property-details/CheckpointDetailModal.tsx` - Integrate visual diff UI components
- `apps/common/src/contexts/checkpoint-context.tsx` - Add visual diff state and functions

### Files to Create (Innovative Mobile Visualizations):

**Tier 1 Components (Recommended):**
- `apps/mapp/components/property-details/visualizations/MultiTouchSplitScreen.tsx` - Multi-touch split screen with haptic feedback
- `apps/mapp/components/property-details/visualizations/CameraOverlayComparison.tsx` - Live camera with ghost overlay
- `apps/mapp/components/property-details/visualizations/StoryTimeline.tsx` - Vertical full-screen story-style timeline

**Tier 2 Components (Optional):**
- `apps/mapp/components/property-details/visualizations/SpotlightReveal.tsx` - Interactive spotlight comparison
- `apps/mapp/components/property-details/visualizations/AnimatedHeatmap.tsx` - Pulsing animated heatmap
- `apps/mapp/components/property-details/visualizations/FilmstripScrubber.tsx` - Horizontal filmstrip scrubber
- `apps/mapp/components/property-details/visualizations/ParallaxComparison.tsx` - Device tilt parallax effect
- `apps/mapp/components/property-details/visualizations/CircularTimeline.tsx` - Circular clock-style timeline
- `apps/mapp/components/property-details/visualizations/ProgressiveReveal.tsx` - Animated wipe/fade reveal
- `apps/mapp/components/property-details/visualizations/BoundingBoxNavigator.tsx` - Swipeable bounding box regions

**Shared Utilities:**
- `apps/mapp/utils/visualizationEngine.ts` - Core visualization logic and coordination
- `apps/mapp/utils/hapticPatterns.ts` - Haptic feedback patterns and configurations

### Files to Modify (Innovative Mobile Visualizations):
- `apps/common/src/types.ts` - Add VisualizationMode, HapticPattern, VisualizationSettings types
- `apps/mapp/components/property-details/CheckpointDetailModal.tsx` - Add visualization mode selector and viewer
- `apps/common/src/contexts/checkpoint-context.tsx` - Add visualization preferences and state
- `apps/mapp/lib/api.ts` - Add saveVisualizationSettings, trackVisualizationUsage functions

## Research Insights Applied

Based on industry research into checkpoint/timeline features:

1. **Timeline UI Best Practices**: Vertical timeline with circle indicators, color-coding, and relative time stamps
2. **Before/After Comparison**: Interactive slider components are the standard UX pattern
3. **AI-Powered Analysis**: Computer vision for damage detection, change tracking, and condition assessment
4. **Predictive Maintenance**: Trend analysis to forecast issues before they become serious
5. **Mobile-First Design**: Touch-optimized, responsive, with pull-to-refresh and swipe gestures
6. **Property Management Integration**: Link checkpoints to maintenance requests, insurance claims, and reports

## Next Steps

1. Review and approve this plan
2. Prioritize which phases to implement first
3. Set up backend API endpoints for AI analysis
4. Begin Phase 1 implementation with data models
5. Iteratively build and test each phase
