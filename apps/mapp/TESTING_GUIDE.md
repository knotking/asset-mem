# GiftedChat Integration - Quick Testing Guide

## 🚀 How to Test

### 1. Start the App
```bash
cd apps/mapp
npm start
```

### 2. Open in Expo Go or Simulator
- Scan QR code with Expo Go (mobile)
- Press `i` for iOS Simulator
- Press `a` for Android Emulator

### 3. Navigate to Chat
1. Open a property
2. Go to "AI Chat" tab
3. Test the features below

## ✅ Quick Test Checklist

### Core Functionality (5 min)
- [ ] Type a message and send
- [ ] Receive a response
- [ ] Messages appear in correct order
- [ ] Scroll up to see older messages (if >50 exist)

### File Attachments (3 min)
- [ ] Tap attachment icon
- [ ] Select "Take photo" or "Choose from library"
- [ ] Verify preview appears
- [ ] Send with attachment
- [ ] Verify file displays in message

### Pagination (2 min - only if you have >50 messages)
- [ ] Scroll to top of chat
- [ ] "Load Earlier Messages" button appears
- [ ] Tap button
- [ ] Earlier messages load
- [ ] Scroll position maintained

### Optional Agents (2 min)
- [ ] Tap agent chips (Coverage, DIY, Service, Cost)
- [ ] Verify selected ones are highlighted
- [ ] Send message with different combinations
- [ ] Verify responses match selected agents

## 🐛 Common Issues & Fixes

### Issue: Messages not displaying
**Fix**: Check Firestore connection and permissions

### Issue: Pagination not working
**Fix**: Ensure you have >50 messages in the chat. Create test messages if needed.

### Issue: File upload fails
**Fix**: Check storage permissions and Firebase Storage rules

### Issue: Custom bubbles not rendering
**Fix**: Check console for errors in `GiftedChatBubble.tsx`

### Issue: Input not working
**Fix**: Check `GiftedChatInputToolbar.tsx` props are passed correctly

## 🔍 Debug Mode

To enable detailed logging, add this to ChatTab:
```typescript
<GiftedChat
  messages={giftedMessages}
  onSend={onSend}
  // ... other props
  onPressAvatar={(user) => console.log('Avatar pressed:', user)}
  onLongPress={(context, message) => console.log('Long press:', message)}
/>
```

## 📊 Performance Testing

### Test Large Chats
1. Create a chat with 100+ messages
2. Verify smooth scrolling
3. Check pagination loads quickly
4. Monitor memory usage in React DevTools

### Test Rapid Sending
1. Send 5-10 messages quickly
2. Verify all messages appear
3. Check for race conditions
4. Ensure scroll stays at bottom

## 🎯 Production Readiness

Before deploying:
- [ ] All basic features work
- [ ] No console errors
- [ ] Smooth performance on low-end devices
- [ ] File uploads complete successfully
- [ ] Pagination loads without issues
- [ ] Agent responses render correctly
- [ ] Structured responses display properly

## 📝 Report Issues

If you find issues, collect:
1. Screenshot/video of the issue
2. Console error messages
3. Steps to reproduce
4. Device/simulator info
5. Message count in chat

## 🎉 Success Criteria

Integration is successful when:
- ✅ All messages display correctly
- ✅ Sending/receiving works
- ✅ File attachments work
- ✅ Pagination loads older messages
- ✅ Custom UI (structured responses) renders
- ✅ Performance is smooth
- ✅ No console errors

---

**Next Steps After Testing:**
1. Mark any issues found
2. Test on both iOS and Android
3. Test with different data scenarios
4. Get user feedback
5. Monitor production metrics
