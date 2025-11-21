import * as React from 'react';
import { View, FlatList, Image, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Camera, Plus, Calendar, MapPin, ChevronRight } from 'lucide-react-native';
import { useCheckpoint } from '@homeapp/common/contexts/checkpoint-context';
import { Checkpoint } from '@homeapp/common/types';
import { format } from 'date-fns';
import { CreateCheckpointModal } from './CreateCheckpointModal';
import { CheckpointDetailModal } from './CheckpointDetailModal';
import * as ImagePicker from 'expo-image-picker';

function CheckpointCard({
    checkpoint,
    onPress,
}: {
    checkpoint: Checkpoint;
    onPress: (checkpoint: Checkpoint) => void;
}) {
    const thumbnail = checkpoint.media?.[0]?.thumbnailUrl || checkpoint.media?.[0]?.url;
    const date = checkpoint.createdAt?.toDate ? checkpoint.createdAt.toDate() : new Date();

    return (
        <Card>
            <Pressable
                onPress={() => onPress(checkpoint)}
                className="flex-row overflow-hidden rounded-lg">
                {/* Thumbnail Image */}
                <View className="h-24 w-24 bg-muted">
                    {thumbnail ? (
                        <Image
                            source={{ uri: thumbnail }}
                            className="h-full w-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="h-full w-full items-center justify-center">
                            <Icon as={Camera} size={24} className="text-muted-foreground" />
                        </View>
                    )}
                </View>

                {/* Content */}
                <View className="flex-1 justify-between p-3">
                    <View>
                        <View className="flex-row items-start justify-between">
                            <Text className="font-semibold text-foreground" numberOfLines={1}>
                                {checkpoint.name || 'Untitled Checkpoint'}
                            </Text>
                            {checkpoint.aiAnalysis?.conditions?.includes('damage detected') && (
                                <View className="rounded-full bg-destructive/10 px-2 py-0.5">
                                    <Text className="text-[10px] font-medium text-destructive">Issue Detected</Text>
                                </View>
                            )}
                        </View>

                        {checkpoint.location && (
                            <View className="mt-1 flex-row items-center gap-1">
                                <Icon as={MapPin} size={12} className="text-muted-foreground" />
                                <Text className="text-xs text-muted-foreground">{checkpoint.location}</Text>
                            </View>
                        )}
                    </View>

                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-1">
                            <Icon as={Calendar} size={12} className="text-muted-foreground" />
                            <Text className="text-xs text-muted-foreground">
                                {format(date, 'MMM d, yyyy')}
                            </Text>
                        </View>

                        <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
                    </View>
                </View>
            </Pressable>
        </Card>
    );
}

export function PropertyCheckpointsTab() {
    const { checkpoints, loading, createCheckpoint } = useCheckpoint();
    const [isCreateModalVisible, setIsCreateModalVisible] = React.useState(false);
    const [selectedCheckpoint, setSelectedCheckpoint] = React.useState<Checkpoint | null>(null);
    const [isDetailModalVisible, setIsDetailModalVisible] = React.useState(false);

    const handleCreateCheckpoint = async (data: {
        name: string;
        location: string;
        imageAsset: ImagePicker.ImagePickerAsset;
    }) => {
        await createCheckpoint(
            {
                name: data.name,
                location: data.location,
            },
            [
                {
                    uri: data.imageAsset.uri,
                    type: 'image',
                },
            ]
        );
    };

    const handleCheckpointPress = (checkpoint: Checkpoint) => {
        setSelectedCheckpoint(checkpoint);
        setIsDetailModalVisible(true);
    };

    if (loading) {
        return (
            <View className="p-4">
                <Text className="text-center text-muted-foreground">Loading checkpoints...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 p-4">
            {checkpoints.length === 0 ? (
                <Card className="items-center p-6">
                    <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <Icon as={Camera} size={32} className="text-primary" />
                    </View>
                    <Text className="mb-2 text-center text-lg font-semibold text-foreground">
                        No Checkpoints Yet
                    </Text>
                    <Text className="mb-6 text-center text-sm text-muted-foreground">
                        Create your first checkpoint to start tracking changes over time.
                    </Text>
                    <Button onPress={() => setIsCreateModalVisible(true)} className="w-full">
                        <View className="flex-row items-center gap-2">
                            <Icon as={Plus} size={20} className="text-primary-foreground" />
                            <Text className="text-primary-foreground">Create Checkpoint</Text>
                        </View>
                    </Button>
                </Card>
            ) : (
                <>
                    <View className="mb-4 flex-row items-center justify-between">
                        <Text className="text-xl font-semibold text-foreground">Checkpoints</Text>
                        <Button size="sm" onPress={() => setIsCreateModalVisible(true)}>
                            <View className="flex-row items-center gap-1">
                                <Icon as={Plus} size={16} className="text-primary-foreground" />
                                <Text className="text-primary-foreground">Add New</Text>
                            </View>
                        </Button>
                    </View>

                    <FlatList
                        data={checkpoints}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <CheckpointCard checkpoint={item} onPress={handleCheckpointPress} />
                        )}
                        contentContainerStyle={{ gap: 12 }}
                        showsVerticalScrollIndicator={false}
                    />
                </>
            )}

            <CreateCheckpointModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
                onCreate={handleCreateCheckpoint}
            />

            <CheckpointDetailModal
                visible={isDetailModalVisible}
                checkpoint={selectedCheckpoint}
                onClose={() => setIsDetailModalVisible(false)}
            />
        </View>
    );
}
