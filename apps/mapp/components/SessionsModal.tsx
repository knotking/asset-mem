import React from 'react';
import { Modal, View, SafeAreaView } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react-native';
import SessionsList from './SessionsList';
import type { Session } from '@homeapp/common/types';

interface SessionsModalProps {
  visible: boolean;
  onClose: () => void;
  propertyId: string;
  propertyName: string;
  onSessionPress?: (session: Session) => void;
  onCreateSession?: () => void;
}

export default function SessionsModal({
  visible,
  onClose,
  propertyId,
  propertyName,
  onSessionPress,
  onCreateSession,
}: SessionsModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background">
        {/* Header */}
        <View className="border-b border-border bg-background px-4 py-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-foreground">Sessions</Text>
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {propertyName}
              </Text>
            </View>
            <Button onPress={onClose} variant="ghost" size="icon" className="ml-2">
              <Icon as={X} size={24} className="text-foreground" />
            </Button>
          </View>
        </View>

        {/* Sessions List */}
        <SessionsList
          propertyId={propertyId}
          onSessionPress={(session) => {
            onSessionPress?.(session);
            onClose();
          }}
          onCreateSession={() => {
            onCreateSession?.();
            onClose();
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
