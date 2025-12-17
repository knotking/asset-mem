import * as React from 'react';
import { Modal, View, Image, Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { X, Camera, Image as ImageIcon, Loader2, Video as VideoIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { VideoView, useVideoPlayer } from 'expo-video';

interface CreateCheckpointModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    location: string;
    mediaAsset: ImagePicker.ImagePickerAsset;
    mediaType: 'image' | 'video';
  }) => Promise<void>;
}

const LOCATIONS = [
  { label: 'Kitchen', value: 'Kitchen' },
  { label: 'Bathroom', value: 'Bathroom' },
  { label: 'Living Room', value: 'Living Room' },
  { label: 'Bedroom', value: 'Bedroom' },
  { label: 'Exterior', value: 'Exterior' },
  { label: 'Basement', value: 'Basement' },
  { label: 'Attic', value: 'Attic' },
  { label: 'Other', value: 'Other' },
];

export function CreateCheckpointModal({ visible, onClose, onCreate }: CreateCheckpointModalProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = React.useState('');
  const [location, setLocation] = React.useState<string>('');
  const [mediaAsset, setMediaAsset] = React.useState<ImagePicker.ImagePickerAsset | null>(null);
  const [mediaType, setMediaType] = React.useState<'image' | 'video'>('image');
  const [loading, setLoading] = React.useState(false);

  const videoPlayer = useVideoPlayer(mediaAsset?.uri ?? '', (player) => {
    // Don't auto-play previews in a create modal.
    player.loop = false;
    player.muted = true;
  });

  const applyAutoDefaults = React.useCallback(() => {
    // Auto-generate a friendly default name if the user hasn't typed one.
    if (!name.trim()) {
      const base = location?.trim() || 'Checkpoint';
      setName(`${base} • ${format(new Date(), 'MMM d')}`);
    }
  }, [name, location]);

  // Reset form when modal opens
  React.useEffect(() => {
    if (visible) {
      setName('');
      setLocation('');
      setMediaAsset(null);
      setMediaType('image');
      setLoading(false);
    }
  }, [visible]);

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access camera is required!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setMediaAsset(result.assets[0]);
        setMediaType('image');
        // Fill defaults once we have a photo.
        applyAutoDefaults();
      }
    } catch (error) {
      console.error('Error taking photo:', error);
    }
  };

  const handleSelectPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access media library is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isVideo = asset.type === 'video';
        setMediaAsset(asset);
        setMediaType(isVideo ? 'video' : 'image');
        // Fill defaults once we have a photo.
        applyAutoDefaults();
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
    }
  };

  const handleRecordVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access camera is required!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'videos',
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setMediaAsset(result.assets[0]);
        setMediaType('video');
        applyAutoDefaults();
      }
    } catch (error) {
      console.error('Error recording video:', error);
    }
  };

  const handleSubmit = async () => {
    if (!mediaAsset) {
      return;
    }

    try {
      setLoading(true);
      const finalName = name.trim() || `${(location || 'Checkpoint').trim()} • ${format(new Date(), 'MMM d')}`;
      // Location can be empty; the analysis worker will auto-set it from detected room when possible.
      const finalLocation = location.trim();
      await onCreate({ name: finalName, location: finalLocation, mediaAsset, mediaType });
      onClose();
    } catch (error) {
      console.error('Error creating checkpoint:', error);
      alert('Failed to create checkpoint. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-lg font-semibold text-foreground">New Checkpoint</Text>
          <Button onPress={onClose} variant="ghost" size="icon">
            <Icon as={X} size={24} className="text-foreground" />
          </Button>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Image Section */}
          <View className="mb-6 items-center">
            <View className="mb-4 h-64 w-full overflow-hidden rounded-lg border border-border bg-muted">
              {mediaAsset ? (
                mediaType === 'image' ? (
                  <Image source={{ uri: mediaAsset.uri }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <View className="h-full w-full">
                    <VideoView player={videoPlayer} style={{ width: '100%', height: '100%' }} />
                  </View>
                )
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Icon as={Camera} size={48} className="text-muted-foreground opacity-50" />
                  <Text className="mt-2 text-muted-foreground">No media selected</Text>
                </View>
              )}
            </View>

            <View className="flex-row gap-4">
              <Button onPress={handleTakePhoto} variant="outline" className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={Camera} size={16} className="text-foreground" />
                  <Text>Take Photo</Text>
                </View>
              </Button>
            </View>
            <View className="mt-3 flex-row gap-4">
              <Button onPress={handleRecordVideo} variant="outline" className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={VideoIcon} size={16} className="text-foreground" />
                  <Text>Record Video</Text>
                </View>
              </Button>
              <Button onPress={handleSelectPhoto} variant="outline" className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={ImageIcon} size={16} className="text-foreground" />
                  <Text>Library</Text>
                </View>
              </Button>
            </View>
          </View>

          {/* Form Section */}
          <View className="gap-4">
            <View>
              <Text className="mb-2 text-sm font-medium text-foreground">Checkpoint Name</Text>
              <Input placeholder="e.g., Kitchen Sink Leak" value={name} onChangeText={setName} />
              <Text className="mt-1 text-xs text-muted-foreground">
                Leave blank to auto-generate.
              </Text>
            </View>

            <View>
              <Text className="mb-3 text-sm font-medium text-foreground">Location</Text>
              <View className="flex-row flex-wrap gap-2">
                {LOCATIONS.map((loc) => {
                  const isSelected = location === loc.value;
                  return (
                    <Pressable
                      key={loc.value}
                      onPress={() => setLocation(loc.value)}
                      className={`rounded-full border px-3 py-1.5 ${
                        isSelected ? 'border-primary bg-primary' : 'border-border bg-secondary'
                      }`}>
                      <Text
                        className={`text-xs font-medium ${
                          isSelected ? 'text-primary-foreground' : 'text-foreground'
                        }`}>
                        {loc.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text className="mt-2 text-xs text-muted-foreground">
                Optional — we’ll auto-detect this from the photo when possible.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View className="border-t border-border p-4" style={{ paddingBottom: insets.bottom + 16 }}>
          <Button
            onPress={handleSubmit}
            disabled={!mediaAsset || loading}
            className="w-full">
            {loading ? (
              <View className="flex-row items-center gap-2">
                <Icon as={Loader2} size={16} className="animate-spin text-primary-foreground" />
                <Text className="text-primary-foreground">Creating...</Text>
              </View>
            ) : (
              <Text className="text-primary-foreground">Create Checkpoint</Text>
            )}
          </Button>
        </View>
      </View>
    </Modal>
  );
}
