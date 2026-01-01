import * as React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import {
  Sparkles,
  Package,
  Activity,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
} from 'lucide-react-native';
import { format } from 'date-fns';
import type { Checkpoint } from '@homeapp/common/types';

interface Issue {
  description?: string;
  severity?: 'minor' | 'moderate' | 'major' | 'critical';
  confidence?: number;
  category?: string;
}

interface AnalysisResultsProps {
  analysis: NonNullable<Checkpoint['aiAnalysis']>;
}

function getSeverityColor(severity?: string) {
  switch (severity) {
    case 'critical':
      return 'text-red-600';
    case 'major':
      return 'text-orange-600';
    case 'moderate':
      return 'text-yellow-600';
    default:
      return 'text-blue-600';
  }
}

function getSeverityBgColor(severity?: string) {
  switch (severity) {
    case 'critical':
      return 'bg-red-50';
    case 'major':
      return 'bg-orange-50';
    case 'moderate':
      return 'bg-yellow-50';
    default:
      return 'bg-blue-50';
  }
}

function getSeverityBorderColor(severity?: string) {
  switch (severity) {
    case 'critical':
      return 'border-red-200';
    case 'major':
      return 'border-orange-200';
    case 'moderate':
      return 'border-yellow-200';
    default:
      return 'border-blue-200';
  }
}

function IssuesList({ issues }: { issues: (string | Issue)[] }) {
  if (!issues || issues.length === 0) {
    return (
      <Card className="flex-row items-center gap-3 p-4">
        <Icon as={CheckCircle} size={20} className="text-green-500" />
        <Text className="flex-1 text-sm text-muted-foreground">
          No issues detected in this checkpoint
        </Text>
      </Card>
    );
  }

  const normalizedIssues: Issue[] = issues.map((issue) =>
    typeof issue === 'string' ? { description: issue, severity: 'minor' } : issue
  );

  // Group by severity
  const critical = normalizedIssues.filter((i) => i.severity === 'critical');
  const major = normalizedIssues.filter((i) => i.severity === 'major');
  const moderate = normalizedIssues.filter((i) => i.severity === 'moderate');
  const minor = normalizedIssues.filter((i) => i.severity === 'minor' || !i.severity);

  const renderIssueGroup = (groupIssues: Issue[], title: string, severity: string) => {
    if (groupIssues.length === 0) return null;

    const SeverityIcon =
      severity === 'critical'
        ? AlertCircle
        : severity === 'major' || severity === 'moderate'
          ? AlertTriangle
          : Info;

    return (
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <Icon as={SeverityIcon} size={16} className={getSeverityColor(severity)} />
          <Text className="text-sm font-semibold text-foreground">{title}</Text>
          <View className="rounded-full bg-secondary px-2 py-0.5">
            <Text className="text-xs text-muted-foreground">{groupIssues.length}</Text>
          </View>
        </View>
        <View className="gap-2 pl-6">
          {groupIssues.map((issue, idx) => (
            <View
              key={idx}
              className={`rounded-lg border p-3 ${getSeverityBgColor(issue.severity)} ${getSeverityBorderColor(issue.severity)}`}>
              <Text className={`text-sm ${getSeverityColor(issue.severity)}`}>
                {issue.description}
              </Text>
              {(issue.category || issue.confidence) && (
                <View className="mt-2 flex-row items-center gap-3">
                  {issue.category && (
                    <View className="rounded border border-border bg-background px-2 py-0.5">
                      <Text className="text-xs text-foreground">{issue.category}</Text>
                    </View>
                  )}
                  {issue.confidence && (
                    <Text className="text-xs text-muted-foreground">
                      Confidence: {Math.round(issue.confidence * 100)}%
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Card className="gap-6 p-4">
      <Text className="text-base font-semibold text-foreground">Detected Issues</Text>
      <View className="gap-6">
        {renderIssueGroup(critical, 'Critical Issues', 'critical')}
        {renderIssueGroup(major, 'Major Issues', 'major')}
        {renderIssueGroup(moderate, 'Moderate Issues', 'moderate')}
        {renderIssueGroup(minor, 'Minor Issues', 'minor')}
      </View>
    </Card>
  );
}

export function AnalysisResults({ analysis }: AnalysisResultsProps) {
  const analyzedAt = analysis.analyzedAt?.toDate
    ? analysis.analyzedAt.toDate()
    : analysis.analyzedAt instanceof Date
      ? analysis.analyzedAt
      : new Date();

  return (
    <View className="gap-4">
      {/* Summary Card */}
      <Card className="p-4">
        <View className="mb-3 flex-row items-center gap-2">
          <Icon as={Sparkles} size={16} className="text-foreground" />
          <Text className="text-base font-semibold text-foreground">AI Analysis Summary</Text>
        </View>
        <Text className="text-sm leading-5 text-foreground">{analysis.summary}</Text>
        {analysis.aiConfidence && (
          <View className="mt-3 flex-row items-center gap-2">
            <Icon as={Activity} size={12} className="text-muted-foreground" />
            <Text className="text-xs text-muted-foreground">
              Confidence: {Math.round(analysis.aiConfidence * 100)}%
            </Text>
            <Text className="text-xs text-muted-foreground"> • </Text>
            <Text className="text-xs text-muted-foreground">
              Analyzed {format(analyzedAt, 'MMM dd, yyyy · h:mm a')}
            </Text>
          </View>
        )}
      </Card>

      {/* Detected Items */}
      {analysis.detectedItems && analysis.detectedItems.length > 0 && (
        <Card className="p-4">
          <View className="mb-3 flex-row items-center gap-2">
            <Icon as={Package} size={16} className="text-foreground" />
            <Text className="text-base font-semibold text-foreground">Detected Items</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {analysis.detectedItems.map((item, idx) => (
              <View key={idx} className="rounded-full bg-secondary px-3 py-1">
                <Text className="text-xs text-foreground">{item}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Conditions */}
      {analysis.conditions && analysis.conditions.length > 0 && (
        <Card className="p-4">
          <Text className="mb-3 text-base font-semibold text-foreground">Conditions</Text>
          <View className="flex-row flex-wrap gap-2">
            {analysis.conditions.map((condition, idx) => (
              <View key={idx} className="rounded-full border border-border bg-card px-3 py-1">
                <Text className="text-xs text-foreground">{condition}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Issues */}
      {analysis.issues && <IssuesList issues={analysis.issues} />}

      {/* Issues by Severity Summary */}
      {analysis.issues_by_severity && (
        <Card className="p-4">
          <Text className="mb-3 text-base font-semibold text-foreground">Issues Summary</Text>
          <View className="flex-row flex-wrap gap-4">
            {analysis.issues_by_severity.critical !== undefined && (
              <View className="items-center">
                <Text className="text-2xl font-bold text-red-600">
                  {analysis.issues_by_severity.critical}
                </Text>
                <Text className="text-xs text-muted-foreground">Critical</Text>
              </View>
            )}
            {analysis.issues_by_severity.major !== undefined && (
              <View className="items-center">
                <Text className="text-2xl font-bold text-orange-600">
                  {analysis.issues_by_severity.major}
                </Text>
                <Text className="text-xs text-muted-foreground">Major</Text>
              </View>
            )}
            {analysis.issues_by_severity.moderate !== undefined && (
              <View className="items-center">
                <Text className="text-2xl font-bold text-yellow-600">
                  {analysis.issues_by_severity.moderate}
                </Text>
                <Text className="text-xs text-muted-foreground">Moderate</Text>
              </View>
            )}
            {analysis.issues_by_severity.minor !== undefined && (
              <View className="items-center">
                <Text className="text-2xl font-bold text-blue-600">
                  {analysis.issues_by_severity.minor}
                </Text>
                <Text className="text-xs text-muted-foreground">Minor</Text>
              </View>
            )}
          </View>
        </Card>
      )}
    </View>
  );
}

