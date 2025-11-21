import * as React from 'react';
import { Modal, View, Image, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { X, ArrowRight, Calendar } from 'lucide-react-native';
import { Checkpoint } from '@homeapp/common/types';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

    if (!checkpoint1 || !checkpoint2) return null;

    // Sort by date (older first)
    const sortedCheckpoints = [checkpoint1, checkpoint2].sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
        return dateA.getTime() - dateB.getTime();
    });

    const [before, after] = sortedCheckpoints;

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
                    <View className="rounded-lg border border-border bg-card p-4">
                        <Text className="mb-2 font-semibold text-foreground">Comparison Analysis</Text>
                        <Text className="text-sm text-muted-foreground">
                            AI comparison analysis will appear here. It will highlight differences, potential issues, or improvements between the two checkpoints.
                        </Text>

                        {/* TODO: Integrate actual AI comparison result here */}
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}
