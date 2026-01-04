import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import {
  FileText,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import type { Document } from '@homeapp/common/types';
import { format } from 'date-fns';

interface CheckpointReportCardProps {
  document: Document;
  onChatPress?: () => void;
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'text-destructive';
    case 'major':
      return 'text-orange-600';
    case 'moderate':
      return 'text-yellow-600';
    case 'minor':
      return 'text-blue-600';
    default:
      return 'text-muted-foreground';
  }
}

function getSeverityBgColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-destructive/10';
    case 'major':
      return 'bg-orange-100 dark:bg-orange-950';
    case 'moderate':
      return 'bg-yellow-100 dark:bg-yellow-950';
    case 'minor':
      return 'bg-blue-100 dark:bg-blue-950';
    default:
      return 'bg-secondary';
  }
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'critical':
      return AlertCircle;
    case 'major':
    case 'moderate':
      return AlertTriangle;
    case 'minor':
      return Info;
    default:
      return Info;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'excellent':
      return 'text-green-600';
    case 'good':
      return 'text-blue-600';
    case 'fair':
      return 'text-yellow-600';
    case 'poor':
      return 'text-orange-600';
    case 'critical':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
}

function getStatusBgColor(status: string): string {
  switch (status) {
    case 'excellent':
      return 'bg-green-100 dark:bg-green-950';
    case 'good':
      return 'bg-blue-100 dark:bg-blue-950';
    case 'fair':
      return 'bg-yellow-100 dark:bg-yellow-950';
    case 'poor':
      return 'bg-orange-100 dark:bg-orange-950';
    case 'critical':
      return 'bg-destructive/10';
    default:
      return 'bg-secondary';
  }
}

export function CheckpointReportCard({ document, onChatPress }: CheckpointReportCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const analysis = document.checkpointAnalysis;

  if (!analysis) {
    return null;
  }

  const createdDate = document.createdAt?.toDate
    ? document.createdAt.toDate()
    : new Date();

  const issuesBySeverity = {
    critical: analysis.issues?.filter((i) => i.severity === 'critical').length || 0,
    major: analysis.issues?.filter((i) => i.severity === 'major').length || 0,
    moderate: analysis.issues?.filter((i) => i.severity === 'moderate').length || 0,
    minor: analysis.issues?.filter((i) => i.severity === 'minor').length || 0,
  };

  const totalIssues = analysis.issues?.length || 0;

  return (
    <Card className="mb-4">
      <View className="p-4">
        {/* Header */}
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Icon as={FileText} size={20} className="text-primary" />
              <Text className="text-base font-semibold text-foreground">
                {document.name || 'Property Inspection Report'}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-muted-foreground">
              {format(createdDate, 'MMM d, yyyy')}
            </Text>
          </View>
          {analysis.propertyStatus && (
            <View
              className={`rounded-full px-3 py-1 ${getStatusBgColor(analysis.propertyStatus)}`}>
              <Text
                className={`text-xs font-semibold capitalize ${getStatusColor(analysis.propertyStatus)}`}>
                {analysis.propertyStatus}
              </Text>
            </View>
          )}
        </View>

        {/* Status Score */}
        {analysis.statusScore !== undefined && (
          <View className="mt-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted-foreground">Property Condition</Text>
              <Text className="text-sm font-semibold text-foreground">
                {analysis.statusScore}/100
              </Text>
            </View>
            <View className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <View
                className="h-full bg-primary"
                style={{ width: `${analysis.statusScore}%` }}
              />
            </View>
          </View>
        )}

        {/* Issues Summary */}
        {totalIssues > 0 && (
          <View className="mt-3">
            <Text className="mb-2 text-sm font-medium text-foreground">
              Issues Found ({totalIssues})
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {issuesBySeverity.critical > 0 && (
                <View className="flex-row items-center gap-1 rounded-full bg-destructive/10 px-2 py-1">
                  <Icon as={AlertCircle} size={12} className="text-destructive" />
                  <Text className="text-xs font-medium text-destructive">
                    {issuesBySeverity.critical} Critical
                  </Text>
                </View>
              )}
              {issuesBySeverity.major > 0 && (
                <View className="flex-row items-center gap-1 rounded-full bg-orange-100 px-2 py-1 dark:bg-orange-950">
                  <Icon as={AlertTriangle} size={12} className="text-orange-600" />
                  <Text className="text-xs font-medium text-orange-600">
                    {issuesBySeverity.major} Major
                  </Text>
                </View>
              )}
              {issuesBySeverity.moderate > 0 && (
                <View className="flex-row items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 dark:bg-yellow-950">
                  <Icon as={AlertTriangle} size={12} className="text-yellow-600" />
                  <Text className="text-xs font-medium text-yellow-600">
                    {issuesBySeverity.moderate} Moderate
                  </Text>
                </View>
              )}
              {issuesBySeverity.minor > 0 && (
                <View className="flex-row items-center gap-1 rounded-full bg-blue-100 px-2 py-1 dark:bg-blue-950">
                  <Icon as={Info} size={12} className="text-blue-600" />
                  <Text className="text-xs font-medium text-blue-600">
                    {issuesBySeverity.minor} Minor
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Overall Assessment */}
        {analysis.overallAssessment && (
          <View className="mt-3">
            <Text className="text-sm text-muted-foreground" numberOfLines={isExpanded ? undefined : 3}>
              {analysis.overallAssessment}
            </Text>
          </View>
        )}

        {/* Expand/Collapse Button */}
        {(analysis.issues && analysis.issues.length > 0) ||
        (analysis.recommendations && analysis.recommendations.length > 0) ||
        analysis.costEstimates ? (
          <Pressable
            onPress={() => setIsExpanded(!isExpanded)}
            className="mt-3 flex-row items-center justify-center gap-1 py-2">
            <Text className="text-sm font-medium text-primary">
              {isExpanded ? 'Show Less' : 'Show Details'}
            </Text>
            <Icon
              as={isExpanded ? ChevronUp : ChevronDown}
              size={16}
              className="text-primary"
            />
          </Pressable>
        ) : null}

        {/* Expanded Details */}
        {isExpanded && (
          <View className="mt-3 gap-3">
            {/* Issues List */}
            {analysis.issues && analysis.issues.length > 0 && (
              <View>
                <Text className="mb-2 text-sm font-semibold text-foreground">
                  Detailed Issues
                </Text>
                <View className="gap-2">
                  {analysis.issues.map((issue, index) => {
                    const SeverityIcon = getSeverityIcon(issue.severity);
                    return (
                      <View
                        key={index}
                        className={`rounded-lg border border-border p-3 ${getSeverityBgColor(issue.severity)}`}>
                        <View className="flex-row items-start gap-2">
                          <Icon
                            as={SeverityIcon}
                            size={16}
                            className={getSeverityColor(issue.severity)}
                          />
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2">
                              <Text
                                className={`text-xs font-semibold capitalize ${getSeverityColor(issue.severity)}`}>
                                {issue.severity}
                              </Text>
                              {issue.category && (
                                <Text className="text-xs text-muted-foreground">
                                  • {issue.category}
                                </Text>
                              )}
                            </View>
                            <Text className="mt-1 text-sm text-foreground">
                              {issue.description}
                            </Text>
                            {issue.recommendation && (
                              <Text className="mt-1 text-xs text-muted-foreground">
                                💡 {issue.recommendation}
                              </Text>
                            )}
                            {issue.estimatedCost && (
                              <Text className="mt-1 text-xs font-medium text-foreground">
                                Est. Cost: {issue.estimatedCost}
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Recommendations */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <View>
                <Text className="mb-2 text-sm font-semibold text-foreground">
                  Recommendations
                </Text>
                <View className="gap-2">
                  {analysis.recommendations.map((rec, index) => (
                    <View key={index} className="flex-row items-start gap-2">
                      <Icon as={CheckCircle} size={16} className="mt-0.5 text-primary" />
                      <Text className="flex-1 text-sm text-foreground">{rec}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Cost Estimates */}
            {analysis.costEstimates && (
              <View>
                <Text className="mb-2 text-sm font-semibold text-foreground">
                  Cost Estimates
                </Text>
                <View className="gap-2">
                  {analysis.costEstimates.immediate && (
                    <View className="rounded-lg border border-border bg-card p-3">
                      <Text className="text-xs font-medium text-muted-foreground">
                        Immediate
                      </Text>
                      <Text className="mt-1 text-sm text-foreground">
                        {analysis.costEstimates.immediate}
                      </Text>
                    </View>
                  )}
                  {analysis.costEstimates.shortTerm && (
                    <View className="rounded-lg border border-border bg-card p-3">
                      <Text className="text-xs font-medium text-muted-foreground">
                        Short-term (within 1 year)
                      </Text>
                      <Text className="mt-1 text-sm text-foreground">
                        {analysis.costEstimates.shortTerm}
                      </Text>
                    </View>
                  )}
                  {analysis.costEstimates.longTerm && (
                    <View className="rounded-lg border border-border bg-card p-3">
                      <Text className="text-xs font-medium text-muted-foreground">
                        Long-term (beyond 1 year)
                      </Text>
                      <Text className="mt-1 text-sm text-foreground">
                        {analysis.costEstimates.longTerm}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Chat Button */}
        {onChatPress && (
          <Button onPress={onChatPress} className="mt-3 w-full" variant="outline">
            <View className="flex-row items-center gap-2">
              <Icon as={MessageSquare} size={18} className="text-foreground" />
              <Text className="text-foreground">Chat about this report</Text>
            </View>
          </Button>
        )}
      </View>
    </Card>
  );
}

