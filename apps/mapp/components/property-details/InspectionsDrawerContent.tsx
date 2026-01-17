import * as React from 'react';
import { View, ScrollView, Pressable, Image } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { FileText, X, Calendar, AlertTriangle, CheckCircle } from 'lucide-react-native';
import type { Document } from '@homeapp/common/types';
import { format } from 'date-fns';

interface InspectionsDrawerContentProps {
  documents: Document[];
  selectedDocuments: Document[];
  activeTab: 'chat' | 'details' | 'timeline' | 'inspections';
  onClose: () => void;
  onToggleDocument: (document: Document) => void;
}

export function InspectionsDrawerContent({
  documents,
  selectedDocuments,
  activeTab,
  onClose,
  onToggleDocument,
}: InspectionsDrawerContentProps) {
  // Filter to only inspection reports
  const inspectionReports = documents.filter(
    (doc) => doc.documentType === 'INSPECTION_REPORT'
  );

  const hasIssues = (doc: Document) => {
    return doc.keyEntities?.some(
      (entity) =>
        entity.name.toLowerCase().includes('issue') ||
        entity.name.toLowerCase().includes('critical') ||
        entity.name.toLowerCase().includes('major')
    );
  };

  return (
    <>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border pb-4">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">Inspection Reports</Text>
          <Text className="mt-1 text-xs text-muted-foreground">
            {activeTab === 'chat'
              ? 'Select inspection reports to include as context'
              : `${inspectionReports.length} reports available`}
          </Text>
        </View>
        <Button variant="ghost" size="icon" onPress={onClose}>
          <Icon as={X} className="text-foreground" />
        </Button>
      </View>

      {/* Content */}
      <ScrollView className="flex-1">
        {inspectionReports.length === 0 ? (
          <View className="mt-8 items-center justify-center px-4">
            <View className="items-center justify-center rounded-full bg-muted p-4">
              <Icon as={FileText} size={32} className="text-muted-foreground" />
            </View>
            <Text className="mt-4 text-center text-base font-medium text-foreground">
              No Inspection Reports
            </Text>
            <Text className="mt-2 text-center text-sm text-muted-foreground">
              Upload inspection reports in the Details tab to get started
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {inspectionReports.map((document) => {
              const isSelected = selectedDocuments.some((doc) => doc.id === document.id);
              const date = document.createdAt?.toDate
                ? document.createdAt.toDate()
                : new Date();
              const hasProblems = hasIssues(document);

              return (
                <Pressable
                  key={document.id}
                  onPress={() => {
                    if (activeTab === 'chat') {
                      onToggleDocument(document);
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
                      <View className="flex-row items-start justify-between gap-2">
                        <Text className="flex-1 font-semibold text-foreground" numberOfLines={2}>
                          {document.name}
                        </Text>
                        {document.status === 'complete' && (
                          <View className="rounded-full bg-secondary px-2 py-0.5">
                            <Icon as={CheckCircle} size={12} className="text-foreground" />
                          </View>
                        )}
                        {hasProblems && (
                          <View className="rounded-full bg-destructive/10 px-2 py-0.5">
                            <Icon as={AlertTriangle} size={12} className="text-destructive" />
                          </View>
                        )}
                      </View>
                      <View className="mt-1 flex-row items-center gap-1">
                        <Icon as={Calendar} size={12} className="text-muted-foreground" />
                        <Text className="text-xs text-muted-foreground">
                          {format(date, 'MMM d, yyyy')}
                        </Text>
                      </View>
                      {document.summary && (
                        <Text className="mt-2 text-xs text-muted-foreground" numberOfLines={2}>
                          {document.summary}
                        </Text>
                      )}
                      {document.keyEntities && document.keyEntities.length > 0 && (
                        <View className="mt-2 flex-row flex-wrap gap-1">
                          {document.keyEntities.slice(0, 2).map((entity, idx) => (
                            <View
                              key={idx}
                              className="rounded-full border border-border bg-background px-2 py-0.5">
                              <Text className="text-[10px] text-muted-foreground">
                                {entity.name}: {entity.value}
                              </Text>
                            </View>
                          ))}
                          {document.keyEntities.length > 2 && (
                            <View className="rounded-full border border-border bg-background px-2 py-0.5">
                              <Text className="text-[10px] text-muted-foreground">
                                +{document.keyEntities.length - 2}
                              </Text>
                            </View>
                          )}
                        </View>
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
