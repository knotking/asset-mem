import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Camera, X, MapPin, Calendar } from 'lucide-react-native';
import type { Checkpoint } from '@homeapp/common/types';
import { format } from 'date-fns';

interface CheckpointsDrawerContentProps {
  checkpoints: Checkpoint[];
  selectedCheckpoints: Checkpoint[];
  activeTab: 'chat' | 'details' | 'timeline' | 'providers';
  onClose: () => void;
  onToggleCheckpoint: (checkpoint: Checkpoint) => void;
}

export function CheckpointsDrawerContent({
  checkpoints,
  selectedCheckpoints,
  activeTab,
  onClose,
  onToggleCheckpoint,
}: CheckpointsDrawerContentProps) {
  return (
    <>
      <View className="border-b border-border bg-light-background-alt px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">
              {activeTab === 'chat' ? 'Select Checkpoints' : 'Property Checkpoints'}
            </Text>
            {activeTab === 'chat' ? (
              <Text className="text-sm text-muted-foreground">
                {selectedCheckpoints.length} selected for chat context
              </Text>
            ) : (
              <Text className="text-sm text-muted-foreground">
                {checkpoints.length} checkpoint{checkpoints.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <Button onPress={onClose} variant="ghost" size="icon" className="ml-2">
            <Icon as={X} size={24} className="text-foreground" />
          </Button>
        </View>
      </View>
      <ScrollView className="flex-1 px-4 py-4">
        {checkpoints.length === 0 ? (
          <View className="items-center py-8">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Icon as={Camera} size={32} className="text-muted-foreground" />
            </View>
            <Text className="text-center text-muted-foreground">
              No checkpoints available for this property.
            </Text>
            {activeTab === 'timeline' && (
              <Text className="mt-2 text-center text-sm text-muted-foreground">
                Create checkpoints to track property condition over time.
              </Text>
            )}
          </View>
        ) : (
          <View className="gap-3">
            {activeTab === 'chat' && (
              <View className="rounded-lg bg-secondary p-3">
                <Text className="text-sm text-muted-foreground">
                  Select checkpoints to provide context for your chat conversation. The AI will use
                  these checkpoints to answer questions about property condition, changes, and
                  history.
                </Text>
              </View>
            )}
            {checkpoints.map((checkpoint) => {
              const isSelected = selectedCheckpoints.some((cp) => cp.id === checkpoint.id);
              const date = checkpoint.createdAt?.toDate
                ? checkpoint.createdAt.toDate()
                : new Date();

              return (
                <Pressable
                  key={checkpoint.id}
                  onPress={() => {
                    if (activeTab === 'chat') {
                      onToggleCheckpoint(checkpoint);
                    }
                  }}
                  className={`rounded-lg border p-4 ${
                    activeTab === 'chat' && isSelected
                      ? 'border-primary bg-secondary'
                      : 'border-border bg-card'
                  }`}>
                  <View className="flex-row items-start gap-3">
                    <View
                      className={`h-10 w-10 items-center justify-center rounded-full ${
                        activeTab === 'chat' && isSelected ? 'bg-primary' : 'bg-secondary'
                      }`}>
                      <Icon
                        as={Camera}
                        size={20}
                        className={
                          activeTab === 'chat' && isSelected
                            ? 'text-primary-foreground'
                            : 'text-muted-foreground'
                        }
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground">
                        {checkpoint.name || 'Untitled Checkpoint'}
                      </Text>
                      {checkpoint.location && (
                        <View className="mt-1 flex-row items-center gap-1">
                          <Icon as={MapPin} size={12} className="text-muted-foreground" />
                          <Text className="text-xs text-muted-foreground">
                            {checkpoint.location}
                          </Text>
                        </View>
                      )}
                      <View className="mt-1 flex-row items-center gap-1">
                        <Icon as={Calendar} size={12} className="text-muted-foreground" />
                        <Text className="text-xs text-muted-foreground">
                          {format(date, 'MMM d, yyyy')}
                        </Text>
                      </View>
                      {checkpoint.aiAnalysis?.summary && (
                        <Text className="mt-2 text-xs text-muted-foreground" numberOfLines={2}>
                          {checkpoint.aiAnalysis.summary}
                        </Text>
                      )}
                    </View>
                    {activeTab === 'chat' && isSelected && (
                      <View className="rounded-full bg-primary p-1">
                        <Icon as={X} size={16} className="text-primary-foreground" />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </>
  );
}
