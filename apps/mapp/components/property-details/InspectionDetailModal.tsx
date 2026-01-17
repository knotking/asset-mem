import * as React from 'react';
import { View, ScrollView, Modal, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileText,
  X,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Download,
  ExternalLink,
} from 'lucide-react-native';
import type { Document } from '@homeapp/common/types';
import { format } from 'date-fns';

interface InspectionDetailModalProps {
  inspection: Document | null;
  visible: boolean;
  onClose: () => void;
  onDownload: (url: string) => void;
}

export function InspectionDetailModal({
  inspection,
  visible,
  onClose,
  onDownload,
}: InspectionDetailModalProps) {
  if (!inspection) {
    return null;
  }

  const date = inspection.createdAt?.toDate ? inspection.createdAt.toDate() : new Date();
  const hasIssues = inspection.keyEntities?.some(
    (entity) =>
      entity.name.toLowerCase().includes('issue') ||
      entity.name.toLowerCase().includes('critical') ||
      entity.name.toLowerCase().includes('major')
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="max-h-[90%] rounded-t-3xl bg-background">
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-border p-4">
            <View className="flex-1 pr-4">
              <Text className="text-lg font-semibold text-foreground" numberOfLines={2}>
                {inspection.name}
              </Text>
              <View className="mt-1 flex-row items-center gap-1">
                <Icon as={Calendar} size={14} className="text-muted-foreground" />
                <Text className="text-sm text-muted-foreground">
                  {format(date, 'MMMM d, yyyy h:mm a')}
                </Text>
              </View>
            </View>
            <View className="gap-2">
              {inspection.status === 'complete' && (
                <View className="flex-row items-center gap-1 rounded-full bg-secondary px-3 py-1">
                  <Icon as={CheckCircle} size={12} className="text-foreground" />
                  <Text className="text-xs font-medium">Analyzed</Text>
                </View>
              )}
              {hasIssues && (
                <View className="flex-row items-center gap-1 rounded-full bg-destructive/10 px-3 py-1">
                  <Icon as={AlertTriangle} size={12} className="text-destructive" />
                  <Text className="text-xs font-medium text-destructive">Issues Found</Text>
                </View>
              )}
            </View>
            <Button variant="ghost" size="icon" onPress={onClose} className="ml-2">
              <Icon as={X} className="text-foreground" />
            </Button>
          </View>

          {/* Content */}
          <ScrollView className="flex-1 p-4">
            <View className="gap-6">
              {/* Summary Section */}
              {inspection.summary && (
                <View>
                  <Text className="mb-2 text-sm font-semibold text-foreground">Summary</Text>
                  <Card>
                    <CardContent className="p-3">
                      <Text className="text-sm text-muted-foreground">{inspection.summary}</Text>
                    </CardContent>
                  </Card>
                </View>
              )}

              {/* Key Information */}
              {inspection.keyEntities && inspection.keyEntities.length > 0 && (
                <View>
                  <Text className="mb-3 text-sm font-semibold text-foreground">
                    Key Information
                  </Text>
                  <View className="gap-3">
                    {inspection.keyEntities.map((entity, idx) => (
                      <Card key={idx}>
                        <CardContent className="p-3">
                          <Text className="text-xs font-medium text-muted-foreground">
                            {entity.name}
                          </Text>
                          <Text className="mt-1 text-sm text-foreground">{entity.value}</Text>
                        </CardContent>
                      </Card>
                    ))}
                  </View>
                </View>
              )}

              {/* Document Details */}
              <View>
                <Text className="mb-3 text-sm font-semibold text-foreground">
                  Document Details
                </Text>
                <Card>
                  <CardContent className="p-3">
                    <View className="gap-2">
                      <View className="flex-row items-center gap-2">
                        <Icon as={FileText} size={14} className="text-muted-foreground" />
                        <Text className="text-xs text-muted-foreground">Content Type:</Text>
                        <Text className="flex-1 text-xs text-foreground">
                          {inspection.contentType || 'application/pdf'}
                        </Text>
                      </View>
                      {inspection.propertyAddress && (
                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs text-muted-foreground">Property:</Text>
                          <Text className="flex-1 text-xs text-foreground">
                            {inspection.propertyAddress}
                          </Text>
                        </View>
                      )}
                    </View>
                  </CardContent>
                </Card>
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View className="border-t border-border p-4">
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => inspection.url && onDownload(inspection.url)}>
                <Icon as={Download} size={16} className="mr-2" />
                <Text>Download</Text>
              </Button>
              {inspection.url && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => onDownload(inspection.url!)}>
                  <Icon as={ExternalLink} size={16} className="mr-2" />
                  <Text>View</Text>
                </Button>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
