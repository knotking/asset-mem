import * as React from 'react';
import { Modal, View, Image, Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    description?: string;
    assetType: 'real_estate' | 'vehicle' | 'appliance' | 'other';
    location: string;
    mediaAsset: ImagePicker.ImagePickerAsset;
    mediaType: 'image' | 'video';
  }) => Promise<void>;
}

const ASSET_TYPES = [
  { label: 'Real Estate', value: 'real_estate' as const },
  { label: 'Vehicle', value: 'vehicle' as const },
  { label: 'Appliance', value: 'appliance' as const },
  { label: 'Other', value: 'other' as const },
];

const LOCATION_OPTIONS = {
  real_estate: [
    // Rooms
    { label: 'Kitchen', value: 'Kitchen' },
    { label: 'Bathroom', value: 'Bathroom' },
    { label: 'Living Room', value: 'Living Room' },
    { label: 'Bedroom', value: 'Bedroom' },
    { label: 'Dining Room', value: 'Dining Room' },
    { label: 'Office/Study', value: 'Office/Study' },
    { label: 'Laundry Room', value: 'Laundry Room' },
    { label: 'Garage', value: 'Garage' },
    { label: 'Basement', value: 'Basement' },
    { label: 'Attic', value: 'Attic' },
    { label: 'Hallway', value: 'Hallway' },
    { label: 'Closet', value: 'Closet' },
    { label: 'Mudroom', value: 'Mudroom' },
    { label: 'Pantry', value: 'Pantry' },
    // Building Systems
    { label: 'HVAC System', value: 'HVAC System' },
    { label: 'Plumbing', value: 'Plumbing' },
    { label: 'Electrical', value: 'Electrical' },
    { label: 'Roof', value: 'Roof' },
    { label: 'Foundation', value: 'Foundation' },
    { label: 'Insulation', value: 'Insulation' },
    { label: 'Gutters', value: 'Gutters' },
    // Outdoor Areas
    { label: 'Front Yard', value: 'Front Yard' },
    { label: 'Backyard', value: 'Backyard' },
    { label: 'Driveway', value: 'Driveway' },
    { label: 'Deck', value: 'Deck' },
    { label: 'Patio', value: 'Patio' },
    { label: 'Pool', value: 'Pool' },
    { label: 'Fence', value: 'Fence' },
    { label: 'Garden', value: 'Garden' },
    { label: 'Shed', value: 'Shed' },
    { label: 'Exterior', value: 'Exterior' },
    // Specific Features
    { label: 'Windows', value: 'Windows' },
    { label: 'Doors', value: 'Doors' },
    { label: 'Flooring', value: 'Flooring' },
    { label: 'Walls', value: 'Walls' },
    { label: 'Ceiling', value: 'Ceiling' },
    { label: 'Stairs', value: 'Stairs' },
    { label: 'Fireplace', value: 'Fireplace' },
    { label: 'Appliances', value: 'Appliances' },
    // Custom
    { label: 'Other', value: 'Other' },
  ],
  vehicle: [
    { label: 'Exterior', value: 'Exterior' },
    { label: 'Interior', value: 'Interior' },
    { label: 'Engine Bay', value: 'Engine Bay' },
    { label: 'Tires/Wheels', value: 'Tires/Wheels' },
    { label: 'Undercarriage', value: 'Undercarriage' },
    { label: 'Trunk', value: 'Trunk' },
    { label: 'Dashboard', value: 'Dashboard' },
    { label: 'Other', value: 'Other' },
  ],
  appliance: [
    { label: 'Exterior', value: 'Exterior' },
    { label: 'Interior', value: 'Interior' },
    { label: 'Controls', value: 'Controls' },
    { label: 'Seals/Gaskets', value: 'Seals/Gaskets' },
    { label: 'Filters', value: 'Filters' },
    { label: 'Connections', value: 'Connections' },
    { label: 'Other', value: 'Other' },
  ],
  other: [
    { label: 'Other', value: 'Other' },
  ],
};

export function CreateCheckpointModal({ visible, onClose, onCreate }: CreateCheckpointModalProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [assetType, setAssetType] = React.useState<'real_estate' | 'vehicle' | 'appliance' | 'other'>('real_estate');
  const [location, setLocation] = React.useState<string>('');
  const [customLocation, setCustomLocation] = React.useState<string>('');
  const [useCustomLocation, setUseCustomLocation] = React.useState(false);
  const [mediaAsset, setMediaAsset] = React.useState<ImagePicker.ImagePickerAsset | null>(null);
  const [mediaType, setMediaType] = React.useState<'image' | 'video'>('image');
  const [loading, setLoading] = React.useState(false);

  // Only initialize video player when we actually have a video URI
  // Initialize with a dummy URI to prevent initialization issues
  const hasVideoUri = Boolean(mediaAsset?.uri && mediaType === 'video');
  const videoPlayer = useVideoPlayer(
    hasVideoUri ? mediaAsset!.uri : 'data:,', 
    (player) => {
      // Don't auto-play previews in a create modal.
      player.loop = false;
      player.muted = true;
    }
  );

  const applyAutoDefaults = React.useCallback(() => {
    // Auto-generate a friendly default name if the user hasn't typed one.
    if (!name.trim()) {
      const effectiveLocation = useCustomLocation ? customLocation : location;
      const base = effectiveLocation?.trim() || 'Checkpoint';
      setName(`${base} • ${format(new Date(), 'MMM d')}`);
    }
  }, [name, location, customLocation, useCustomLocation]);

  // Reset form when modal opens
  React.useEffect(() => {
    if (visible) {
      setName('');
      setDescription('');
      setAssetType('real_estate');
      setLocation('');
      setCustomLocation('');
      setUseCustomLocation(false);
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
        allowsEditing: true,
        aspect: [4, 3],
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
      const effectiveLocation = useCustomLocation ? customLocation : location;
      const finalName =
        name.trim() || `${(effectiveLocation || 'Checkpoint').trim()} • ${format(new Date(), 'MMM d')}`;
      // Location can be empty; the analysis worker will auto-set it from detected room when possible.
      const finalLocation = effectiveLocation.trim();
      const finalDescription = description.trim() || undefined;
      await onCreate({ 
        name: finalName, 
        description: finalDescription,
        assetType, 
        location: finalLocation, 
        mediaAsset, 
        mediaType 
      });
      // Note: Don't call onClose() here - let parent handle modal transitions to prevent blank screen
    } catch (error) {
      console.error('Error creating checkpoint:', error);
      alert('Failed to create checkpoint. Please try again.');
      setLoading(false); // Only reset loading on error
    }
    // Don't reset loading on success - keeps modal visible during transition
  };

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      presentationStyle="pageSheet"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border bg-background px-4 py-3">
          <Text className="text-lg font-semibold text-foreground">New Checkpoint</Text>
          <Button onPress={onClose} variant="ghost" size="icon" disabled={loading}>
            <Icon as={X} size={24} className="text-foreground" />
          </Button>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Image Section */}
          <View className="mb-6 items-center">
            <View className="mb-4 h-64 w-full overflow-hidden rounded-lg border border-border bg-muted">
              {mediaAsset ? (
                mediaType === 'image' ? (
                  <Image
                    source={{ uri: mediaAsset.uri }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
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

            <View className="flex-row gap-2">
              <Pressable
                onPress={handleTakePhoto}
                disabled={loading}
                className="flex-1 items-center rounded-lg border border-border bg-secondary p-3">
                <Icon as={Camera} size={20} className="mb-1 text-foreground" />
                <Text className="text-center text-xs font-medium text-foreground">Photo</Text>
              </Pressable>
              <Pressable
                onPress={handleRecordVideo}
                disabled={loading}
                className="flex-1 items-center rounded-lg border border-border bg-secondary p-3">
                <Icon as={VideoIcon} size={20} className="mb-1 text-foreground" />
                <Text className="text-center text-xs font-medium text-foreground">Video</Text>
              </Pressable>
              <Pressable
                onPress={handleSelectPhoto}
                disabled={loading}
                className="flex-1 items-center rounded-lg border border-border bg-secondary p-3">
                <Icon as={ImageIcon} size={20} className="mb-1 text-foreground" />
                <Text className="text-center text-xs font-medium text-foreground">Gallery</Text>
              </Pressable>
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
              <Text className="mb-2 text-sm font-medium text-foreground">Description (Optional)</Text>
              <Input 
                placeholder="Add notes or details about this checkpoint..." 
                value={description} 
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
              <Text className="mt-1 text-xs text-muted-foreground">
                Add any additional context or observations.
              </Text>
            </View>

            <View>
              <Text className="mb-2 text-sm font-medium text-foreground">Asset Type</Text>
              <Select
                value={{ value: assetType, label: ASSET_TYPES.find(t => t.value === assetType)?.label || 'Real Estate' }}
                onValueChange={(option) => {
                  if (option?.value) {
                    setAssetType(option.value);
                    setLocation(''); // Reset location when asset type changes
                  }
                }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select asset type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ASSET_TYPES.map((type) => (
                      <SelectItem key={type.value} label={type.label} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </View>

            <View>
              <Text className="mb-3 text-sm font-medium text-foreground">Location</Text>
              
              {/* Toggle between preset and custom */}
              <View className="mb-3 flex-row gap-2">
                <Pressable
                  onPress={() => setUseCustomLocation(false)}
                  className={`flex-1 items-center rounded-lg border px-3 py-2 ${
                    !useCustomLocation ? 'border-primary bg-primary/10' : 'border-border bg-secondary'
                  }`}>
                  <Text
                    className={`text-xs font-medium ${
                      !useCustomLocation ? 'text-primary' : 'text-foreground'
                    }`}>
                    Preset Options
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setUseCustomLocation(true)}
                  className={`flex-1 items-center rounded-lg border px-3 py-2 ${
                    useCustomLocation ? 'border-primary bg-primary/10' : 'border-border bg-secondary'
                  }`}>
                  <Text
                    className={`text-xs font-medium ${
                      useCustomLocation ? 'text-primary' : 'text-foreground'
                    }`}>
                    Custom Location
                  </Text>
                </Pressable>
              </View>

              {/* Show preset options or custom input based on toggle */}
              {useCustomLocation ? (
                <View>
                  <Input
                    placeholder="Enter custom location..."
                    value={customLocation}
                    onChangeText={setCustomLocation}
                  />
                  <Text className="mt-2 text-xs text-muted-foreground">
                    Enter any custom location description.
                  </Text>
                </View>
              ) : (
                <View>
                  <Select
                    value={location ? { value: location, label: location } : undefined}
                    onValueChange={(option) => {
                      if (option?.value) {
                        setLocation(option.value);
                      }
                    }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select location (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {LOCATION_OPTIONS[assetType].map((loc) => (
                          <SelectItem key={loc.value} label={loc.label} value={loc.value}>
                            {loc.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Text className="mt-2 text-xs text-muted-foreground">
                    Optional — we'll auto-detect this from the photo when possible.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View
          className="border-t border-border px-4 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 4) }}>
          <Button onPress={handleSubmit} disabled={!mediaAsset || loading} className="w-full">
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
