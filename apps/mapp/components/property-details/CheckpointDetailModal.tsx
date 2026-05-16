import * as React from 'react';
import { Modal, View, ScrollView, Alert, Dimensions, FlatList, ViewToken, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  X,
  MapPin,
  Calendar,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Clock,
  Info,
  Tag,
  Award,
} from 'lucide-react-native';
import { Checkpoint, CheckpointMedia } from '@homeapp/common/types';
import { createLogger } from '@/lib/logger';

const checkpointLog = createLogger('checkpoint');
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCheckpoint } from '@homeapp/common/contexts/checkpoint-context';
import { PortalHost } from '@rn-primitives/portal';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AnalysisResults } from './AnalysisResults';
import { Separator } from '@/components/ui/separator';

interface CheckpointDetailModalProps {
  visible: boolean;
  checkpoint: Checkpoint | null;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MediaItem = React.memo(({ media, isVisible }: { media: CheckpointMedia; isVisible: boolean }) => {
  const isVideo = media.contentType?.startsWith('video/');
  
  // Always initialize player (with fallback for non-videos) to maintain consistent hook order
  const player = useVideoPlayer(
    isVideo ? media.url : 'data:,',
    (player) => {
      player.loop = false;
    }
  );

  // Pause video when swiped away or modal closed
  React.useEffect(() => {
    if (!isVisible && isVideo && player.playing) {
      player.pause();
    }
  }, [isVisible, isVideo, player]);

  if (isVideo) {
    return (
      <View className="h-72 w-full bg-black">
        <VideoView
          player={player}
          style={{ width: '100%', height: '100%' } as ViewStyle}
          contentFit="contain"
          allowsFullscreen
          allowsPictureInPicture={false}
          nativeControls
        />
      </View>
    );
  }

  return (
    <View className="h-72 w-full bg-black">
      <Image
        source={{ uri: media.url }}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
      />
    </View>
  );
});

export function CheckpointDetailModal({
  visible,
  checkpoint,
  onClose,
}: CheckpointDetailModalProps) {
  const insets = useSafeAreaInsets();
  const { deleteCheckpoint } = useCheckpoint();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = React.useState(0);

  // Reset active index when checkpoint changes
  React.useEffect(() => {
    if (visible) {
      setActiveMediaIndex(0);
    }
  }, [visible, checkpoint?.id]);

  const onViewableItemsChanged = React.useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      setActiveMediaIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  // Viewability config
  const viewabilityConfig = React.useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  if (!checkpoint) return null;
  const date = checkpoint.createdAt?.toDate ? checkpoint.createdAt.toDate() : new Date();
  
  const hasIssues = (checkpoint.aiAnalysis?.issues?.length || 0) > 0;
  const mediaList = checkpoint.media || [];

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteCheckpoint(checkpoint.id);
      setIsDeleteConfirmOpen(false);
      onClose();
    } catch (error) {
      checkpointLog.error('checkpoint.delete.failed', undefined, error);
      Alert.alert('Error', 'Failed to delete checkpoint');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <View className="flex-1 flex-row items-center gap-2">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
                {checkpoint.name || 'Untitled Checkpoint'}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {format(date, 'MMMM d, yyyy • h:mm a')}
              </Text>
            </View>
          </View>
          <Button onPress={onClose} variant="ghost" size="icon">
            <Icon as={X} size={24} className="text-foreground" />
          </Button>
        </View>

        <ScrollView className="flex-1">
          {/* Media Carousel */}
          <View className="h-72 w-full bg-muted">
            {mediaList.length > 0 ? (
              <View>
                <FlatList
                  data={mediaList}
                  renderItem={({ item, index }) => (
                    <View style={{ width: SCREEN_WIDTH, height: 288 }}>
                      <MediaItem 
                        media={item} 
                        isVisible={visible && index === activeMediaIndex} 
                      />
                    </View>
                  )}
                  keyExtractor={(item) => item.id}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onViewableItemsChanged={onViewableItemsChanged}
                  viewabilityConfig={viewabilityConfig}
                  scrollEventThrottle={16}
                />
                {mediaList.length > 1 && (
                  <View className="absolute bottom-4 right-4 rounded-full bg-black/50 px-3 py-1">
                    <Text className="text-xs font-medium text-white">
                      {activeMediaIndex + 1} / {mediaList.length}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Text className="text-muted-foreground">No Media Available</Text>
              </View>
            )}
          </View>

          {/* Content */}
          <View className="gap-6 p-4">
            {/* Metadata */}
            <View className="gap-3">
              {/* Created Date */}
              <View className="flex-row items-center gap-2">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
                  <Icon as={Calendar} size={16} className="text-foreground" />
                </View>
                <View>
                  <Text className="text-xs text-muted-foreground">Created</Text>
                  <Text className="font-medium text-foreground">
                    {format(date, 'MMM d, yyyy · h:mm a')}
                  </Text>
                </View>
              </View>

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
            </View>

            {/* Tags */}
            {checkpoint.tags && checkpoint.tags.length > 0 && (
              <>
                <Separator />
                <View>
                  <View className="mb-3 flex-row items-center gap-2">
                    <Icon as={Tag} size={16} className="text-muted-foreground" />
                    <Text className="text-sm font-semibold text-foreground">Tags</Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {checkpoint.tags.map((tag, idx) => (
                      <View key={idx} className="rounded-full border border-border bg-card px-3 py-1">
                        <Text className="text-xs text-foreground">{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* Description */}
            {checkpoint.description && (
              <>
                <Separator />
                <View>
                  <Text className="mb-2 text-sm font-semibold text-foreground">Description</Text>
                  <Text className="text-sm text-muted-foreground">{checkpoint.description}</Text>
                </View>
              </>
            )}

            {/* Auto-detected Asset Info */}
            {checkpoint.detectedAsset && (
              <>
                <Separator />
                <View>
                  <View className="mb-3 flex-row items-center gap-2">
                    <Icon as={Award} size={16} className="text-muted-foreground" />
                    <Text className="text-sm font-semibold text-foreground">
                      Auto-detected Information
                    </Text>
                  </View>
                  <View className="gap-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm text-muted-foreground">Detected as:</Text>
                      <View className="rounded-full bg-secondary px-2 py-1">
                        <Text className="text-xs font-medium text-foreground">
                          {checkpoint.detectedAsset}
                        </Text>
                      </View>
                      {checkpoint.assetConfidence && (
                        <Text className="text-xs text-muted-foreground">
                          ({Math.round(checkpoint.assetConfidence * 100)}% confidence)
                        </Text>
                      )}
                    </View>
                    {checkpoint.assetFeatures && checkpoint.assetFeatures.length > 0 && (
                      <View>
                        <Text className="text-sm text-muted-foreground">
                          Key features: {checkpoint.assetFeatures.join(', ')}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </>
            )}

            {/* AI Analysis Status */}
            <Separator />
            <View className="rounded-lg border border-border bg-card p-4">
              <Text className="mb-3 font-semibold text-foreground">AI Analysis</Text>

              {checkpoint.analysisStatus === 'pending' && (
                <View className="flex-row items-center gap-2">
                  <Icon as={Clock} size={16} className="text-muted-foreground" />
                  <Text className="text-sm text-muted-foreground">Queued for analysis</Text>
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
                      className={hasIssues ? 'text-destructive' : 'text-green-500'}
                    />
                    <Text className="font-medium text-foreground">
                      {hasIssues ? 'Issues Detected' : 'No Issues Detected'}
                    </Text>
                  </View>

                  {checkpoint.aiAnalysis.summary && (
                    <Text className="text-sm leading-5 text-muted-foreground">
                      {checkpoint.aiAnalysis.summary}
                    </Text>
                  )}
                </View>
              )}

              {!checkpoint.analysisStatus && (
                <View className="flex-row items-center gap-2">
                  <Icon as={Info} size={16} className="text-muted-foreground" />
                  <Text className="text-sm text-muted-foreground">Not analyzed yet</Text>
                </View>
              )}
            </View>

            {/* Full AI Analysis Results */}
            {checkpoint.aiAnalysis && checkpoint.analysisStatus === 'completed' && (
              <>
                <Separator />
                <AnalysisResults analysis={checkpoint.aiAnalysis} />
              </>
            )}

            {/* Actions */}
            <View className="mt-4 flex-row gap-4">
              <Button
                variant="destructive"
                className="flex-1"
                onPress={() => setIsDeleteConfirmOpen(true)}
                disabled={isDeleting}>
                <View className="flex-row items-center gap-2">
                  <Icon as={Trash2} size={16} className="text-destructive-foreground" />
                  <Text className="text-destructive-foreground">Delete Checkpoint</Text>
                </View>
              </Button>
            </View>
          </View>
        </ScrollView>
      </View>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent portalHost="checkpoint-detail-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Checkpoint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this checkpoint? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onPress={handleConfirmDelete}>
              <Text>{isDeleting ? 'Deleting…' : 'Delete'}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Portal host inside the native Modal so dialogs/menus render above the modal layer */}
      <PortalHost name="checkpoint-detail-modal" />
    </Modal>
  );
}
