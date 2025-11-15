import * as React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react-native';
import SessionsList from '@/components/SessionsList';
import type { Session } from '@homeapp/common/types';

interface SessionsDrawerContentProps {
  propertyId: string;
  propertyName: string;
  onClose: () => void;
  onSessionPress: (session: Session) => void;
  onCreateSession: () => void;
}

export function SessionsDrawerContent({
  propertyId,
  propertyName,
  onClose,
  onSessionPress,
  onCreateSession,
}: SessionsDrawerContentProps) {
  return (
    <>
      <View className="border-b border-border bg-light-background-alt px-4 py-3">
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-lg font-semibold text-foreground">Sessions</Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {propertyName}
            </Text>
          </View>
          <Button onPress={onClose} variant="ghost" size="icon">
            <Icon as={X} size={24} className="text-foreground" />
          </Button>
        </View>
      </View>
      <SessionsList
        propertyId={propertyId}
        onSessionPress={onSessionPress}
        onCreateSession={onCreateSession}
      />
    </>
  );
}
