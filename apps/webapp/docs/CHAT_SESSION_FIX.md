# Quick Fix: Chat Session Creation Issue

## Problem
You're seeing this error when trying to create a new chat session:

```
Error: Failed to create agent session ID.
```

## Root Cause
The Next.js dev server was started before the environment variables were loaded, or it hasn't been restarted after `.env` file changes.

## Solution (Takes 30 seconds)

### Step 1: Stop the Dev Server
In the terminal where the webapp is running, press:
```
Ctrl + C
```

### Step 2: Restart the Dev Server
```bash
cd apps/webapp
npm run dev
```

### Step 3: Verify It Works
1. Open the webapp at `http://localhost:9002`
2. Navigate to a property
3. Try creating a new chat session
4. It should work now! ✅

## Why This Happens
Next.js loads environment variables (`NEXT_PUBLIC_*`) at **startup time**, not during runtime. Any changes to `.env` files require a server restart to take effect.

## Prevention
**Always restart the dev server after:**
- Modifying `.env`, `.env.local`, or `.env.development`
- Pulling changes that update environment variables
- Switching git branches if environment variables differ

## Verification
If you want to verify the environment variables are loaded, check the terminal output when starting the dev server. The variables should be available immediately after restart.

## Still Having Issues?
If the problem persists after restarting:

1. **Check the `.env` file exists:**
   ```bash
   ls -la apps/webapp/.env
   ```

2. **Verify the required variables are present:**
   ```bash
   grep NEXT_PUBLIC_AGENT_SESSION_URL apps/webapp/.env
   ```

3. **Check the variable value:**
   The `.env` file should contain:
   ```env
   NEXT_PUBLIC_AGENT_SESSION_URL=https://homecare-agent-proxy-321433914812.us-central1.run.app/92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376/agent-session
   NEXT_PUBLIC_AGENT_SSE_URL=https://homecare-agent-proxy-321433914812.us-central1.run.app/92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376/firebase-agent-stream
   ```

4. **See the full troubleshooting guide:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## Technical Details (For Reference)

### How the Error Occurs

The error happens in `apps/webapp/src/contexts/session-context.tsx`:

```typescript
const createAgentSession = useCallback(async (userId: string): Promise<string | null> => {
  const { agentSessionId, error } = await createAgentSessionAction(userId);
  if (error || !agentSessionId) {
    throw new Error(error || 'Failed to create agent session ID.');  // ← Error thrown here
  }
  return agentSessionId;
}, []);
```

Which calls `apps/webapp/src/app/actions.ts`:

```typescript
export async function createAgentSessionAction(userId: string) {
  const url = process.env.NEXT_PUBLIC_AGENT_SESSION_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_AGENT_SESSION_URL environment variable not set.");
  }
  // ... rest of the function
}
```

If `process.env.NEXT_PUBLIC_AGENT_SESSION_URL` is `undefined`, the error is thrown and propagated back to the UI.

### Why Restart Is Required

Next.js uses webpack/turbopack to bundle the application. During the build process:

1. Environment variables starting with `NEXT_PUBLIC_` are **inlined** into the bundle
2. They are replaced at **build time**, not runtime
3. This happens when the dev server starts or when `npm run build` is executed

Therefore, any changes to these variables require rebuilding the bundle, which means restarting the dev server.

