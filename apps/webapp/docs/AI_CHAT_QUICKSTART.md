# AI Chat Quick Reference

## 🚀 New Features

### Two Intelligent Agents

**1. Analysis Agent** 🩺
- Best for: Repairs, diagnosis, fixing issues
- Provides: Service recommendations, cost estimates, DIY steps
- Use when: "How do I fix...", "What's wrong with...", "Find a contractor"

**2. Checkpoint Agent** 🕐
- Best for: Condition tracking, comparisons over time
- Provides: Change analysis, trend detection, deterioration tracking
- Use when: "What changed...", "Compare these...", "Show history"

---

## 💡 Smart Agent Selection

### Automatic Suggestions

The system analyzes your query and suggests the best agent:

**Example 1:**
- You type: "How do I fix a leaky faucet?"
- System suggests: **Analysis Agent**
- Why: Detected repair keywords

**Example 2:**
- You type: "What changed in my kitchen since last month?"
- System suggests: **Checkpoint Agent**
- Why: Detected comparison + time keywords

**Example 3:**
- You type: "Compare before and after photos"
- System suggests: **Checkpoint Agent**
- Why: Detected comparison intent

### Manual Selection

Click the agent section to expand and choose:

```
[Stethoscope Icon] Analysis Agent     [v]
```

Expands to:

```
Primary Agent
┌─────────────┬──────────────┐
│  Analysis   │  Checkpoint  │
└─────────────┴──────────────┘

Analysis agent helps with repairs, 
diagnosis, and property issues
```

---

## 🎯 Usage Examples

### Use Analysis Agent For:
- ✅ "My air conditioner is making noise"
- ✅ "How much does roof repair cost?"
- ✅ "Find a plumber near me"
- ✅ "DIY steps for fixing drywall"
- ✅ "Is this covered by warranty?"

### Use Checkpoint Agent For:
- ✅ "What changed in my basement?"
- ✅ "Show me condition over the last 6 months"
- ✅ "Compare these two checkpoints"
- ✅ "Has the damage gotten worse?"
- ✅ "Property condition timeline"

### Works with Both:
- 📸 Select checkpoints for visual context (both agents can use them)
- 📄 Attach documents for reference (both agents can read them)
- 📍 Use location data for service searches

---

## 🔄 Switching Agents

### During Conversation:
1. Type your question
2. See suggestion banner (if applicable)
3. Click **"Switch"** or **"Dismiss"**
4. Continue chatting

### Before Sending:
1. Expand agent section
2. Click desired agent
3. Section auto-collapses
4. Type and send message

---

## 🎨 Visual Indicators

**Current Agent Display:**
- Stethoscope icon 🩺 = Analysis Agent
- Clock icon 🕐 = Checkpoint Agent

**Suggestion Banner:**
```
┌──────────────────────────────────┐
│ [Clock] Your query suggests      │
│ using the Checkpoint Agent       │
│              [Dismiss] [Switch]   │
└──────────────────────────────────┘
```

**Agent Section:**
- Border color matches selection
- Description updates based on choice
- Smooth animations on expand/collapse

---

## ⚡ Pro Tips

1. **Let It Suggest**: Start typing and wait for suggestions
2. **Be Specific**: Clear queries get better agent suggestions
3. **Use Checkpoints**: Select relevant checkpoints before asking
4. **Switch Anytime**: Change agents mid-conversation if needed
5. **Dismiss When Wrong**: System learns from your choices

---

## 🔧 Technical Details

### How Suggestions Work:
1. You type a query
2. After 500ms delay (debounce)
3. System analyzes keywords and patterns
4. Suggests agent if confidence is high
5. Banner appears if suggestion differs from current

### What Gets Sent:
```json
{
  "primary_agent": "analysis",      // or "checkpoint"
  "checkpoint_ids": ["id1", "id2"], // if selected
  "context_doc_uris": [...],        // if selected
  // ... other data
}
```

### Message Storage:
- Each message stores which agent handled it
- View in message metadata (for future features)
- Helps track agent performance

---

## ❓ FAQ

**Q: Can I use both agents in one conversation?**  
A: Yes! Switch agents anytime. Each message uses the currently selected agent.

**Q: What if I ignore the suggestion?**  
A: No problem! Keep using your selected agent. The suggestion will disappear.

**Q: Does the agent choice persist?**  
A: Only within the current session. Reload = reset to Analysis Agent (default).

**Q: Can I change default agent?**  
A: Not yet, but it's on the roadmap!

**Q: What if I select checkpoints with Analysis Agent?**  
A: Works fine! Both agents can use checkpoint context.

---

## 📚 Related Docs

- [Full AI Chat Parity Documentation](./AI_CHAT_PARITY.md)
- [Checkpoint Chat Integration](./CHECKPOINT_CHAT_INTEGRATION.md)
- [Checkpoint Features](./CHECKPOINT_IMPLEMENTATION.md)

---

**Last Updated:** December 27, 2025

