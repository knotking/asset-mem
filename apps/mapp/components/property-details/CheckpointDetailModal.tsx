import * as React from 'react';
import { Modal, View, Image, ScrollView, Alert } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { X, MapPin, Calendar, Trash2, Edit2, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react-native';
import { Checkpoint } from '@homeapp/common/types';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCheckpoint } from '@homeapp/common/contexts/checkpoint-context';

interface CheckpointDetailModalProps {
    visible: boolean;
    checkpoint: Checkpoint | null;
    onClose: () => void;
}

export function CheckpointDetailModal({ visible, checkpoint, onClose }: CheckpointDetailModalProps) {
    const insets = useSafeAreaInsets();
    const { deleteCheckpoint } = useCheckpoint();
    const [isDeleting, setIsDeleting] = React.useState(false);

    if (!checkpoint) return null;

    const imageUrl = checkpoint.media?.[0]?.url;
    const date = checkpoint.createdAt?.toDate ? checkpoint.createdAt.toDate() : new Date();
    const hasIssues = checkpoint.aiAnalysis?.conditions?.includes('damage detected');

    const handleDelete = () => {
        Alert.alert(
            "Delete Checkpoint",
            "Are you sure you want to delete this checkpoint? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsDeleting(true);
                            await deleteCheckpoint(checkpoint.id);
                            onClose();
                        } catch (error) {
                            console.error("Error deleting checkpoint:", error);
                            Alert.alert("Error", "Failed to delete checkpoint");
                        } finally {
                            setIsDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View className="flex-1 bg-background">
                {/* Header */}
                <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
                    <View className="flex-1">
                        <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
                            {checkpoint.name || 'Untitled Checkpoint'}
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                            {format(date, 'MMMM d, yyyy • h:mm a')}
                        </Text>
                    </View>
                    <Button onPress={onClose} variant="ghost" size="icon">
                        <Icon as={X} size={24} className="text-foreground" />
                    </Button>
                </View>

                <ScrollView className="flex-1">
                    {/* Image */}
                    <View className="h-72 w-full bg-muted">
                        {imageUrl ? (
                            <Image
                                source={{ uri: imageUrl }}
                                className="h-full w-full"
                                resizeMode="cover"
                            />
                        ) : (
                            <View className="h-full w-full items-center justify-center">
                                <Text className="text-muted-foreground">No Image Available</Text>
                            </View>
                        )}
                    </View>

                    {/* Content */}
                    <View className="p-4 gap-6">
                        {/* Location */}
                        {checkpoint.location && (
                            <View className="flex-row items-center gap-2">
                                <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
                                    <Icon as={MapPin} size={16} className="text-foreground" />
                                </View>
                                <View>
                                    <Text className="text-xs text-muted-foreground">Location</Text>
                                    <Text className="font-medium text-foreground">{checkpoint.location}</Text>
                                </View>
                            </View>
                        )}

                        {/* AI Analysis Status */}
                        <View className="rounded-lg border border-border bg-card p-4">
                            <Text className="mb-3 font-semibold text-foreground">AI Analysis</Text>

                            {checkpoint.analysisStatus === 'pending' && (
                                <View className="flex-row items-center gap-2">
                                    <Icon as={Loader2} size={16} className="text-muted-foreground" />
                                    <Text className="text-sm text-muted-foreground">Analysis pending...</Text>
                                </View>
                            )}

                            {checkpoint.analysisStatus === 'processing' && (
                                <View className="flex-row items-center gap-2">
                                    <Icon as={Loader2} size={16} className="animate-spin text-primary" />
                                    <Text className="text-sm text-foreground">Analysis in progress...</Text>
                                </View>
                            )}

                            {checkpoint.analysisStatus === 'failed' && (
                                <View className="gap-3">
                                    <View className="flex-row items-center gap-2">
                                        <Icon as={AlertTriangle} size={20} className="text-destructive" />
                                        <Text className="font-medium text-destructive">Analysis Failed</Text>
                                    </View>
                                    <Text className="text-sm text-muted-foreground">
                                        Unable to analyze this checkpoint. Please try again later.
                                    </Text>
                                </View>
                            )}

                            {checkpoint.analysisStatus === 'completed' && checkpoint.aiAnalysis && (
                                <View className="gap-3">
                                    <View className="flex-row items-center gap-2">
                                        <Icon
                                            as={hasIssues ? AlertTriangle : CheckCircle}
                                            size={20}
                                            className={hasIssues ? "text-destructive" : "text-green-500"}
                                        />
                                        <Text className="font-medium text-foreground">
                                            {hasIssues ? "Issues Detected" : "No Issues Detected"}
                                        </Text>
                                    </View>

                                    {checkpoint.aiAnalysis.summary && (
                                        <Text className="text-sm text-muted-foreground leading-5">
                                            {checkpoint.aiAnalysis.summary}
                                        </Text>
                                    )}
                                </View>
                            )}

                            {!checkpoint.analysisStatus && (
                                <View className="flex-row items-center gap-2">
                                    <Icon as={Loader2} size={16} className="text-muted-foreground" />
                                    <Text className="text-sm text-muted-foreground">Analysis status unknown</Text>
                                </View>
                            )}
                        </View>

                        {/* Actions */}
                        <View className="flex-row gap-4 mt-4">
                            <Button
                                variant="destructive"
                                className="flex-1"
                                onPress={handleDelete}
                                disabled={isDeleting}
                            >
                                <View className="flex-row items-center gap-2">
                                    <Icon as={Trash2} size={16} className="text-destructive-foreground" />
                                    <Text className="text-destructive-foreground">Delete Checkpoint</Text>
                                </View>
                            </Button>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}
