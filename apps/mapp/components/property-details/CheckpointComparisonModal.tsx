import * as React from 'react';
import { Modal, View, Image, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { X, ArrowRight, Calendar } from 'lucide-react-native';
import { Checkpoint, VisualDiffAnalysis } from '@homeapp/common/types';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { compareCheckpoints, CompareCheckpointsOutput } from '../../lib/api';
import { useCheckpoint } from '@homeapp/common/contexts/checkpoint-context';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useProperty } from '@homeapp/common/contexts/property-context';
import { useFirebase } from '@homeapp/common/contexts/firebase-context';
import {
  buildVisualDiffFromCompareResult,
  persistCheckpointComparison,
} from '@homeapp/common/lib/checkpoint-comparisons';
import { Timestamp } from 'firebase/firestore';
import { ActivityIndicator } from 'react-native';
import { getPlanLimitFailureMessage } from '@homeapp/common/lib/document-analysis-errors';
import { createLogger } from '@/lib/logger';

const checkpointLog = createLogger('checkpoint');

interface CheckpointComparisonModalProps {
    visible: boolean;
    checkpoint1: Checkpoint | null;
    checkpoint2: Checkpoint | null;
    onClose: () => void;
    initialVisualDiff?: VisualDiffAnalysis | null;
}

export function CheckpointComparisonModal({
    visible,
    checkpoint1,
    checkpoint2,
    onClose,
    initialVisualDiff,
}: CheckpointComparisonModalProps) {
    const insets = useSafeAreaInsets();
    const { updateCheckpoint } = useCheckpoint();
    const { user } = useAuth();
    const { property } = useProperty();
    const { db } = useFirebase();
    const [loading, setLoading] = React.useState(false);
    const [analysis, setAnalysis] = React.useState<CompareCheckpointsOutput | null>(null);
    const [comparisonError, setComparisonError] = React.useState<string | null>(null);

    const normalizeAnalysis = React.useCallback(
        (input: Partial<CompareCheckpointsOutput> | null | undefined): CompareCheckpointsOutput | null => {
            if (!input) return null;
            return {
                summary: input.summary ?? '',
                similarityScore: typeof input.similarityScore === 'number' ? input.similarityScore : 0,
                semanticChanges: Array.isArray(input.semanticChanges) ? input.semanticChanges : [],
                regions: Array.isArray(input.regions) ? input.regions : [],
            };
        },
        []
    );

    // Sort by date (older first)
    const sortedCheckpoints = React.useMemo(() => {
        if (!checkpoint1 || !checkpoint2) return [];
        return [checkpoint1, checkpoint2].sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
            return dateA.getTime() - dateB.getTime();
        });
    }, [checkpoint1, checkpoint2]);

    const [before, after] = sortedCheckpoints;

    React.useEffect(() => {
        if (visible && before && after) {
            const cached =
                initialVisualDiff?.comparedWithCheckpointId === before.id
                    ? initialVisualDiff
                    : after.visualDiff?.comparedWithCheckpointId === before.id
                      ? after.visualDiff
                      : null;

            if (cached) {
                const semanticChanges = Array.isArray(cached.semanticChanges)
                    ? cached.semanticChanges
                    : [];
                const regions = Array.isArray(cached.regions) ? cached.regions : [];

                setAnalysis(
                    normalizeAnalysis({
                        summary: cached.summary || semanticChanges.join('\n'),
                        similarityScore: cached.similarityScore,
                        semanticChanges,
                        regions: regions.map((r) => ({
                            description: r.description,
                            changeType: r.changeType,
                            severity: r.severity,
                            confidence: r.confidence,
                            bbox: r.bbox,
                        })),
                    })
                );
                return;
            }

            const fetchAnalysis = async () => {
                setLoading(true);
                setComparisonError(null);
                try {
                    const image1 = before.media?.[0];
                    const image2 = after.media?.[0];

                    if (image1?.gsURI && image2?.gsURI) {
                        const result = await compareCheckpoints({
                            image1Url: image1.gsURI,
                            image2Url: image2.gsURI,
                            contentType1: image1.contentType,
                            contentType2: image2.contentType,
                            location: after.location,
                        });

                        const normalized = normalizeAnalysis(result);
                        setAnalysis(normalized);

                        const visualDiff = buildVisualDiffFromCompareResult({
                            result: normalized ?? {},
                            comparedWithCheckpointId: before.id,
                            matchReason: 'manual',
                            comparedWithRevisionNumber: before.revisionNumber,
                            completedAt: Timestamp.now(),
                        });

                        if (user && property && db) {
                            await persistCheckpointComparison(db, {
                                userId: user.uid,
                                propertyId: property.id,
                                checkpointId: after.id,
                                visualDiff,
                                source: 'manual',
                            });
                        } else {
                            await updateCheckpoint(after.id, { visualDiff });
                        }
                    }
                } catch (e) {
                    checkpointLog.error('comparison.failed', undefined, e);
                    setComparisonError(getPlanLimitFailureMessage(e));
                    setAnalysis(null);
                } finally {
                    setLoading(false);
                }
            };

            fetchAnalysis();
        } else {
            setAnalysis(null);
            setLoading(false);
        }
    }, [visible, before?.id, after?.id, initialVisualDiff, after?.visualDiff, normalizeAnalysis, user, property, db, updateCheckpoint]);

    const renderCheckpointPreview = (cp: Checkpoint | null | undefined, label: string) => {
        const imageUrl = cp?.media?.[0]?.url;
        const date = cp?.createdAt?.toDate ? cp.createdAt.toDate() : new Date();

        return (
            <View className="flex-1 gap-2">
                <Text className="text-center font-semibold text-foreground">{label}</Text>
                <View className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted border border-border">
                    {imageUrl ? (
                        <Image
                            source={{ uri: imageUrl }}
                            className="h-full w-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="h-full w-full items-center justify-center">
                            <Text className="text-xs text-muted-foreground">No Image</Text>
                        </View>
                    )}
                </View>
                <View className="items-center">
                    <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                        {cp?.name || '—'}
                    </Text>
                    <Text className="text-[10px] text-muted-foreground">
                        {format(date, 'MMM d, yyyy')}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View className="flex-1 bg-background">
                {/* Header */}
                <View
                  className="flex-row items-center justify-between border-b border-border px-4"
                  style={{ paddingTop: 12, paddingBottom: 12 }}>
                  <Text className="text-lg font-semibold text-foreground">Compare Checkpoints</Text>
                    <Button onPress={onClose} variant="ghost" size="icon">
                        <Icon as={X} size={24} className="text-foreground" />
                    </Button>
                </View>

                <ScrollView
                  className="flex-1 p-4"
                  contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}>
                    {/* Side by Side Comparison */}
                    <View className="flex-row gap-4 mb-6">
                        {renderCheckpointPreview(before, 'Before')}
                        <View className="justify-center pt-6">
                            <Icon as={ArrowRight} size={20} className="text-muted-foreground" />
                        </View>
                        {renderCheckpointPreview(after, 'After')}
                    </View>

                    {/* Analysis Section (Placeholder) */}
                    {/* Analysis Section */}
                    <View className="rounded-lg border border-border bg-card p-4">
                        <Text className="mb-2 font-semibold text-foreground">Comparison Analysis</Text>
                        {loading ? (
                            <View className="py-4 items-center">
                                <ActivityIndicator size="small" className="mb-2" />
                                <Text className="text-sm text-muted-foreground">Analyzing differences...</Text>
                            </View>
                        ) : analysis ? (
                            <View className="gap-3">
                                <Text className="text-sm text-foreground">
                                    {analysis.summary?.trim()
                                        ? analysis.summary
                                        : analysis.similarityScore >= 0.98
                                            ? 'No significant differences detected.'
                                            : 'No comparison summary available.'}
                                </Text>

                                <View className="flex-row items-center gap-2">
                                    <Text className="text-xs font-medium text-muted-foreground">Similarity Score:</Text>
                                    <View className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                        <View
                                            className="h-full bg-primary"
                                            style={{ width: `${analysis.similarityScore * 100}%` }}
                                        />
                                    </View>
                                    <Text className="text-xs font-medium text-foreground">
                                        {Math.round(analysis.similarityScore * 100)}%
                                    </Text>
                                </View>

                                {(analysis.regions?.length || 0) > 0 && (
                                    <View className="mt-2 gap-2">
                                        <Text className="text-xs font-medium text-muted-foreground">Detected Changes:</Text>
                                        {(analysis.regions || []).map((region, index) => (
                                            <View key={index} className="flex-row items-start gap-2 rounded bg-muted/50 p-2">
                                                <View
                                                    className={`mt-1 h-2 w-2 rounded-full ${region.changeType === 'added'
                                                            ? 'bg-green-500'
                                                            : region.changeType === 'removed'
                                                                ? 'bg-red-500'
                                                                : 'bg-yellow-500'
                                                        }`}
                                                />
                                                <View className="flex-1">
                                                    <Text className="text-xs font-medium text-foreground">
                                                        {region.description}
                                                    </Text>
                                                    <Text className="text-[10px] capitalize text-muted-foreground">
                                                        {region.changeType} • {region.severity} severity
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ) : comparisonError ? (
                            <Text className="text-sm text-destructive">{comparisonError}</Text>
                        ) : (
                            <Text className="text-sm text-muted-foreground">
                                Unable to generate analysis. Please try again later.
                            </Text>
                        )}
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}
