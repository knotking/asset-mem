import React from 'react';
import { Modal, View, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Upload, AlertCircle, Camera, File } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useFirebase } from '@homeapp/common/contexts/firebase-context';
import { useSession } from '@homeapp/common/contexts/session-context';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { PROPERTY_TYPES, getSubTypesForType, type PropertyType, type PropertySubType } from '@homeapp/common/constants/property-types';

interface AddPropertyModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (propertyId: string, selectedFiles: any[]) => void;
}

export default function AddPropertyModal({ visible, onClose, onSuccess }: AddPropertyModalProps) {
  const { user } = useAuth();
  const { db } = useFirebase();
  const { createPropertyDraftSession } = useSession();
  const [selectedFiles, setSelectedFiles] = React.useState<any[]>([]);
  const [isCreating, setIsCreating] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [propertyType, setPropertyType] = React.useState<PropertyType | null>(null);
  const [propertySubType, setPropertySubType] = React.useState<PropertySubType | null>(null);

  const handleClose = () => {
    if (isCreating) {
      setErrorMessage('Please wait while we set up your property.');
      return;
    }
    setSelectedFiles([]);
    setPropertyType(null);
    setPropertySubType(null);
    setErrorMessage(null);
    onClose();
  };

  const handleTypeChange = (type: PropertyType) => {
    setPropertyType(type);
    setPropertySubType(null); // Reset sub-type when type changes
  };

  const handleChooseFiles = async () => {
    if (!user) {
      setErrorMessage('You must be logged in to upload documents');
      return;
    }

    try {
      // Open document picker
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'image/*',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      // Add new files to existing selection
      setSelectedFiles((prev) => [...prev, ...result.assets]);
    } catch (error) {
      console.error('Error picking documents:', error);
      setErrorMessage('Failed to pick documents. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    if (!user) {
      setErrorMessage('You must be logged in to take photos');
      return;
    }

    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setErrorMessage('Please grant permission to access your camera.');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      // Convert ImagePicker asset to DocumentPicker format
      const asset = result.assets[0];
      const convertedAsset = {
        uri: asset.uri,
        name: asset.fileName || `photo-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        size: asset.fileSize || 0,
      };

      setSelectedFiles((prev) => [...prev, convertedAsset]);
    } catch (error) {
      console.error('Error taking photo:', error);
      setErrorMessage('Failed to take photo. Please try again.');
    }
  };

  const handleUploadDocuments = async () => {
    if (!user || selectedFiles.length === 0 || isCreating) {
      return;
    }

    setIsCreating(true);

    try {
      // Use first document name as property name (remove extension)
      const firstFileName = selectedFiles[0].name.replace(/\.[^/.]+$/, '');
      const propertyName = firstFileName || 'New Property';

      console.log('Creating property with name:', propertyName);
      console.log('Documents selected:', selectedFiles.length);

      // Create property in Firestore
      const propertyData: any = {
        userId: user.uid,
        name: propertyName,
        address: 'Processing...', // Will be updated from document analysis
        createdAt: serverTimestamp(),
      };

      // Add type and sub-type if selected
      if (propertyType) {
        propertyData.propertyType = propertyType;
      }
      if (propertySubType && propertySubType !== 'none') {
        propertyData.propertySubType = propertySubType;
      }

      const propRef = await addDoc(collection(db, 'users', user.uid, 'properties'), propertyData);

      console.log('Property created with ID:', propRef.id);

      // Create draft session in background (non-blocking)
      // The session context will auto-create it if it doesn't exist when needed
      createPropertyDraftSession(user.uid, propRef.id).then(() => {
        console.log('Draft session created in background');
      }).catch((err) => {
        console.error('Background draft creation failed (will retry later):', err);
      });

      // Close modal and navigate immediately with selected files
      const filesToUpload = [...selectedFiles];
      setSelectedFiles([]);
      setIsCreating(false);
      onClose();
      onSuccess(propRef.id, filesToUpload);
    } catch (error) {
      console.error('Error creating property:', error);
      setIsCreating(false);
      setErrorMessage('Failed to create property. Please try again.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <SafeAreaView className="flex-1 bg-background">
        {/* Header */}
        <View className="border-b border-border bg-background px-4 py-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-foreground">Upload Property Documents</Text>
            <Button onPress={handleClose} variant="ghost" size="icon" disabled={isCreating}>
              <Icon as={X} size={24} className="text-foreground" />
            </Button>
          </View>
        </View>

        {/* Error Alert */}
        {errorMessage && (
          <View className="mx-4 mt-4">
            <Alert icon={AlertCircle} variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-6 w-6"
              onPress={() => setErrorMessage(null)}>
              <Icon as={X} size={16} className="text-destructive" />
            </Button>
          </View>
        )}

        {/* Main Content */}
        <ScrollView className="flex-1" contentContainerClassName="px-6 py-4">
          {/* Property Type Selection */}
          <View className="mb-4 w-full max-w-md">
            <Label className="mb-2 text-sm font-semibold text-foreground">Property Type</Label>
            <Select
              value={propertyType ? { value: propertyType, label: PROPERTY_TYPES.find(t => t.value === propertyType)?.label || propertyType } : undefined}
              onValueChange={(option) => {
                if (option?.value) {
                  handleTypeChange(option.value as PropertyType);
                } else {
                  setPropertyType(null);
                }
              }}>
              <SelectTrigger className="w-full" disabled={isCreating}>
                <SelectValue placeholder="Select property type (optional)" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value} label={type.label}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </View>

          {/* Property Sub-Type Selection */}
          {propertyType && getSubTypesForType(propertyType).length > 0 && (
            <View className="mb-4 w-full max-w-md">
              <Label className="mb-2 text-sm font-semibold text-foreground">Sub-Type (Optional)</Label>
              <Select
                value={propertySubType ? { value: propertySubType, label: getSubTypesForType(propertyType).find(st => st.value === propertySubType)?.label || propertySubType } : undefined}
                onValueChange={(option) => {
                  if (option?.value) {
                    setPropertySubType(option.value as PropertySubType);
                  } else {
                    setPropertySubType(null);
                  }
                }}>
                <SelectTrigger className="w-full" disabled={isCreating}>
                  <SelectValue placeholder="Select sub-type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {getSubTypesForType(propertyType).map((subType) => (
                    <SelectItem key={subType.value} value={subType.value} label={subType.label}>
                      {subType.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </View>
          )}

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <View className="mb-4 w-full max-w-md">
              <Text className="mb-2 text-sm font-semibold text-foreground">
                Selected Files ({selectedFiles.length})
              </Text>
              <View className="max-h-48 gap-2">
                {selectedFiles.map((file, index) => (
                  <View
                    key={index}
                    className="flex-row items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                    <Icon as={File} size={20} className="text-muted-foreground" />
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                        {file.name}
                      </Text>
                    </View>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onPress={() => {
                        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
                      }}
                      disabled={isCreating}>
                      <Icon as={X} size={16} className="text-muted-foreground" />
                    </Button>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Upload Area */}
          <Pressable
            onPress={handleChooseFiles}
            disabled={isCreating}
            className="w-full max-w-md rounded-xl border-2 border-dashed border-border bg-secondary/30 px-8 py-12">
            <View className="items-center">
              {/* Upload Icon */}
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Icon as={Upload} size={32} className="text-primary" />
              </View>

              {/* Main Text */}
              <Text className="mb-2 text-center text-lg font-semibold text-foreground">
                Tap to select files
              </Text>

              {/* Subtext */}
              <Text className="mb-4 text-center text-sm text-muted-foreground">
                Upload documents related to your property such as inspection reports, floor plans, permits, etc.
              </Text>

              {/* Supported Types */}
              <Text className="text-center text-xs text-muted-foreground">
                Supports PDF, DOC, DOCX, JPG, PNG files
              </Text>
            </View>
          </Pressable>

          {/* Action Buttons */}
          <View className="mt-4 w-full max-w-md flex-row gap-3">
            <Button
              onPress={handleTakePhoto}
              disabled={isCreating}
              variant="outline"
              className="flex-1"
              size="lg">
              <Icon as={Camera} size={20} className="mr-2 text-foreground" />
              <Text className="font-semibold text-foreground">Take Photo</Text>
            </Button>
            <Button
              onPress={handleChooseFiles}
              disabled={isCreating}
              variant="outline"
              className="flex-1"
              size="lg">
              <Icon as={Upload} size={20} className="mr-2 text-foreground" />
              <Text className="font-semibold text-foreground">Choose Files</Text>
            </Button>
          </View>

          {/* Upload Documents Button */}
          <Button
            onPress={handleUploadDocuments}
            disabled={selectedFiles.length === 0 || isCreating}
            className="mt-6 w-full max-w-md"
            size="lg">
            <Text className="font-semibold text-primary-foreground">
              {isCreating
                ? 'Creating property...'
                : `Upload ${selectedFiles.length} document${selectedFiles.length !== 1 ? 's' : ''}`}
            </Text>
          </Button>
        </ScrollView>

        {/* Footer Note */}
        <View className="border-t border-border bg-background px-6 py-4">
          <Text className="text-center text-xs text-muted-foreground">
            Select files first, then tap Upload to create your property
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
