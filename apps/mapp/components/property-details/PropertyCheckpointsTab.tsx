import * as React from 'react';
import { View, FlatList, Image, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Camera, Plus, Clock, ChevronRight, Calendar, MapPin } from 'lucide-react-native';
import { useCheckpoint } from '@homeapp/common/contexts/checkpoint-context';
import { Checkpoint } from '@homeapp/common/types';
import { format } from 'date-fns';

export function PropertyCheckpointsTab() {
    const { checkpoints, loading, createCheckpoint } = useCheckpoint();

    const handleAddCheckpoint = () => {
        // TODO: Open camera modal
        console.log("Add checkpoint clicked");
    };

    if (loading) {
        return (
            <View className="p-4">
                <Text className="text-center text-muted-foreground">Loading checkpoints...</Text>
            </View>
        );
    }

    if (checkpoints.length === 0) {
        return (
            <View className="p-4">
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
                    <Button onPress={handleAddCheckpoint} className="w-full">
                        <View className="flex-row items-center gap-2">
                            <Icon as={Plus} size={20} className="text-primary-foreground" />
                            <Text className="text-primary-foreground">Create Checkpoint</Text>
                        </View>
                    </Button>
                </Card>
            </View>
        );
    }

    return (
        <View className="flex-1 p-4">
            <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-xl font-semibold text-foreground">Checkpoints</Text>
                <Button size="sm" onPress={handleAddCheckpoint}>
                    <View className="flex-row items-center gap-1">
                        <Icon as={Plus} size={16} className="text-primary-foreground" />
                        <Text className="text-primary-foreground">Add New</Text>
                    </View>
                </Button>
            </View>

            <FlatList
                data={checkpoints}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <CheckpointCard checkpoint={item} />}
                contentContainerStyle={{ gap: 12 }}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

function CheckpointCard({ checkpoint }: { checkpoint: Checkpoint }) {
    const thumbnail = checkpoint.media?.[0]?.thumbnailUrl || checkpoint.media?.[0]?.url;
    const date = checkpoint.createdAt?.toDate ? checkpoint.createdAt.toDate() : new Date();

    return (
        <Card>
            <Pressable className="flex-row overflow-hidden rounded-lg">
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
