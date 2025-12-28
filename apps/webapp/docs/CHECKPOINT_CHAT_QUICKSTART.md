# Checkpoint Chat Integration - Quick Start Guide

## What's New? 🎉

You can now **select checkpoints** when chatting with the AI agent, just like in the mobile app! This allows the AI to reference specific property conditions and changes when answering your questions.

---

## How to Use

### 1. Open a Property Chat

Navigate to any property and open the **AI Chat** tab.

### 2. Select Checkpoints

Click the **camera icon** 📷 button in the chat input (next to the file attachment button).

A slide-in panel will appear showing all available checkpoints for that property.

### 3. Choose Context

**Tap checkpoints** to select them. Selected checkpoints will:
- Show a checkmark ✓
- Appear with a primary background
- Count badge updates on the camera button

### 4. Ask Questions

With checkpoints selected, ask the AI questions like:

- **"What changed in my kitchen?"**
- **"Is the damage getting worse?"**
- **"Should I be concerned about these issues?"**
- **"What maintenance should I prioritize?"**
- **"Compare these two rooms for me"**

The AI will use the selected checkpoints as visual context to provide informed, specific answers.

### 5. Manage Selection

**View selected checkpoints** in the context header at the top of the chat.

**Remove individual checkpoints**: Click the X button on any badge

**Clear all checkpoints**: Click the "Clear all" button

---

## Tips & Best Practices

### 🎯 **Be Specific with Selection**

Select only relevant checkpoints for your question:
- Kitchen question? → Select kitchen checkpoints
- Timeline question? → Select checkpoints over time
- Comparison question? → Select 2-3 specific checkpoints

### 📅 **Use Time Ranges**

For questions about changes over time, select checkpoints from:
- Same location, different dates
- Regular intervals (monthly checkpoints)
- Before/after events

### 🏷️ **Check Metadata**

Each checkpoint shows:
- **Name** - What it captures
- **Location** - Where it was taken
- **Date** - When it was captured
- **AI Summary** - What was detected
- **Issues** - Number of problems found

Use this info to select the most relevant checkpoints.

### 💡 **Combine with Documents**

You can select both:
- **Checkpoints** (visual property condition)
- **Documents** (manuals, warranties, etc.)

The AI will use both for comprehensive answers.

---

## Example Workflows

### Workflow 1: Track Kitchen Damage

1. Select all kitchen checkpoints from the past 3 months
2. Ask: "Is the water damage in my kitchen getting worse?"
3. AI analyzes the progression and provides recommendations

### Workflow 2: Prioritize Repairs

1. Select all recent checkpoints (last month)
2. Ask: "What should I fix first based on these checkpoints?"
3. AI evaluates severity and urgency across locations

### Workflow 3: Prepare for Insurance Claim

1. Select checkpoints showing specific damage
2. Ask: "Summarize the damage for an insurance claim"
3. AI generates a structured summary with details

### Workflow 4: Compare Rooms

1. Select checkpoints from 2-3 different rooms
2. Ask: "Which room needs the most attention?"
3. AI compares conditions and recommends priorities

---

## Visual Guide

```
┌─────────────────────────────────────────┐
│  Chat Interface                         │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Documents: [Manual] [Warranty]    │ │ ← Context Header
│  │ Checkpoints: [Kitchen] [Bathroom] │ │   (Selected items)
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Chat Messages                     │ │
│  │ ...                               │ │
│  │ ...                               │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Type a message...     📎 📷 [2]  │ │ ← Chat Input
│  └───────────────────────────────────┘ │   (Badge shows count)
└─────────────────────────────────────────┘
```

**Click the camera icon [2]** to open the checkpoint selector.

---

## Feature Highlights

✅ **Easy Selection**: Tap to toggle, visual feedback  
✅ **Preview Info**: See thumbnails, names, dates, summaries  
✅ **Context Display**: Selected checkpoints shown in header  
✅ **Smart AI**: Agent uses checkpoint data for answers  
✅ **Flexible**: Works with documents and file attachments  
✅ **Persistent**: Selection stays until you clear it  

---

## Troubleshooting

### Camera button not visible?

**Cause**: No checkpoints available for this property  
**Solution**: Create some checkpoints first from the Checkpoints tab

### No checkpoints in the list?

**Cause**: Property doesn't have any checkpoints yet  
**Solution**: Navigate to Checkpoints tab and create your first checkpoint

### Selection not saving?

**Cause**: Selections are per-session (intentional design)  
**Solution**: Select checkpoints fresh for each conversation topic

### AI not using checkpoint context?

**Cause**: Backend may need checkpoint context support  
**Solution**: Verify `checkpoint_uris` are being passed to the agent API

---

## Feature Parity

This feature matches the mobile app (mapp) exactly:

| Feature | Status |
|---------|--------|
| Checkpoint selection | ✅ |
| Multi-select | ✅ |
| Visual preview | ✅ |
| Context display | ✅ |
| Backend integration | ✅ |

---

## Related Features

- **[Checkpoints Tab](./CHECKPOINT_IMPLEMENTATION.md)**: Create and manage checkpoints
- **[AI Analysis](./CHECKPOINT_IMPLEMENTATION.md#ai-analysis-integration)**: Automatic damage detection
- **[Comparison](./CHECKPOINT_IMPLEMENTATION.md#checkpoint-comparison)**: Side-by-side comparison
- **[Metrics Dashboard](./CHECKPOINT_IMPLEMENTATION.md#property-metrics-dashboard)**: Property health tracking

---

## Need Help?

- **Full Documentation**: [Checkpoint Chat Integration](./CHECKPOINT_CHAT_INTEGRATION.md)
- **Troubleshooting**: [Troubleshooting Guide](./TROUBLESHOOTING.md)
- **General Help**: [README](../README.md)

---

**Enjoy your enhanced AI conversations! 🚀**

