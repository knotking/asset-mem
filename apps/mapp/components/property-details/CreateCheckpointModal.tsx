import * as React from 'react';
import { Modal, View, Image, Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { X, Camera, Image as ImageIcon, Loader2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CreateCheckpointModalProps {
    visible: boolean;
    onClose: () => void;
    onCreate: (data: { name: string; location: string; imageAsset: ImagePicker.ImagePickerAsset }) => Promise<void>;
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
    const [imageAsset, setImageAsset] = React.useState<ImagePicker.ImagePickerAsset | null>(null);
    const [loading, setLoading] = React.useState(false);

    // Reset form when modal opens
    React.useEffect(() => {
        if (visible) {
            setName('');
            setLocation('');
            setImageAsset(null);
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
                setImageAsset(result.assets[0]);
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
                mediaTypes: 'images',
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setImageAsset(result.assets[0]);
            }
        } catch (error) {
            console.error('Error selecting photo:', error);
        }
    };

    const handleSubmit = async () => {
        if (!imageAsset || !name || !location) {
            return;
        }

        try {
            setLoading(true);
            await onCreate({ name, location, imageAsset });
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
                        <View className="mb-4 h-64 w-full overflow-hidden rounded-lg bg-muted border border-border">
                            {imageAsset ? (
                                <Image
                                    source={{ uri: imageAsset.uri }}
                                    className="h-full w-full"
                                    resizeMode="cover"
                                />
                            ) : (
                                <View className="h-full w-full items-center justify-center">
                                    <Icon as={Camera} size={48} className="text-muted-foreground opacity-50" />
                                    <Text className="mt-2 text-muted-foreground">No image selected</Text>
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
                            <Input
                                placeholder="e.g., Kitchen Sink Leak"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View>
                            <Text className="mb-2 text-sm font-medium text-foreground">Location</Text>
                            <Select
                                value={location ? { value: location, label: location } : undefined}
                                onValueChange={(option) => setLocation(option?.value || '')}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a location" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {LOCATIONS.map((loc) => (
                                            <SelectItem key={loc.value} label={loc.label} value={loc.value}>
                                                {loc.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </View>
                    </View>
                </ScrollView>

                {/* Footer */}
                <View className="border-t border-border p-4" style={{ paddingBottom: insets.bottom + 16 }}>
                    <Button
                        onPress={handleSubmit}
                        disabled={!imageAsset || !name || !location || loading}
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
