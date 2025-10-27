export async function createAgentSession(userId: string): Promise<{ agentSessionId?: string; error?: string }> {
  try {
    // TODO: Replace with actual environment variable from app.config or expo-constants
    const url = process.env.EXPO_PUBLIC_AGENT_SESSION_URL;
    if (!url) {
      throw new Error("EXPO_PUBLIC_AGENT_SESSION_URL environment variable not set.");
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to create session, status: ${response.status}, body: ${errorBody}`);
    }

    const data = await response.json();
    const agentSessionId = data.id;

    if (!agentSessionId) {
      throw new Error("session_id not found in response");
    }

    return { agentSessionId };
  } catch (error) {
    console.error('Error creating agent session:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { error: `Failed to create agent session: ${errorMessage}` };
  }
}
