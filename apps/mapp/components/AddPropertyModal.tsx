import React from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { X, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useFirebase } from '@homeapp/common/contexts/firebase-context';
import { useSession } from '@homeapp/common/contexts/session-context';
import { useDocumentUpload } from '@homeapp/common/contexts/document-upload-context';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { extractDocInfo, postFileToAgent } from '@/lib/api';

interface AddPropertyModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (propertyId: string) => void;
}

export default function AddPropertyModal({ visible, onClose, onSuccess }: AddPropertyModalProps) {
  const { user } = useAuth();
  const { db, storage } = useFirebase();
  const { createPropertyDraftSession } = useSession();
  const { uploadingDocs, uploadDocuments, removeUploadingDoc, clearUploadingDocs } =
    useDocumentUpload();

  const [propertyName, setPropertyName] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);

  const handleReset = () => {
    setPropertyName('');
    clearUploadingDocs();
    setIsCreating(false);
  };

  const handleClose = () => {
    if (isCreating) {
      Alert.alert('Upload in Progress', 'Please wait for the upload to complete.');
      return;
    }
    handleReset();
    onClose();
  };

  const handlePickDocuments = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to upload documents');
      return;
    }

    try {
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

      if (result.canceled || !result.assets) {
        return;
      }

      // If no property name set, use first file name
      if (!propertyName && result.assets.length > 0) {
        const fileName = result.assets[0].name.replace(/\.[^/.]+$/, ''); // Remove extension
        setPropertyName(fileName);
      }

      // Start uploading using the common hook
      console.log('Starting immediate upload of', result.assets.length, 'documents');
      await uploadDocuments(result.assets, {
        userId: user.uid,
        storage,
        onAnalyze: async (doc, gsURI) => {
          // Run AI analysis and RAG upload in parallel
          const [analysisResult] = await Promise.allSettled([
            extractDocInfo({ docUrl: gsURI, contentType: doc.mimeType }),
            postFileToAgent(gsURI, user.uid),
          ]);

          if (analysisResult.status === 'fulfilled') {
            return analysisResult.value;
          } else {
            console.warn('Analysis failed (non-blocking):', analysisResult.reason);
            return { summary: 'Analysis failed' };
          }
        },
      });
    } catch (error) {
      console.error('Error picking documents:', error);
      Alert.alert('Error', 'Failed to pick documents');
    }
  };

  const handleCreate = async () => {
    console.log('=== handleCreate called ===');
    console.log('User:', user?.uid);
    console.log('Property name:', propertyName);
    console.log('Documents count:', uploadingDocs.length);

    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a property');
      return;
    }

    if (!propertyName.trim()) {
      Alert.alert('Error', 'Please enter a property name');
      return;
    }

    if (uploadingDocs.length === 0) {
      Alert.alert('Error', 'Please upload at least one document');
      return;
    }

    setIsCreating(true);
    console.log('Creating property...');

    try {
      // 1. Check all documents are uploaded
      const allUploaded = uploadingDocs.every(
        (doc) => doc.status === 'complete' && doc.downloadURL
      );
      if (!allUploaded) {
        throw new Error('Not all documents have finished uploading');
      }

      // 2. Find address from analyzed documents (use first valid address found)
      const extractedAddress = uploadingDocs.find(
        (doc) => doc.propertyAddress && doc.propertyAddress !== 'N/A'
      )?.propertyAddress;

      // 3. Create property in Firestore
      console.log('Step 1: Creating property in Firestore...');
      const propRef = await addDoc(collection(db, 'users', user.uid, 'properties'), {
        userId: user.uid,
        name: extractedAddress || propertyName.trim(), // Use extracted address as name if available
        address: extractedAddress || 'Pending address...',
        createdAt: serverTimestamp(),
      });
      console.log('Property created with ID:', propRef.id);

      // 4. Eagerly create draft session for the property
      console.log('Step 2: Creating draft session...');
      createPropertyDraftSession(user.uid, propRef.id).catch((err) => {
        console.error('Failed to create draft session:', err);
      });

      // 5. Save documents to Firestore
      console.log('Step 3: Saving documents to Firestore...');
      await saveDocumentsToFirestore(propRef.id);
      console.log('All documents saved to Firestore');

      // 6. Success - navigate to property
      console.log('Step 4: Navigating to property...');
      handleReset();
      onSuccess(propRef.id);
      console.log('Property creation complete!');
    } catch (error) {
      console.error('Error creating property:', error);
      Alert.alert('Error', 'Failed to create property. Please try again.');
      setIsCreating(false);
    }
  };

  // Save uploaded documents to Firestore
  const saveDocumentsToFirestore = async (propertyId: string) => {
    console.log('=== saveDocumentsToFirestore called ===');
    console.log('Property ID:', propertyId);
    console.log('Documents to save:', uploadingDocs.length);

    for (const doc of uploadingDocs) {
      if (doc.status === 'complete' && doc.downloadURL) {
        console.log('Saving document to Firestore:', doc.name);

        try {
          await addDoc(collection(db, 'users', user!.uid, 'docs'), {
            userId: user!.uid,
            propertyId: propertyId,
            name: doc.name,
            url: doc.downloadURL,
            storagePath: doc.storagePath!,
            createdAt: serverTimestamp(),
            gsURI: doc.gsURI!,
            contentType: doc.mimeType,
            status: 'complete',
            // AI analysis results
            documentType: doc.documentType || 'OTHER',
            propertyAddress: doc.propertyAddress || 'N/A',
            keyEntities: doc.keyEntities || [],
            summary: doc.summary || 'No summary available',
          });
          console.log('✓ Saved:', doc.name);
        } catch (error) {
          console.error('Failed to save document to Firestore:', doc.name, error);
          throw error;
        }
      }
    }

    console.log('All documents saved to Firestore');
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
            <Text className="text-lg font-semibold text-foreground">Add New Property</Text>
            <TouchableOpacity onPress={handleClose} className="p-2">
              <Icon as={X} size={24} className="text-foreground" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView className="flex-1 px-4 py-4">
          {/* Property Name Input */}
          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-foreground">Property Name</Text>
            <TextInput
              value={propertyName}
              onChangeText={setPropertyName}
              placeholder="Enter property name..."
              className="rounded-lg border border-border bg-background px-4 py-3 text-foreground"
              placeholderTextColor="#9CA3AF"
              editable={!isCreating}
            />
          </View>

          {/* Documents Section */}
          <View className="mb-6">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-sm font-medium text-foreground">Documents</Text>
              <TouchableOpacity
                onPress={handlePickDocuments}
                disabled={isCreating}
                className="flex-row items-center gap-2 rounded-md bg-secondary px-3 py-2">
                <Icon as={Upload} size={16} className="text-foreground" />
                <Text className="text-sm font-semibold text-foreground">Upload</Text>
              </TouchableOpacity>
            </View>

            {uploadingDocs.length === 0 ? (
              <View className="items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary/30 p-8">
                <Icon as={FileText} size={32} className="text-muted-foreground" />
                <Text className="mt-2 text-sm text-muted-foreground">
                  No documents uploaded yet
                </Text>
              </View>
            ) : (
              <View className="space-y-2">
                {uploadingDocs.map((doc) => (
                  <View key={doc.id} className="rounded-lg border border-border bg-background p-3">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1">
                        <Text className="font-medium text-foreground" numberOfLines={1}>
                          {doc.name}
                        </Text>
                        <Text className="mt-1 text-xs text-muted-foreground">
                          {(doc.size / 1024).toFixed(1)} KB
                        </Text>

                        {/* Status */}
                        {doc.status === 'uploading' && (
                          <View className="mt-2">
                            <Text className="text-xs text-muted-foreground">
                              Uploading... {Math.round(doc.progress || 0)}%
                            </Text>
                            <View className="mt-1 h-1 overflow-hidden rounded-full bg-border">
                              <View
                                className="h-full bg-primary"
                                style={{ width: `${doc.progress || 0}%` }}
                              />
                            </View>
                          </View>
                        )}

                        {doc.status === 'analyzing' && (
                          <View className="mt-2 flex-row items-center gap-1">
                            <ActivityIndicator size="small" color="#3B82F6" />
                            <Text className="text-xs text-muted-foreground">Analyzing...</Text>
                          </View>
                        )}

                        {doc.status === 'complete' && (
                          <View className="mt-2">
                            <View className="flex-row items-center gap-1">
                              <Icon as={CheckCircle} size={14} className="text-green-500" />
                              <Text className="text-xs text-green-500">Complete</Text>
                            </View>
                            {doc.summary && (
                              <View className="mt-2 rounded-md bg-secondary/50 p-2">
                                <Text className="text-xs text-muted-foreground">
                                  {doc.documentType && `${doc.documentType} • `}
                                  {doc.summary}
                                </Text>
                                {doc.propertyAddress && doc.propertyAddress !== 'N/A' && (
                                  <Text className="mt-1 text-xs font-medium text-foreground">
                                    📍 {doc.propertyAddress}
                                  </Text>
                                )}
                              </View>
                            )}
                          </View>
                        )}

                        {doc.status === 'failed' && (
                          <View className="mt-2 flex-row items-center gap-1">
                            <Icon as={AlertCircle} size={14} className="text-red-500" />
                            <Text className="text-xs text-red-500">{doc.error || 'Failed'}</Text>
                          </View>
                        )}
                      </View>

                      {!isCreating && (
                        <TouchableOpacity
                          onPress={() => removeUploadingDoc(doc.id)}
                          className="ml-2 p-1">
                          <Icon as={X} size={18} className="text-muted-foreground" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer */}
        <View className="border-t border-border bg-background px-4 py-3">
          {uploadingDocs.some((doc) => doc.status === 'uploading') && (
            <Text className="mb-2 text-center text-sm text-muted-foreground">
              Uploading files...
            </Text>
          )}
          <TouchableOpacity
            onPress={() => {
              console.log('Create Property button pressed');
              handleCreate();
            }}
            disabled={
              isCreating ||
              !propertyName.trim() ||
              uploadingDocs.length === 0 ||
              uploadingDocs.some((doc) => doc.status !== 'complete')
            }
            className={`rounded-lg py-3 ${
              isCreating ||
              !propertyName.trim() ||
              uploadingDocs.length === 0 ||
              uploadingDocs.some((doc) => doc.status !== 'complete')
                ? 'bg-secondary'
                : 'bg-primary'
            }`}>
            {isCreating ? (
              <View className="flex-row items-center justify-center gap-2">
                <ActivityIndicator size="small" color="#fff" />
                <Text className="font-semibold text-primary-foreground">Creating...</Text>
              </View>
            ) : (
              <Text className="text-center font-semibold text-primary-foreground">
                Create Property
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
