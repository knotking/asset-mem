import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { FileText, X } from 'lucide-react-native';
import type { Document } from '@homeapp/common/types';

interface DocumentsDrawerContentProps {
  documents: Document[];
  selectedDocuments: Document[];
  activeTab: 'chat' | 'details' | 'checkpoints';
  onClose: () => void;
  onToggleDocument: (document: Document) => void;
}

export function DocumentsDrawerContent({
  documents,
  selectedDocuments,
  activeTab,
  onClose,
  onToggleDocument,
}: DocumentsDrawerContentProps) {
  return (
    <>
      <View className="border-b border-border bg-light-background-alt px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">
              {activeTab === 'chat' ? 'Select Resources' : 'Property Documents'}
            </Text>
            {activeTab === 'chat' ? (
              <Text className="text-sm text-muted-foreground">
                {selectedDocuments.length} selected for chat context
              </Text>
            ) : (
              <Text className="text-sm text-muted-foreground">
                {documents.length} document{documents.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <Button onPress={onClose} variant="ghost" size="icon" className="ml-2">
            <Icon as={X} size={24} className="text-foreground" />
          </Button>
        </View>
      </View>
      <ScrollView className="flex-1 px-4 py-4">
        {documents.length === 0 ? (
          <View className="items-center py-8">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Icon as={FileText} size={32} className="text-muted-foreground" />
            </View>
            <Text className="text-center text-muted-foreground">
              No documents available for this property.
            </Text>
            {activeTab === 'details' && (
              <Text className="mt-2 text-center text-sm text-muted-foreground">
                Go to the Details tab to upload documents.
              </Text>
            )}
          </View>
        ) : (
          <View className="gap-3">
            {activeTab === 'chat' && (
              <View className="rounded-lg bg-secondary p-3">
                <Text className="text-sm text-muted-foreground">
                  Select documents to provide context for your chat conversation
                </Text>
              </View>
            )}
            {documents.map((document) => {
              const isSelected = selectedDocuments.some((doc) => doc.id === document.id);
              return (
                <Pressable
                  key={document.id}
                  onPress={() => {
                    if (activeTab === 'chat') {
                      onToggleDocument(document);
                    }
                  }}
                  className={`rounded-lg border p-4 ${activeTab === 'chat' && isSelected
                      ? 'border-primary bg-secondary'
                      : 'border-border bg-card'
                    }`}>
                  <View className="flex-row items-start gap-3">
                    <View
                      className={`h-10 w-10 items-center justify-center rounded-full ${activeTab === 'chat' && isSelected ? 'bg-primary' : 'bg-secondary'
                        }`}>
                      <Icon
                        as={FileText}
                        size={20}
                        className={
                          activeTab === 'chat' && isSelected
                            ? 'text-primary-foreground'
                            : 'text-muted-foreground'
                        }
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground">{document.name}</Text>
                      {document.documentType && (
                        <Text className="mt-1 text-xs capitalize text-muted-foreground">
                          {document.documentType.replace(/_/g, ' ').toLowerCase()}
                        </Text>
                      )}
                      {document.createdAt && (
                        <Text className="mt-1 text-xs text-muted-foreground">
                          {new Date(
                            document.createdAt instanceof Date
                              ? document.createdAt
                              : document.createdAt.toDate()
                          ).toLocaleDateString()}
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
