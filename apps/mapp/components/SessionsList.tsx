import React from 'react';
import { View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MessageSquare, Plus } from 'lucide-react-native';
import type { Session } from '@homeapp/common/types';
import { useSession } from '@homeapp/common/contexts/session-context';
import { useAuth } from '@homeapp/common/contexts/auth-context';

interface SessionsListProps {
  propertyId: string;
  onSessionPress?: (session: Session) => void;
  onCreateSession?: () => void;
}

export default function SessionsList({
  propertyId,
  onSessionPress,
  onCreateSession,
}: SessionsListProps) {
  const { sessionsByProperty, draftsByProperty, isLoading, createPropertyDraftSession } = useSession();
  const { user } = useAuth();

  const sessions = sessionsByProperty[propertyId] || [];
  const draftSession = draftsByProperty[propertyId];
  // Draft sessions are hidden from the list (similar to webapp)
  // They are auto-selected on property load and transition to regular sessions on first message

  const handleCreateSession = async () => {
    if (!user) return;

    // Claim existing draft or create new one (same as webapp)
    if (draftSession) {
      // Draft exists - claim it by selecting it
      onSessionPress?.(draftSession);
    } else {
      // No draft exists - create one
      const newSessionId = await createPropertyDraftSession(user.uid, propertyId);
      if (newSessionId) {
        // The draft will be picked up by the context and auto-selected
        // In parallel, a new draft will be created for future use
      }
    }

    // Call the onCreateSession callback if provided
    if (onCreateSession) {
      onCreateSession();
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Create New Session Button */}
      <View className="p-4">
        <TouchableOpacity
          onPress={handleCreateSession}
          className="flex-row items-center justify-center gap-2 rounded-lg bg-primary p-4">
          <Icon as={Plus} size={20} className="text-primary-foreground" />
          <Text className="font-semibold text-primary-foreground">New Session</Text>
        </TouchableOpacity>
      </View>

      {/* Sessions List */}
      <ScrollView className="flex-1 px-4">
        {sessions.length === 0 ? (
          <View className="items-center py-8">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Icon as={MessageSquare} size={32} className="text-muted-foreground" />
            </View>
            <Text className="text-center text-muted-foreground">
              No sessions yet. Create one to start chatting about this property.
            </Text>
          </View>
        ) : (
          <View className="space-y-3 pb-4">
            {/* Regular Sessions - Draft sessions are hidden */}
            {sessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                onPress={() => onSessionPress?.(session)}
                className="mb-4 rounded-lg border border-border bg-background p-4">
                <View className="flex-row items-start gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <Icon as={MessageSquare} size={20} className="text-green-500" />
                  </View>
                  <View className="flex-1">
                    <Text className="mb-1 font-semibold text-foreground">{session.name}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {formatDate(session.createdAt)}
                    </Text>
                    {session.messageCount !== undefined && session.messageCount > 0 && (
                      <Text className="mt-1 text-xs text-muted-foreground">
                        {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                      </Text>
                    )}
                    {session.lastMessageAt && (
                      <Text className="mt-1 text-xs text-muted-foreground">
                        Last active: {formatDate(session.lastMessageAt)}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
