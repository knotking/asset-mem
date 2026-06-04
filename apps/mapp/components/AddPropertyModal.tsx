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
import { DOCUMENT_QUOTA_USER_MESSAGE } from '@homeapp/common/lib/document-analysis-errors';
import { isAtPlanLimit } from '@homeapp/common/lib/plan-limit-slice';
import { useLlmTokenUsage } from '@homeapp/common/contexts/llm-token-usage-context';
import { PENDING_PROPERTY_ADDRESS } from '@/lib/property-address-placeholder';
import { createLogger } from '@/lib/logger';

const propertyLog = createLogger('property');

interface AddPropertyModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (propertyId: string, selectedFiles: any[]) => void;
}

export default function AddPropertyModal({ visible, onClose, onSuccess }: AddPropertyModalProps) {
  const { user } = useAuth();
  const { db } = useFirebase();
  const { createPropertyDraftSession } = useSession();
  const { documentsLimit, limitsLoading } = useLlmTokenUsage();
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

      // Validate file sizes
      const MAX_FILE_SIZE = 10485760; // 10MB
      const validAssets = [];
      const oversizedFiles = [];
      
      for (const asset of result.assets) {
        if (asset.size && asset.size > MAX_FILE_SIZE) {
          oversizedFiles.push(asset.name);
        } else {
          validAssets.push(asset);
        }
      }
      
      if (oversizedFiles.length > 0) {
        setErrorMessage(`Some files are too large (max 10MB): ${oversizedFiles.join(', ')}`);
      }
      
      if (validAssets.length > 0) {
        // Add new files to existing selection
        setSelectedFiles((prev) => [...prev, ...validAssets]);
      }
    } catch (error) {
      propertyLog.error('picker.failed', undefined, error);
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
      
      // Optional: Validate image size (warn if very small, but don't block)
      const imageSize = asset.fileSize || 0;
      const MIN_RECOMMENDED_SIZE = 50000; // 50KB
      const MAX_FILE_SIZE = 10485760; // 10MB
      
      if (imageSize > MAX_FILE_SIZE) {
        setErrorMessage('Image is too large (max 10MB). Please try again with better lighting or lower resolution.');
        return;
      }
      
      if (imageSize < MIN_RECOMMENDED_SIZE && imageSize > 0) {
        propertyLog.warn('photo.quality.low', { bytes: imageSize });
        // Don't block - just log warning, AI can still try to process it
      }
      
      const convertedAsset = {
        uri: asset.uri,
        name: asset.fileName || `photo-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        size: asset.fileSize || 0,
      };

      setSelectedFiles((prev) => [...prev, convertedAsset]);
    } catch (error) {
      propertyLog.error('photo.failed', undefined, error);
      setErrorMessage('Failed to take photo. Please try again.');
    }
  };

  const handleUploadDocuments = async () => {
    if (!user || selectedFiles.length === 0 || isCreating) {
      return;
    }

    if (!limitsLoading && isAtPlanLimit(documentsLimit, selectedFiles.length)) {
      setErrorMessage(DOCUMENT_QUOTA_USER_MESSAGE);
      return;
    }

    setIsCreating(true);

    try {
      // Use first document name as property name (remove extension)
      const firstFileName = selectedFiles[0].name.replace(/\.[^/.]+$/, '');
      const propertyName = firstFileName || 'New Property';

      propertyLog.info('create.start', { docCount: selectedFiles.length });

      // Create property in Firestore
      const propertyData: any = {
        userId: user.uid,
        name: propertyName,
        address: PENDING_PROPERTY_ADDRESS,
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

      propertyLog.info('create.complete', { propertyId: propRef.id });

      // Create draft session in background (non-blocking)
      // The session context will auto-create it if it doesn't exist when needed
      createPropertyDraftSession(user.uid, propRef.id).then(() => {
        propertyLog.debug('draft.created');
      }).catch((err) => {
        propertyLog.warn('draft.failed', { cause: err instanceof Error ? err.message : String(err) });
      });

      const filesToUpload = [...selectedFiles];
      setSelectedFiles([]);
      setIsCreating(false);
      // Parent handles navigation on success — do not call onClose() (that pops back to home).
      onSuccess(propRef.id, filesToUpload);
    } catch (error) {
      propertyLog.error('create.failed', undefined, error);
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
        <View className="border-b border-border bg-background px-6 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-semibold text-foreground">Upload Property Documents</Text>
            <Button onPress={handleClose} variant="ghost" size="icon" disabled={isCreating}>
              <Icon as={X} size={24} className="text-foreground" />
            </Button>
          </View>
          <Text className="mt-1 text-sm text-muted-foreground">
            Upload documents related to your property such as inspection reports, floor plans, permits, etc.
          </Text>
        </View>

        {/* Error Alert */}
        {errorMessage && (
          <View className="mx-6 mt-4">
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
        <ScrollView className="flex-1" contentContainerClassName="px-6 py-6">
          {/* Property Type Selection */}
          <View className="mb-6 w-full">
            <Label className="mb-2 text-base font-semibold text-foreground">Property Type</Label>
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
            <View className="mb-6 w-full">
              <Label className="mb-2 text-base font-semibold text-foreground">Sub-Type (Optional)</Label>
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

          {/* Upload Area */}
          <Pressable
            onPress={handleChooseFiles}
            disabled={isCreating}
            className="mb-6 w-full rounded-lg border-2 border-dashed border-border bg-background py-16">
            <View className="items-center px-8">
              {/* Upload Icon */}
              <View className="mb-4 h-16 w-16 items-center justify-center">
                <Icon as={Upload} size={40} className="text-muted-foreground" />
              </View>

              {/* Main Text */}
              <Text className="mb-2 text-center text-base text-foreground">
                Drop files here or click to browse
              </Text>

              {/* Supported Types */}
              <Text className="mb-6 text-center text-sm text-muted-foreground">
                Supports PDF, DOC, DOCX, JPG, PNG, XLS, XLSX files
              </Text>

              {/* Choose Files Button */}
              <Button
                onPress={handleChooseFiles}
                disabled={isCreating}
                variant="default"
                size="lg"
                className="px-8">
                <Text className="font-semibold text-primary-foreground">Choose Files</Text>
              </Button>
            </View>
          </Pressable>

          {/* OR Divider */}
          <View className="mb-6 flex-row items-center">
            <View className="flex-1 border-b border-border" />
            <Text className="px-4 text-sm text-muted-foreground">OR</Text>
            <View className="flex-1 border-b border-border" />
          </View>

          {/* Take Photo Button */}
          <Button
            onPress={handleTakePhoto}
            disabled={isCreating}
            variant="outline"
            className="mb-6 w-full"
            size="lg">
            <Icon as={Camera} size={20} className="mr-2 text-foreground" />
            <Text className="font-semibold text-foreground">Take Photo</Text>
          </Button>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <View className="mb-6 w-full">
              <Text className="mb-3 text-base font-semibold text-foreground">
                Selected Files ({selectedFiles.length})
              </Text>
              <View className="gap-2">
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
                      className="h-8 w-8"
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
        </ScrollView>

        {/* Bottom Action Buttons */}
        <View className="border-t border-border bg-background px-6 py-4">
          <View className="flex-row gap-3">
            <Button
              onPress={handleClose}
              disabled={isCreating}
              variant="outline"
              className="flex-1 items-center justify-center"
              size="lg">
              <Text className="w-full text-center font-semibold text-foreground">Cancel</Text>
            </Button>
            <Button
              onPress={handleUploadDocuments}
              disabled={selectedFiles.length === 0 || isCreating}
              className="flex-1 items-center justify-center"
              size="lg">
              <Text className="w-full text-center font-semibold text-primary-foreground">
                {isCreating
                  ? 'Uploading...'
                  : `Upload ${selectedFiles.length} Document${selectedFiles.length !== 1 ? 's' : ''}`}
              </Text>
            </Button>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
