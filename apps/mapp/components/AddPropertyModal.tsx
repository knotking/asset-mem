import React from 'react';
import { Modal, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { X, Upload, AlertCircle } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useFirebase } from '@homeapp/common/contexts/firebase-context';
import { useSession } from '@homeapp/common/contexts/session-context';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

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

  const handleClose = () => {
    if (isCreating) {
      setErrorMessage('Please wait while we set up your property.');
      return;
    }
    setSelectedFiles([]);
    setErrorMessage(null);
    onClose();
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

      setSelectedFiles(result.assets);
    } catch (error) {
      console.error('Error picking documents:', error);
      setErrorMessage('Failed to pick documents. Please try again.');
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
      const propRef = await addDoc(collection(db, 'users', user.uid, 'properties'), {
        userId: user.uid,
        name: propertyName,
        address: 'Processing...', // Will be updated from document analysis
        createdAt: serverTimestamp(),
      });

      console.log('Property created with ID:', propRef.id);

      // Create draft session for the property
      await createPropertyDraftSession(user.uid, propRef.id);
      console.log('Draft session created');

      // Close modal and navigate with selected files
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
        <View className="flex-1 items-center justify-center px-6">
          <Pressable
            onPress={handleChooseFiles}
            disabled={isCreating}
            className="w-full max-w-md rounded-xl border-2 border-dashed border-border bg-secondary/30 px-8 py-16">
            <View className="items-center">
              {/* Upload Icon */}
              <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Icon as={Upload} size={32} className="text-primary" />
              </View>

              {/* Main Text */}
              <Text className="mb-2 text-center text-lg font-semibold text-foreground">
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`
                  : 'Tap to select files'}
              </Text>

              {/* Subtext */}
              <Text className="mb-6 text-center text-sm text-muted-foreground">
                {selectedFiles.length > 0
                  ? 'Tap here to choose different files or upload the selected files below'
                  : 'Upload documents related to your property such as inspection reports, floor plans, permits, etc.'}
              </Text>

              {/* Supported Types */}
              <Text className="text-center text-xs text-muted-foreground">
                Supports PDF, DOC, DOCX, JPG, PNG files
              </Text>
            </View>
          </Pressable>

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
        </View>

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
