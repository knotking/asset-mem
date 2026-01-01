import * as React from 'react';
import { Modal, View, Image, ScrollView, Alert } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  X,
  MapPin,
  Calendar,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Clock,
  Info,
  Tag,
  Award,
} from 'lucide-react-native';
import { Checkpoint } from '@homeapp/common/types';
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

export function CheckpointDetailModal({
  visible,
  checkpoint,
  onClose,
}: CheckpointDetailModalProps) {
  const insets = useSafeAreaInsets();
  const { deleteCheckpoint } = useCheckpoint();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);

  // IMPORTANT: hooks must be called consistently across renders.
  // This modal can render with checkpoint=null initially and later receive a checkpoint.
  // So we compute safe defaults and always call useVideoPlayer.
  const media0 = checkpoint?.media?.[0];
  const isVideo = !!media0?.contentType?.startsWith('video/');
  const mediaUrl = media0?.url;
  const videoSourceUrl = isVideo && mediaUrl ? mediaUrl : '';
  const videoPlayer = useVideoPlayer(videoSourceUrl, (player) => {
    // don't autoplay in a modal; user intent should start playback
    player.loop = false;
  });

  if (!checkpoint) return null;
  const date = checkpoint.createdAt?.toDate ? checkpoint.createdAt.toDate() : new Date();
  // Keep issue detection logic consistent with the list view:
  // treat any non-empty issues array as "issues detected".
  const hasIssues = (checkpoint.aiAnalysis?.issues?.length || 0) > 0;

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteCheckpoint(checkpoint.id);
      setIsDeleteConfirmOpen(false);
      onClose();
    } catch (error) {
      console.error('Error deleting checkpoint:', error);
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
          {/* Media (image/video) */}
          <View className="h-72 w-full bg-muted">
            {mediaUrl ? (
              isVideo ? (
                <VideoView
                  player={videoPlayer}
                  style={{ width: '100%', height: '100%' }}
                  fullscreenOptions={{ allowed: true }}
                  allowsPictureInPicture={false}
                  nativeControls
                />
              ) : (
                <Image source={{ uri: mediaUrl }} className="h-full w-full" resizeMode="cover" />
              )
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
