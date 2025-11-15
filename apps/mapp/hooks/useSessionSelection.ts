import * as React from 'react';
import { useSession } from '@homeapp/common/contexts/session-context';

export function useSessionSelection(propertyId: string, sessionIdParam?: string) {
  const { draftsByProperty, sessionsByProperty } = useSession();
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);

  // Handle incoming session selection from sessions screen
  React.useEffect(() => {
    if (sessionIdParam) {
      setSelectedSessionId(sessionIdParam);
    }
  }, [sessionIdParam]);

  // Auto-select draft session when property loads
  React.useEffect(() => {
    if (propertyId && draftsByProperty[propertyId] && !selectedSessionId) {
      setSelectedSessionId(draftsByProperty[propertyId].id);
    }
  }, [propertyId, draftsByProperty, selectedSessionId]);

  // Handle case when selected session is deleted - fall back to draft
  React.useEffect(() => {
    if (!propertyId || !selectedSessionId) return;

    const allSessions = [...(sessionsByProperty[propertyId] || [])];
    const draft = draftsByProperty[propertyId];
    if (draft) {
      allSessions.push(draft);
    }

    // Check if the currently selected session still exists
    const sessionExists = allSessions.some((s) => s.id === selectedSessionId);

    // If the selected session was deleted, fall back to draft
    if (!sessionExists && draft) {
      setSelectedSessionId(draft.id);
    }
  }, [propertyId, selectedSessionId, sessionsByProperty, draftsByProperty]);

  return { selectedSessionId, setSelectedSessionId };
}
