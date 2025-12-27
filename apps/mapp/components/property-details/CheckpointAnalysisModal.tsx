import * as React from 'react';
import { Modal, View, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { X, TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle, Info } from 'lucide-react-native';
import { Checkpoint } from '@homeapp/common/types';
import { format } from 'date-fns';

interface CheckpointAnalysisModalProps {
  visible: boolean;
  checkpoints: Checkpoint[];
  onClose: () => void;
}

interface AnalysisResult {
  summary: string;
  trends: {
    label: string;
    value: string;
    direction: 'up' | 'down' | 'stable';
    description: string;
  }[];
  recommendations: string[];
  timeline: {
    date: Date;
    checkpointName: string;
    status: 'good' | 'warning' | 'critical';
    note: string;
  }[];
}

export function CheckpointAnalysisModal({
  visible,
  checkpoints,
  onClose,
}: CheckpointAnalysisModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [analysis, setAnalysis] = React.useState<AnalysisResult | null>(null);

  React.useEffect(() => {
    if (visible && checkpoints.length > 0) {
      analyzeCheckpoints();
    } else {
      setAnalysis(null);
    }
  }, [visible, checkpoints]);

  const analyzeCheckpoints = async () => {
    setLoading(true);
    try {
      // For now, generate a mock analysis based on checkpoint data
      // TODO: Replace with actual API call when backend is ready
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockAnalysis: AnalysisResult = generateMockAnalysis(checkpoints);
      setAnalysis(mockAnalysis);
    } catch (error) {
      console.error('Analysis failed', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMockAnalysis = (cps: Checkpoint[]): AnalysisResult => {
    // Sort by date
    const sorted = [...cps].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return dateA - dateB;
    });

    // Count issues
    let totalIssues = 0;
    let criticalCount = 0;
    sorted.forEach(cp => {
      const issues = cp.aiAnalysis?.issues || [];
      totalIssues += issues.length;
      issues.forEach((issue: any) => {
        if (issue.severity === 'critical') criticalCount++;
      });
    });

    const hasIssues = totalIssues > 0;
    const trend = criticalCount > 0 ? 'down' : (totalIssues > 2 ? 'down' : 'stable');

    return {
      summary: `Analysis of ${cps.length} checkpoint${cps.length !== 1 ? 's' : ''} spanning ${
        sorted.length > 1 
          ? `from ${format(sorted[0].createdAt?.toDate() || new Date(), 'MMM d')} to ${format(sorted[sorted.length - 1].createdAt?.toDate() || new Date(), 'MMM d')}`
          : format(sorted[0].createdAt?.toDate() || new Date(), 'MMM d, yyyy')
      }. ${
        hasIssues
          ? `Found ${totalIssues} issue${totalIssues !== 1 ? 's' : ''} across selected checkpoints${criticalCount > 0 ? `, including ${criticalCount} critical` : ''}.`
          : 'No significant issues detected in the selected checkpoints.'
      }`,
      trends: [
        {
          label: 'Overall Condition',
          value: hasIssues ? (criticalCount > 0 ? 'Declining' : 'Stable') : 'Good',
          direction: trend,
          description: hasIssues 
            ? 'Multiple issues detected requiring attention'
            : 'Property appears well-maintained',
        },
        {
          label: 'Issue Count',
          value: totalIssues.toString(),
          direction: totalIssues > 3 ? 'up' : 'stable',
          description: `${totalIssues} issue${totalIssues !== 1 ? 's' : ''} identified`,
        },
        {
          label: 'Checkpoints Analyzed',
          value: cps.length.toString(),
          direction: 'stable',
          description: `Covering ${cps.length} location${cps.length !== 1 ? 's' : ''}`,
        },
      ],
      recommendations: hasIssues
        ? [
            criticalCount > 0 ? 'Address critical issues immediately to prevent further damage' : 'Monitor identified issues and schedule maintenance',
            'Consider creating more frequent checkpoints in problem areas',
            'Document any repairs or improvements made',
          ]
        : [
            'Continue regular checkpoint monitoring',
            'Consider expanding coverage to other areas',
            'Maintain current maintenance schedule',
          ],
      timeline: sorted.map((cp, idx) => {
        const issues = cp.aiAnalysis?.issues || [];
        const hasCritical = issues.some((i: any) => i.severity === 'critical');
        const hasIssues = issues.length > 0;
        
        return {
          date: cp.createdAt?.toDate() || new Date(),
          checkpointName: cp.name || 'Untitled',
          status: hasCritical ? 'critical' : (hasIssues ? 'warning' : 'good'),
          note: hasCritical
            ? `Critical issues detected`
            : hasIssues
            ? `${issues.length} issue${issues.length !== 1 ? 's' : ''} found`
            : 'No issues detected',
        };
      }),
    };
  };

  const getTrendIcon = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up':
        return TrendingUp;
      case 'down':
        return TrendingDown;
      default:
        return Minus;
    }
  };

  const getStatusIcon = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good':
        return CheckCircle;
      case 'warning':
        return AlertCircle;
      default:
        return AlertCircle;
    }
  };

  const getStatusColor = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good':
        return 'text-green-500';
      case 'warning':
        return 'text-yellow-500';
      default:
        return 'text-red-500';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">Checkpoint Analysis</Text>
            <Text className="text-xs text-muted-foreground">
              {checkpoints.length} checkpoint{checkpoints.length !== 1 ? 's' : ''} selected
            </Text>
          </View>
          <Button onPress={onClose} variant="ghost" size="icon">
            <Icon as={X} size={24} className="text-foreground" />
          </Button>
        </View>

        <ScrollView className="flex-1 p-4">
          {loading ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="large" />
              <Text className="mt-4 text-sm text-muted-foreground">Analyzing checkpoints...</Text>
            </View>
          ) : analysis ? (
            <View className="gap-4">
              {/* Summary Card */}
              <Card className="p-4">
                <View className="flex-row items-start gap-2 mb-2">
                  <Icon as={Info} size={18} className="text-primary mt-0.5" />
                  <Text className="text-sm font-semibold text-foreground flex-1">Summary</Text>
                </View>
                <Text className="text-sm text-foreground leading-relaxed">
                  {analysis.summary}
                </Text>
              </Card>

              {/* Trends */}
              <View>
                <Text className="text-base font-semibold text-foreground mb-3">Key Metrics</Text>
                <View className="gap-3">
                  {analysis.trends.map((trend, idx) => (
                    <Card key={idx} className="p-3">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-sm font-medium text-foreground">{trend.label}</Text>
                        <View className="flex-row items-center gap-1">
                          <Text className="text-lg font-bold text-foreground">{trend.value}</Text>
                          <Icon
                            as={getTrendIcon(trend.direction)}
                            size={16}
                            className={
                              trend.direction === 'up'
                                ? 'text-green-500'
                                : trend.direction === 'down'
                                ? 'text-red-500'
                                : 'text-muted-foreground'
                            }
                          />
                        </View>
                      </View>
                      <Text className="text-xs text-muted-foreground">{trend.description}</Text>
                    </Card>
                  ))}
                </View>
              </View>

              {/* Timeline */}
              <View>
                <Text className="text-base font-semibold text-foreground mb-3">Timeline</Text>
                <View className="gap-3">
                  {analysis.timeline.map((item, idx) => (
                    <Card key={idx} className="p-3">
                      <View className="flex-row items-start gap-3">
                        <Icon
                          as={getStatusIcon(item.status)}
                          size={20}
                          className={getStatusColor(item.status)}
                        />
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-foreground">
                            {item.checkpointName}
                          </Text>
                          <Text className="text-xs text-muted-foreground mt-0.5">
                            {format(item.date, 'MMM d, yyyy • h:mm a')}
                          </Text>
                          <Text className="text-xs text-foreground mt-1">{item.note}</Text>
                        </View>
                      </View>
                    </Card>
                  ))}
                </View>
              </View>

              {/* Recommendations */}
              <View>
                <Text className="text-base font-semibold text-foreground mb-3">
                  Recommendations
                </Text>
                <Card className="p-4">
                  <View className="gap-2">
                    {analysis.recommendations.map((rec, idx) => (
                      <View key={idx} className="flex-row items-start gap-2">
                        <View className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                        <Text className="flex-1 text-sm text-foreground">{rec}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              </View>
            </View>
          ) : (
            <View className="py-12 items-center justify-center">
              <Text className="text-sm text-muted-foreground">No analysis available</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

