import * as React from 'react';
import { View, ScrollView, Pressable, RefreshControl, Image, Linking } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Download,
  ExternalLink,
  Upload,
  Search,
  Filter,
} from 'lucide-react-native';
import type { Document } from '@homeapp/common/types';
import { useProperty } from '@homeapp/common/contexts/property-context';
import { format } from 'date-fns';
import { InspectionDetailModal } from './InspectionDetailModal';

interface PropertyInspectionsTabProps {
  setActiveTab: (tab: 'chat' | 'details' | 'timeline' | 'inspections') => void;
}

export function PropertyInspectionsTab({ setActiveTab }: PropertyInspectionsTabProps) {
  const { documents, isLoading } = useProperty();
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedInspection, setSelectedInspection] = React.useState<Document | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Filter to only inspection reports
  const inspectionReports = documents.filter(
    (doc) => doc.documentType === 'INSPECTION_REPORT'
  );

  // Filter by search query
  const filteredReports = inspectionReports.filter((doc) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      doc.name.toLowerCase().includes(query) ||
      doc.summary?.toLowerCase().includes(query) ||
      doc.keyEntities?.some((entity) =>
        entity.value.toLowerCase().includes(query)
      )
    );
  });

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Firestore real-time listener will handle refresh
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleInspectionPress = (inspection: Document) => {
    setSelectedInspection(inspection);
    setIsDetailModalVisible(true);
  };

  const handleDownload = (url: string) => {
    if (url) {
      Linking.openURL(url);
    }
  };

  const hasIssues = (doc: Document) => {
    return doc.keyEntities?.some(
      (entity) =>
        entity.name.toLowerCase().includes('issue') ||
        entity.name.toLowerCase().includes('critical') ||
        entity.name.toLowerCase().includes('major')
    );
  };

  // Calculate stats
  const totalReports = inspectionReports.length;
  const analyzedReports = inspectionReports.filter((doc) => doc.status === 'complete').length;
  const reportsWithIssues = inspectionReports.filter(hasIssues).length;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-muted-foreground">Loading inspection reports...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* Stats Cards */}
        <View className="gap-3 p-4">
          <View className="flex-row gap-3">
            {/* Total Reports */}
            <Card className="flex-1">
              <CardContent className="p-4">
                <View className="flex-row items-center gap-3">
                  <View className="rounded-full bg-primary/10 p-2">
                    <Icon as={FileText} size={20} className="text-primary" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-bold text-foreground">{totalReports}</Text>
                    <Text className="text-xs text-muted-foreground">Total Reports</Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* Analyzed */}
            <Card className="flex-1">
              <CardContent className="p-4">
                <View className="flex-row items-center gap-3">
                  <View className="rounded-full bg-green-100 p-2 dark:bg-green-900/20">
                    <Icon
                      as={CheckCircle}
                      size={20}
                      className="text-green-600 dark:text-green-400"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-bold text-foreground">{analyzedReports}</Text>
                    <Text className="text-xs text-muted-foreground">Analyzed</Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>

          {/* With Issues */}
          <Card>
            <CardContent className="p-4">
              <View className="flex-row items-center gap-3">
                <View className="rounded-full bg-red-100 p-2 dark:bg-red-900/20">
                  <Icon
                    as={AlertTriangle}
                    size={20}
                    className="text-red-600 dark:text-red-400"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-foreground">{reportsWithIssues}</Text>
                  <Text className="text-xs text-muted-foreground">Reports With Issues</Text>
                </View>
              </View>
            </CardContent>
          </Card>
        </View>

        {/* Inspection Reports List */}
        <View className="gap-3 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-foreground">Inspection Reports</Text>
            <Button
              variant="outline"
              size="sm"
              onPress={() => setActiveTab('details')}
              className="flex-row items-center gap-2">
              <Icon as={Upload} size={14} />
              <Text className="text-xs">Upload</Text>
            </Button>
          </View>

          {filteredReports.length === 0 ? (
            <View className="mt-8 items-center justify-center px-4">
              <View className="items-center justify-center rounded-full bg-muted p-6">
                <Icon as={FileText} size={40} className="text-muted-foreground" />
              </View>
              <Text className="mt-4 text-center text-lg font-semibold text-foreground">
                {searchQuery ? 'No matches found' : 'No Inspection Reports'}
              </Text>
              <Text className="mt-2 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? 'Try adjusting your search'
                  : 'Upload inspection reports in the Details tab'}
              </Text>
              {!searchQuery && (
                <Button
                  variant="default"
                  className="mt-4"
                  onPress={() => setActiveTab('details')}>
                  <Icon as={Upload} size={16} className="mr-2" />
                  <Text>Upload Report</Text>
                </Button>
              )}
            </View>
          ) : (
            <View className="gap-3">
              {filteredReports.map((report) => {
                const date = report.createdAt?.toDate ? report.createdAt.toDate() : new Date();
                const hasProblems = hasIssues(report);

                return (
                  <Card key={report.id}>
                    <Pressable onPress={() => handleInspectionPress(report)}>
                      <CardHeader className="pb-2">
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="flex-row items-start gap-3 flex-1">
                            <View className="rounded-lg bg-primary/10 p-2">
                              <Icon as={FileText} size={20} className="text-primary" />
                            </View>
                            <View className="flex-1">
                              <Text
                                className="font-semibold text-foreground"
                                numberOfLines={2}>
                                {report.name}
                              </Text>
                              <View className="mt-1 flex-row items-center gap-1">
                                <Icon as={Calendar} size={12} className="text-muted-foreground" />
                                <Text className="text-xs text-muted-foreground">
                                  {format(date, 'MMM d, yyyy')}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <View className="gap-1">
                            {report.status === 'complete' && (
                              <View className="flex-row items-center gap-1 rounded-full bg-secondary px-2 py-0.5">
                                <Icon as={CheckCircle} size={10} className="text-foreground" />
                                <Text className="text-[10px] font-medium">Analyzed</Text>
                              </View>
                            )}
                            {hasProblems && (
                              <View className="flex-row items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5">
                                <Icon as={AlertTriangle} size={10} className="text-destructive" />
                                <Text className="text-[10px] font-medium text-destructive">
                                  Issues
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </CardHeader>
                      {report.summary && (
                        <CardContent className="pt-0">
                          <Text className="text-xs text-muted-foreground" numberOfLines={2}>
                            {report.summary}
                          </Text>
                        </CardContent>
                      )}
                      {report.keyEntities && report.keyEntities.length > 0 && (
                        <CardContent className="border-t border-border pt-2">
                          <View className="flex-row flex-wrap gap-1">
                            {report.keyEntities.slice(0, 3).map((entity, idx) => (
                              <View
                                key={idx}
                                className="rounded-full border border-border bg-background px-2 py-0.5">
                                <Text className="text-[10px] text-muted-foreground">
                                  {entity.name}: {entity.value}
                                </Text>
                              </View>
                            ))}
                            {report.keyEntities.length > 3 && (
                              <View className="rounded-full border border-border bg-background px-2 py-0.5">
                                <Text className="text-[10px] text-muted-foreground">
                                  +{report.keyEntities.length - 3}
                                </Text>
                              </View>
                            )}
                          </View>
                        </CardContent>
                      )}
                    </Pressable>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <InspectionDetailModal
        inspection={selectedInspection}
        visible={isDetailModalVisible}
        onClose={() => {
          setIsDetailModalVisible(false);
          setSelectedInspection(null);
        }}
        onDownload={handleDownload}
      />
    </View>
  );
}
