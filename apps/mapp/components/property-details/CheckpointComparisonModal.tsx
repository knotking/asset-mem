import * as React from 'react';
import { Modal, View, Image, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { X, ArrowRight, Calendar } from 'lucide-react-native';
import { Checkpoint } from '@homeapp/common/types';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { compareCheckpoints, CompareCheckpointsOutput } from '../../lib/api';
import { useCheckpoint } from '@homeapp/common/contexts/checkpoint-context';
import { Timestamp } from 'firebase/firestore';
import { ActivityIndicator } from 'react-native';

interface CheckpointComparisonModalProps {
    visible: boolean;
    checkpoint1: Checkpoint | null;
    checkpoint2: Checkpoint | null;
    onClose: () => void;
}

export function CheckpointComparisonModal({
    visible,
    checkpoint1,
    checkpoint2,
    onClose,
}: CheckpointComparisonModalProps) {
    const insets = useSafeAreaInsets();
    const { updateCheckpoint } = useCheckpoint();
    const [loading, setLoading] = React.useState(false);
    const [analysis, setAnalysis] = React.useState<CompareCheckpointsOutput | null>(null);

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
            // Check if we already have analysis
            if (after.visualDiff) {
                setAnalysis({
                    summary: after.visualDiff.semanticChanges.join('\n'),
                    similarityScore: after.visualDiff.similarityScore,
                    semanticChanges: after.visualDiff.semanticChanges,
                    regions: after.visualDiff.regions.map((r) => ({
                        description: r.description,
                        changeType: r.changeType,
                        severity: r.severity,
                        confidence: r.confidence,
                        bbox: r.bbox,
                    })),
                });
                return;
            }

            const fetchAnalysis = async () => {
                setLoading(true);
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

                        setAnalysis(result);

                        // Save to Firestore
                        await updateCheckpoint(after.id, {
                            visualDiff: {
                                id: `diff_${Date.now()}`,
                                status: 'completed',
                                semanticChanges: result.semanticChanges,
                                regions: result.regions.map((r, i) => ({
                                    id: `region_${i}`,
                                    bbox: r.bbox || { x: 0, y: 0, width: 0, height: 0 },
                                    changeType: r.changeType,
                                    severity: r.severity,
                                    confidence: r.confidence,
                                    description: r.description,
                                    changePercentage: 0,
                                })),
                                similarityScore: result.similarityScore,
                                completedAt: Timestamp.now(),
                            },
                        });
                    }
                } catch (e) {
                    console.error('Comparison failed', e);
                } finally {
                    setLoading(false);
                }
            };

            fetchAnalysis();
        } else {
            setAnalysis(null);
            setLoading(false);
        }
    }, [visible, before?.id, after?.id]);

    const renderCheckpointPreview = (cp: Checkpoint, label: string) => {
        const imageUrl = cp.media?.[0]?.url;
        const date = cp.createdAt?.toDate ? cp.createdAt.toDate() : new Date();

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
                        {cp.name}
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
                <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
                    <Text className="text-lg font-semibold text-foreground">Compare Checkpoints</Text>
                    <Button onPress={onClose} variant="ghost" size="icon">
                        <Icon as={X} size={24} className="text-foreground" />
                    </Button>
                </View>

                <ScrollView className="flex-1 p-4">
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
                                <Text className="text-sm text-foreground">{analysis.summary}</Text>

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

                                {analysis.regions.length > 0 && (
                                    <View className="mt-2 gap-2">
                                        <Text className="text-xs font-medium text-muted-foreground">Detected Changes:</Text>
                                        {analysis.regions.map((region, index) => (
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
