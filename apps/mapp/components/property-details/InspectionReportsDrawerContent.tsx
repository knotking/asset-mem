import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { FileSearch, X } from 'lucide-react-native';
import type { Document } from '@homeapp/common/types';

interface InspectionReportsDrawerContentProps {
  inspectionReports: Document[];
  selectedInspectionReports: Document[];
  onClose: () => void;
  onToggleInspectionReport: (doc: Document) => void;
}

export function InspectionReportsDrawerContent({
  inspectionReports,
  selectedInspectionReports,
  onClose,
  onToggleInspectionReport,
}: InspectionReportsDrawerContentProps) {
  return (
    <>
      <View className="border-b border-border bg-light-background-alt px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">Select Inspection Reports</Text>
            <Text className="text-sm text-muted-foreground">
              {selectedInspectionReports.length} selected for chat context
            </Text>
          </View>
          <Button onPress={onClose} variant="ghost" size="icon" className="ml-2">
            <Icon as={X} size={24} className="text-foreground" />
          </Button>
        </View>
      </View>
      <ScrollView className="flex-1 px-4 py-4">
        {inspectionReports.length === 0 ? (
          <View className="items-center py-8">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Icon as={FileSearch} size={32} className="text-muted-foreground" />
            </View>
            <Text className="text-center text-muted-foreground">
              No inspection reports for this property.
            </Text>
            <Text className="mt-2 text-center text-sm text-muted-foreground">
              Add documents classified as INSPECTION_REPORT to use this feature.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            <View className="rounded-lg bg-secondary p-3">
              <Text className="text-sm text-muted-foreground">
                Select inspection reports to provide context for your chat. The AI will analyze these
                reports to answer questions about findings, issues, and recommendations.
              </Text>
            </View>
            {inspectionReports.map((doc) => {
              const isSelected = selectedInspectionReports.some((d) => d.id === doc.id);
              return (
                <Pressable
                  key={doc.id}
                  onPress={() => onToggleInspectionReport(doc)}
                  className={`rounded-lg border p-4 ${
                    isSelected ? 'border-primary bg-secondary' : 'border-border bg-card'
                  }`}>
                  <View className="flex-row items-start gap-3">
                    <View
                      className={`h-10 w-10 items-center justify-center rounded-full ${
                        isSelected ? 'bg-primary' : 'bg-secondary'
                      }`}>
                      <Icon
                        as={FileSearch}
                        size={20}
                        className={isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground" numberOfLines={2}>
                        {doc.name}
                      </Text>
                      {doc.summary && (
                        <Text className="mt-2 text-xs text-muted-foreground" numberOfLines={2}>
                          {doc.summary}
                        </Text>
                      )}
                    </View>
                    {isSelected && (
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
