import { Text } from '@/components/ui/text';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import {
  ScrollView,
  View,
  ActivityIndicator,
  Modal,
  Image,
  Animated,
  Easing,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  NativeSelectScrollView,
} from '@/components/ui/select';
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
import {
  ArrowLeft,
  MessageSquare,
  FileText,
  MapPin,
  Pencil,
  Upload,
  X,
  File,
  AlertCircle,
  Trash2,
  Sparkles,
  Plus,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { usePropertiesList } from '@homeapp/common/contexts/properties-list';
import { useProperty } from '@homeapp/common/contexts/property';
import { useSession } from '@homeapp/common/contexts/session-context';
import { MessagesProvider, useMessages } from '@homeapp/common/contexts/messages-context';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useFirebase } from '@homeapp/common/contexts/firebase-context';
import { useDocumentUpload } from '@homeapp/common/contexts/document-upload-context';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { GiftedChat, IMessage } from 'react-native-gifted-chat';
import SessionsList from '@/components/SessionsList';
import PushDrawer from '@/components/PushDrawer';
import type {
  Document,
  FileAttachment,
  AgentStep,
  Session,
  AnalysisOptionalAgent,
} from '@homeapp/common/types';
import { PROPERTY_TYPES, ANALYSIS_OPTIONAL_AGENTS } from '@homeapp/common/types';
import { streamAgentResponse, extractDocInfo, postFileToAgent } from '@/lib/api';
import { transformMessagesToGiftedChat } from '@/lib/gifted-chat-utils';
import GiftedChatBubble from '@/components/GiftedChatBubble';
import { GiftedChatInputToolbar } from '@/components/GiftedChatInputToolbar';

// Rotating Sparkles Component
function RotatingSparkles({ size = 14, color = '#3B82F6' }: { size?: number; color?: string }) {
  const spinValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, [spinValue]);

  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Sparkles size={size} color={color} />
    </Animated.View>
  );
}

function DetailsTab({ property }: { property: any }) {
  const { documents, isLoading: documentsLoading } = useProperty();
  const { user } = useAuth();
  const { db, storage } = useFirebase();
  const { uploadingDocs, uploadDocuments, removeUploadingDoc } = useDocumentUpload();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [documentToDelete, setDocumentToDelete] = React.useState<Document | null>(null);
  const [successAlertOpen, setSuccessAlertOpen] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState('');
  const [errorAlertOpen, setErrorAlertOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [addressDialogOpen, setAddressDialogOpen] = React.useState(false);
  const [addressDialogData, setAddressDialogData] = React.useState<{
    newAddress: string;
    currentAddress: string;
    propertyRef: any;
  } | null>(null);

  // Edit mode state
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editedName, setEditedName] = React.useState(property.name);
  const [editedType, setEditedType] = React.useState(property.propertyType || '');
  const [editedAddress, setEditedAddress] = React.useState(property.address);
  const [isSaving, setIsSaving] = React.useState(false);

  // Update form fields when property changes
  React.useEffect(() => {
    setEditedName(property.name);
    setEditedType(property.propertyType || '');
    setEditedAddress(property.address);
  }, [property.name, property.propertyType, property.address]);

  const handleEditToggle = () => {
    if (isEditMode) {
      // Cancel editing - reset to original values
      setEditedName(property.name);
      setEditedType(property.propertyType || '');
      setEditedAddress(property.address);
    }
    setIsEditMode(!isEditMode);
  };

  const handleSaveProperty = async () => {
    if (!user) {
      setErrorMessage('You must be logged in to edit property');
      setErrorAlertOpen(true);
      return;
    }

    if (!editedName.trim()) {
      setErrorMessage('Property name is required');
      setErrorAlertOpen(true);
      return;
    }

    if (!editedAddress.trim()) {
      setErrorMessage('Property address is required');
      setErrorAlertOpen(true);
      return;
    }

    setIsSaving(true);
    try {
      const propertyRef = doc(db, 'users', user.uid, 'properties', property.id);
      await updateDoc(propertyRef, {
        name: editedName.trim(),
        propertyType: editedType.trim() || null,
        address: editedAddress.trim(),
      });

      setIsEditMode(false);
      setSuccessMessage('Property updated successfully.');
      setSuccessAlertOpen(true);
    } catch (error) {
      console.error('Error updating property:', error);
      setErrorMessage('Failed to update property. Please try again.');
      setErrorAlertOpen(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickDocuments = async () => {
    if (!user) {
      setErrorMessage('You must be logged in to upload documents');
      setErrorAlertOpen(true);
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
      console.log('RESULT: ', result);

      // Start uploading using the common hook
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
        onComplete: async (completedDoc) => {
          try {
            // Save to Firestore
            await addDoc(collection(db, 'users', user.uid, 'docs'), {
              userId: user.uid,
              propertyId: property.id,
              name: completedDoc.name,
              url: completedDoc.downloadURL,
              storagePath: completedDoc.storagePath,
              createdAt: serverTimestamp(),
              gsURI: completedDoc.gsURI,
              contentType: completedDoc.mimeType,
              status: 'complete',
              documentType: completedDoc.documentType || 'OTHER',
              propertyAddress: completedDoc.propertyAddress || 'N/A',
              keyEntities: completedDoc.keyEntities || [],
              summary: completedDoc.summary || 'No summary available',
            });

            // If document has a valid address, consider updating property address
            if (
              completedDoc.propertyAddress &&
              completedDoc.propertyAddress !== 'N/A' &&
              completedDoc.propertyAddress !== 'Processing...'
            ) {
              const propertyRef = doc(db, 'users', user.uid, 'properties', property.id);
              const propertyDoc = await getDoc(propertyRef);
              const propertyData = propertyDoc.data();
              const currentAddress = propertyData?.address;

              // Auto-update if current address is "Processing..." (no confirmation needed)
              if (currentAddress === 'Processing...') {
                await updateDoc(propertyRef, {
                  address: completedDoc.propertyAddress,
                  name: completedDoc.propertyAddress,
                });
                console.log('Auto-updated property address to:', completedDoc.propertyAddress);
              }
              // Otherwise, ask for user confirmation
              else if (currentAddress && currentAddress !== completedDoc.propertyAddress) {
                setAddressDialogData({
                  newAddress: completedDoc.propertyAddress,
                  currentAddress: currentAddress,
                  propertyRef: propertyRef,
                });
                setAddressDialogOpen(true);
              }
            }

            // Remove from uploading list immediately
            // The document will now be shown via Firestore listener in the merged list
            removeUploadingDoc(completedDoc.id);
          } catch (error) {
            console.error('Error saving document to Firestore:', error);
            // Keep the uploading doc visible on error so user can see what failed
          }
        },
      });
    } catch (error) {
      console.error('Error picking documents:', error);
      setErrorMessage('Failed to pick documents');
      setErrorAlertOpen(true);
    }
  };

  const handleDeleteDocument = (document: Document) => {
    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
  };

  const handleConfirmAddressUpdate = async () => {
    if (!addressDialogData) return;

    try {
      await updateDoc(addressDialogData.propertyRef, {
        address: addressDialogData.newAddress,
        name: addressDialogData.newAddress,
      });
      console.log('User confirmed: Updated property address to:', addressDialogData.newAddress);
    } catch (error) {
      console.error('Error updating property address:', error);
    }

    setAddressDialogOpen(false);
    setAddressDialogData(null);
  };

  const confirmDeleteDocument = async () => {
    if (!user || !documentToDelete) return;

    try {
      // Delete from Firebase Storage
      if (documentToDelete.storagePath) {
        const fileRef = ref(storage, documentToDelete.storagePath);
        try {
          await deleteObject(fileRef);
          console.log('Deleted from storage:', documentToDelete.storagePath);
        } catch (error: any) {
          if (error.code !== 'storage/object-not-found') {
            console.error('Error deleting from storage:', error);
            throw error;
          }
        }
      }

      // Delete from Firestore
      const docRef = doc(db, 'users', user.uid, 'docs', documentToDelete.id);
      await deleteDoc(docRef);
      console.log('Deleted from Firestore:', documentToDelete.id);

      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
      setSuccessMessage('Document deleted successfully.');
      setSuccessAlertOpen(true);
    } catch (error) {
      console.error('Error deleting document:', error);
      setErrorMessage('Failed to delete document. Please try again.');
      setErrorAlertOpen(true);
    }
  };

  return (
    <View className="mb-4 w-full">
      <Card className="mb-4">
        <CardHeader>
          <View className="mb-1 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Icon as={FileText} size={20} className="text-muted-foreground" />
              <CardTitle>Basic Information</CardTitle>
            </View>
            {!isEditMode ? (
              <Button variant="ghost" size="icon" onPress={handleEditToggle}>
                <Icon as={Pencil} size={20} className="text-muted-foreground" />
              </Button>
            ) : (
              <View className="flex-row gap-2">
                <Button variant="ghost" size="sm" onPress={handleEditToggle} disabled={isSaving}>
                  <Text className="text-muted-foreground">Cancel</Text>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onPress={handleSaveProperty}
                  disabled={isSaving}>
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-primary-foreground">Save</Text>
                  )}
                </Button>
              </View>
            )}
          </View>
        </CardHeader>
        <CardContent className="space-y-4 border-t border-border pt-4">
          <View className="mb-2">
            <Text className="text-sm text-muted-foreground">Property Name</Text>
            {isEditMode ? (
              <Input
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Enter property name"
                editable={!isSaving}
                className="text-md mt-1"
              />
            ) : (
              <Text className="text-md font-medium text-foreground">{property.name}</Text>
            )}
          </View>
          <View className="mb-2">
            <Text className="text-sm text-muted-foreground">Property Type</Text>
            {isEditMode ? (
              <Select
                value={editedType ? { value: editedType, label: editedType } : undefined}
                onValueChange={(option) => setEditedType(option?.value || '')}
                disabled={isSaving}>
                <SelectTrigger className="mt-1" style={{ alignSelf: 'stretch' }}>
                  <SelectValue placeholder="Select property type" />
                </SelectTrigger>
                <SelectContent className="max-w-full">
                  <NativeSelectScrollView>
                    <SelectGroup>
                      {PROPERTY_TYPES.map((type) => (
                        <SelectItem key={type} label={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </NativeSelectScrollView>
                </SelectContent>
              </Select>
            ) : (
              <Text className="text-md font-medium text-foreground">
                {property.propertyType || 'Not set'}
              </Text>
            )}
          </View>
          <View className="mb-2">
            <Text className="text-sm text-muted-foreground">Address</Text>
            {isEditMode ? (
              <Input
                value={editedAddress}
                onChangeText={setEditedAddress}
                placeholder="Enter property address"
                editable={!isSaving}
                multiline
                className="text-md mt-1"
              />
            ) : (
              <View className="flex-row items-center gap-1">
                <Icon as={MapPin} size={16} className="text-muted-foreground" />
                <Text className="text-md font-medium text-foreground">{property.address}</Text>
              </View>
            )}
          </View>
        </CardContent>
      </Card>

      {/* Property Documents Card */}
      <Card>
        <CardHeader>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Icon as={FileText} size={20} className="text-muted-foreground" />
              <CardTitle>Property Documents</CardTitle>
            </View>
            <Button
              onPress={handlePickDocuments}
              variant="default"
              className="flex-row items-center gap-2">
              <Icon as={Upload} size={16} className="text-primary-foreground" />
              <Text className="font-semibold text-primary-foreground">Upload</Text>
            </Button>
          </View>
        </CardHeader>
        {documentsLoading ? (
          <CardContent>
            <ActivityIndicator />
          </CardContent>
        ) : (
          <CardContent className="space-y-3 border-t border-border pt-4">
            {/* Merged Documents List - Optimistic UI with Overlay */}
            {(() => {
              // Create a merged list - show ALL documents (uploading + existing)
              // No name-based filtering to allow duplicate filenames
              const mergedDocs = [
                ...uploadingDocs.map((doc) => ({ ...doc, source: 'uploading' as const })),
                ...documents.map((doc) => ({ ...doc, source: 'firestore' as const })),
              ];

              return mergedDocs.map((doc) => {
                const isUploading = doc.source === 'uploading';
                const uploadDoc = isUploading ? doc : null;

                return (
                  <Card key={doc.id} className="mb-2">
                    <CardContent>
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1">
                          <Text className="font-medium text-foreground" numberOfLines={1}>
                            {doc.name}
                          </Text>
                          <Text className="mt-1 text-xs text-muted-foreground">
                            {isUploading && uploadDoc
                              ? `${(uploadDoc.size / 1024).toFixed(1)} KB`
                              : doc.documentType && `${doc.documentType} • `}
                            {!isUploading &&
                              doc.createdAt &&
                              new Date(
                                doc.createdAt instanceof Date
                                  ? doc.createdAt
                                  : doc.createdAt.toDate()
                              ).toLocaleDateString()}
                          </Text>

                          {/* Upload Status - Inline (original style) */}
                          {isUploading && uploadDoc?.status === 'uploading' && (
                            <View className="mt-2">
                              <Text className="text-xs text-muted-foreground">
                                Uploading... {Math.round(uploadDoc.progress || 0)}%
                              </Text>
                              <View className="mt-1 h-1 overflow-hidden rounded-full bg-border">
                                <View
                                  className="h-full bg-primary"
                                  style={{ width: `${uploadDoc.progress || 0}%` }}
                                />
                              </View>
                            </View>
                          )}

                          {isUploading && uploadDoc?.status === 'analyzing' && (
                            <View className="mt-2 flex-row items-center gap-1">
                              <RotatingSparkles size={16} color="#3B82F6" />
                              <Text className="text-xs text-muted-foreground">Analyzing...</Text>
                            </View>
                          )}

                          {isUploading && uploadDoc?.status === 'failed' && (
                            <View className="mt-2 flex-row items-center gap-1">
                              <Icon as={AlertCircle} size={16} className="text-destructive" />
                              <Text className="text-xs text-destructive">
                                {uploadDoc.error || 'Upload failed'}
                              </Text>
                            </View>
                          )}
                        </View>

                        <Pressable
                          onPress={() => {
                            if (isUploading) {
                              removeUploadingDoc(doc.id);
                            } else {
                              handleDeleteDocument(doc as Document);
                            }
                          }}
                          className="ml-2 p-2">
                          <Icon as={Trash2} size={20} color="#ef4444" />
                        </Pressable>
                      </View>

                      {/* Show key entities */}
                      {doc.keyEntities && doc.keyEntities.length > 0 && (
                        <View className="mt-3 space-y-2 border-t border-border pt-3">
                          {doc.keyEntities.map((entity, index) => (
                            <View key={index} className="flex-row justify-between gap-2">
                              <Text className="flex-shrink-0 text-sm text-muted-foreground">
                                {entity.name}
                              </Text>
                              <Text
                                className="text-md flex-1 text-right font-semibold text-foreground"
                                numberOfLines={2}>
                                {entity.value}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </CardContent>
                  </Card>
                );
              });
            })()}
          </CardContent>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.name}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={confirmDeleteDocument}>
              <Text>Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Alert Dialog */}
      <AlertDialog open={successAlertOpen} onOpenChange={setSuccessAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Success</AlertDialogTitle>
            <AlertDialogDescription>{successMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setSuccessAlertOpen(false)}>
              <Text>OK</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Alert Dialog */}
      <AlertDialog open={errorAlertOpen} onOpenChange={setErrorAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setErrorAlertOpen(false)}>
              <Text>OK</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Address Update Confirmation Dialog */}
      <AlertDialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Property Address?</AlertDialogTitle>
            <AlertDialogDescription>
              {addressDialogData && (
                <View>
                  <Text className="mb-1 text-sm text-muted-foreground">
                    A new address was detected:
                  </Text>
                  <Text className="mb-4 text-sm text-foreground">
                    "{addressDialogData.newAddress}"
                  </Text>
                  <Text className="mb-1 text-sm text-muted-foreground">Current address:</Text>
                  <Text className="text-sm text-foreground">
                    "{addressDialogData.currentAddress}"
                  </Text>
                </View>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setAddressDialogOpen(false)}>
              <Text>Keep Current</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleConfirmAddressUpdate}>
              <Text>Update</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

function ChatTab({
  sessionId,
  onMessagesReady,
  userId,
  fileAttachment,
  onAttachmentPress,
  onRemoveAttachment,
  selectedOptionalAgents,
  onToggleOptionalAgent,
  isSending,
  onStop,
  attachmentOptionsVisible,
  onCloseAttachmentOptions,
  onTakePhoto,
  onRecordVideo,
  onSelectFromLibrary,
  onSend,
}: {
  sessionId: string | null;
  onMessagesReady?: (
    updateFn: (messageId: string, updates: Partial<import('@homeapp/common/types').Message>) => void
  ) => void;
  userId: string;
  fileAttachment: FileAttachment | null;
  onAttachmentPress: () => void;
  onRemoveAttachment: () => void;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  onToggleOptionalAgent: (agent: AnalysisOptionalAgent) => void;
  isSending: boolean;
  onStop: () => void;
  attachmentOptionsVisible: boolean;
  onCloseAttachmentOptions: () => void;
  onTakePhoto: () => void;
  onRecordVideo: () => void;
  onSelectFromLibrary: () => void;
  onSend: (messages: IMessage[]) => void;
}) {
  const {
    messages,
    isLoading,
    isLoadingEarlier,
    hasMoreMessages,
    updateMessageLocally,
    loadEarlierMessages,
  } = useMessages();

  React.useEffect(() => {
    if (onMessagesReady) {
      onMessagesReady(updateMessageLocally);
    }
  }, [updateMessageLocally, onMessagesReady]);

  // Transform messages to GiftedChat format
  const giftedMessages = React.useMemo(
    () => transformMessagesToGiftedChat(messages, userId),
    [messages, userId]
  );

  if (!sessionId) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-center text-muted-foreground">
          Select a session to start chatting
        </Text>
      </View>
    );
  }

  return (
    <GiftedChat
      messages={giftedMessages}
      onSend={onSend}
      user={{
        _id: userId,
      }}
      renderBubble={(props) => <GiftedChatBubble {...props} />}
      renderChatEmpty={() => (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: '50%',
            transform: [{ rotate: '180deg' }],
          }}>
          <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Icon as={MessageSquare} size={32} className="text-muted-foreground" />
            </View>
            <Text className="mb-2 text-center text-xl font-semibold text-foreground">
              Start a Conversation
            </Text>
            <Text className="text-center text-sm text-muted-foreground">
              Ask questions about this property's{'\n'}documents, services, and history
            </Text>
          </View>
        </View>
      )}
      renderInputToolbar={(props) => (
        <GiftedChatInputToolbar
          {...props}
          fileAttachment={fileAttachment}
          onAttachmentPress={onAttachmentPress}
          onRemoveAttachment={onRemoveAttachment}
          selectedOptionalAgents={selectedOptionalAgents}
          onToggleOptionalAgent={onToggleOptionalAgent}
          isSending={isSending}
          onStop={onStop}
          attachmentOptionsVisible={attachmentOptionsVisible}
          onCloseAttachmentOptions={onCloseAttachmentOptions}
          onTakePhoto={onTakePhoto}
          onRecordVideo={onRecordVideo}
          onSelectFromLibrary={onSelectFromLibrary}
        />
      )}
      renderActions={() => null}
      renderAvatar={null}
      isLoadingEarlier={isLoadingEarlier}
      loadEarlier={hasMoreMessages}
      onLoadEarlier={loadEarlierMessages}
      alwaysShowSend={true}
      keyboardShouldPersistTaps="never"
      messagesContainerStyle={{
        backgroundColor: 'transparent',
      }}
      textInputProps={{
        autoCapitalize: 'sentences',
        autoCorrect: true,
      }}
      bottomOffset={-84}
      minInputToolbarHeight={44}
      infiniteScroll
    />
  );
}

export default function PropertyDetailsScreen() {
  const {
    id,
    new: isNew,
    files,
    tab,
    sessionId,
  } = useLocalSearchParams<{
    id: string;
    new?: string;
    files?: string;
    tab?: string;
    sessionId?: string;
  }>();
  const { properties } = usePropertiesList();
  const { draftsByProperty, createPropertyDraftSession, sessionsByProperty } = useSession();
  const { documents } = useProperty();
  const { user } = useAuth();
  const { db, storage } = useFirebase();
  const { uploadDocuments, removeUploadingDoc } = useDocumentUpload();
  const router = useRouter();
  // If new property, show Details tab by default to see upload progress
  // If tab param is provided, use that
  // Otherwise show Chat tab for existing properties
  const [activeTab, setActiveTab] = React.useState<'chat' | 'details'>(
    tab === 'details' ? 'details' : isNew === 'true' ? 'details' : 'chat'
  );
  const [message, setMessage] = React.useState('');
  const [documentsDrawerVisible, setDocumentsDrawerVisible] = React.useState(false);
  const [sessionsDrawerVisible, setSessionsDrawerVisible] = React.useState(false);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [selectedDocuments, setSelectedDocuments] = React.useState<Document[]>([]);
  const [selectedOptionalAgents, setSelectedOptionalAgents] = React.useState<
    AnalysisOptionalAgent[]
  >(() => [...ANALYSIS_OPTIONAL_AGENTS]);
  const [hasManuallyInteracted, setHasManuallyInteracted] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [fileAttachment, setFileAttachment] = React.useState<FileAttachment | null>(null);
  const [errorAlertOpen, setErrorAlertOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [attachmentOptionsVisible, setAttachmentOptionsVisible] = React.useState(false);
  const updateMessageLocallyRef = React.useRef<
    ((messageId: string, updates: Partial<import('@homeapp/common/types').Message>) => void) | null
  >(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Track if files have been uploaded to prevent duplicates on remount
  const hasUploadedFilesRef = React.useRef(false);

  // Handle automatic upload of files when navigating from AddPropertyModal
  React.useEffect(() => {
    if (!user || !id || !files) return;

    // Prevent duplicate uploads on remount/refresh
    if (hasUploadedFilesRef.current) {
      console.log('Files already uploaded, skipping duplicate upload');
      return;
    }

    const startUpload = async () => {
      try {
        const parsedFiles = JSON.parse(files);
        if (!parsedFiles || parsedFiles.length === 0) return;

        console.log('Starting upload for', parsedFiles.length, 'files');

        // Mark as uploaded to prevent duplicates
        hasUploadedFilesRef.current = true;

        // Clear the files parameter from route to prevent re-upload on remount
        // Keep other params intact
        router.setParams({ files: undefined } as any);

        // Start uploading using the common hook (same logic as in DetailsTab)
        await uploadDocuments(parsedFiles, {
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
          onComplete: async (completedDoc) => {
            try {
              // Save to Firestore
              await addDoc(collection(db, 'users', user.uid, 'docs'), {
                userId: user.uid,
                propertyId: id,
                name: completedDoc.name,
                url: completedDoc.downloadURL,
                storagePath: completedDoc.storagePath,
                createdAt: serverTimestamp(),
                gsURI: completedDoc.gsURI,
                contentType: completedDoc.mimeType,
                status: 'complete',
                documentType: completedDoc.documentType || 'OTHER',
                propertyAddress: completedDoc.propertyAddress || 'N/A',
                keyEntities: completedDoc.keyEntities || [],
                summary: completedDoc.summary || 'No summary available',
              });

              console.log('Document saved to Firestore:', completedDoc.name);

              // If document has a valid address, auto-update property address
              if (
                completedDoc.propertyAddress &&
                completedDoc.propertyAddress !== 'N/A' &&
                completedDoc.propertyAddress !== 'Processing...'
              ) {
                const propertyRef = doc(db, 'users', user.uid, 'properties', id);
                const propertyDoc = await getDoc(propertyRef);
                const propertyData = propertyDoc.data();
                const currentAddress = propertyData?.address;

                // Auto-update if current address is "Processing..."
                if (currentAddress === 'Processing...') {
                  await updateDoc(propertyRef, {
                    address: completedDoc.propertyAddress,
                    name: completedDoc.propertyAddress,
                  });
                  console.log('Auto-updated property address to:', completedDoc.propertyAddress);
                }
              }

              // Remove from uploading list immediately
              // The document will now be shown via Firestore listener in the merged list
              removeUploadingDoc(completedDoc.id);
            } catch (error) {
              console.error('Error saving document to Firestore:', error);
            }
          },
        });
      } catch (error) {
        console.error('Error parsing or uploading files:', error);
      }
    };

    startUpload();
  }, [user, id, files, storage, db, uploadDocuments]);

  // Handle incoming session selection from sessions screen
  React.useEffect(() => {
    if (sessionId) {
      setSelectedSessionId(sessionId);
      setActiveTab('chat');
    }
  }, [sessionId]);

  // Auto-select draft session when property loads
  React.useEffect(() => {
    if (id && draftsByProperty[id] && !selectedSessionId) {
      setSelectedSessionId(draftsByProperty[id].id);
    }
  }, [id, draftsByProperty, selectedSessionId]);

  // Auto-select all documents by default when documents are loaded (only if user hasn't manually interacted)
  React.useEffect(() => {
    if (
      documents &&
      documents.length > 0 &&
      selectedDocuments.length === 0 &&
      !hasManuallyInteracted
    ) {
      setSelectedDocuments(documents);
    }
  }, [documents, selectedDocuments.length, hasManuallyInteracted]);

  const handleAssetUpload = React.useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      if (!user) return;

      const timestamp = Date.now();
      let fileName = asset.fileName;
      const fileNameWithoutExt = fileName ? fileName.replace(/\.[^/.]+$/, '') : '';

      if (!fileName || /^\d+$/.test(fileNameWithoutExt)) {
        const uriParts = asset.uri.split('/');
        const uriFileName = uriParts[uriParts.length - 1];
        const decodedFileName = uriFileName ? decodeURIComponent(uriFileName) : '';

        if (decodedFileName && decodedFileName.includes('.')) {
          const uriFileNameWithoutExt = decodedFileName.replace(/\.[^/.]+$/, '');
          if (!/^\d+$/.test(uriFileNameWithoutExt)) {
            fileName = decodedFileName;
          } else {
            fileName = `photo-${timestamp}.${asset.type === 'video' ? 'mp4' : 'jpg'}`;
          }
        } else {
          fileName = `photo-${timestamp}.${asset.type === 'video' ? 'mp4' : 'jpg'}`;
        }
      }

      const fileType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
      const storageRef = ref(storage, `uploads/${user.uid}/${timestamp}_${fileName}`);
      const attachmentId = `upload-${timestamp}`;

      setFileAttachment({
        id: attachmentId,
        uri: asset.uri,
        progress: 0,
        downloadURL: null,
        error: null,
        storagePath: storageRef.fullPath,
        fileName,
        fileType,
        fileSize: asset.fileSize || 0,
        width: asset.width,
        height: asset.height,
      });

      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();

        const uploadTask = uploadBytesResumable(storageRef, blob);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setFileAttachment((prev: FileAttachment | null) =>
              prev ? { ...prev, progress } : null
            );
          },
          (error) => {
            console.error('Upload error:', error);
            setFileAttachment((prev: FileAttachment | null) =>
              prev ? { ...prev, error: 'Upload failed. Please try again.' } : null
            );
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setFileAttachment((prev: FileAttachment | null) =>
                prev ? { ...prev, progress: 100, downloadURL } : null
              );
            } catch (error) {
              console.error('Error getting download URL:', error);
              setFileAttachment((prev: FileAttachment | null) =>
                prev ? { ...prev, error: 'Failed to process file.' } : null
              );
            }
          }
        );
      } catch (error) {
        console.error('Error uploading file:', error);
        setFileAttachment((prev: FileAttachment | null) =>
          prev ? { ...prev, error: 'Failed to upload file.' } : null
        );
      }
    },
    [user, storage]
  );

  const handleSelectFromLibrary = React.useCallback(async () => {
    setAttachmentOptionsVisible(false);
    if (!user) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setErrorMessage('Please grant permission to access your media library.');
      setErrorAlertOpen(true);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    await handleAssetUpload(result.assets[0]);
  }, [user, handleAssetUpload]);

  const handleTakePhoto = React.useCallback(async () => {
    setAttachmentOptionsVisible(false);
    if (!user) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setErrorMessage('Please grant permission to access your camera.');
      setErrorAlertOpen(true);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    await handleAssetUpload(result.assets[0]);
  }, [user, handleAssetUpload]);

  const handleRecordVideo = React.useCallback(async () => {
    setAttachmentOptionsVisible(false);
    if (!user) return;

    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraPermission.status !== 'granted') {
      setErrorMessage('Please grant permission to access your camera.');
      setErrorAlertOpen(true);
      return;
    }

    const microphonePermission = await ImagePicker.requestMicrophonePermissionsAsync();
    if (microphonePermission.status !== 'granted') {
      setErrorMessage('Please grant permission to access your microphone.');
      setErrorAlertOpen(true);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    await handleAssetUpload(result.assets[0]);
  }, [user, handleAssetUpload]);

  const handleAttachmentPress = React.useCallback(() => {
    if (isSending || fileAttachment) {
      return;
    }
    setAttachmentOptionsVisible(true);
  }, [isSending, fileAttachment]);

  // Remove file attachment
  const removeFileAttachment = React.useCallback(async () => {
    if (!fileAttachment) return;

    // Delete from Firebase Storage if uploaded
    if (fileAttachment.storagePath && fileAttachment.downloadURL) {
      const fileRef = ref(storage, fileAttachment.storagePath);
      try {
        await deleteObject(fileRef);
      } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
          console.error('Error deleting file from storage:', error);
        }
      }
    }

    setFileAttachment(null);
  }, [fileAttachment, storage]);

  const toggleOptionalAgent = React.useCallback((agent: AnalysisOptionalAgent) => {
    setSelectedOptionalAgents((prev) => {
      const isSelected = prev.includes(agent);
      const next = isSelected ? prev.filter((item) => item !== agent) : [...prev, agent];
      return ANALYSIS_OPTIONAL_AGENTS.filter((item) => next.includes(item));
    });
  }, []);

  const handleStop = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
    }
  }, []);

  const handleSendMessage = React.useCallback(async (textOverride?: string) => {
    // Use textOverride if provided, otherwise use message state
    const messageText = textOverride !== undefined ? textOverride : message;
    // Check if there's content to send (message text OR file attachment)
    const hasContent = messageText.trim() || (fileAttachment?.downloadURL && !fileAttachment?.error);
    if (!user || !selectedSessionId || !hasContent || isSending) return;

    // Don't allow sending if file is still uploading or has error
    if (fileAttachment && (!fileAttachment.downloadURL || fileAttachment.error)) {
      setErrorMessage('Please wait for the file to finish uploading.');
      setErrorAlertOpen(true);
      return;
    }

    setIsSending(true);
    const userMessage = messageText;
    const currentFileAttachment = fileAttachment;
    setMessage(''); // Clear input immediately
    setFileAttachment(null); // Clear file attachment

    try {
      // Check if this is a draft session and claim it
      const sessionRef = doc(db, 'users', user.uid, 'chats', selectedSessionId);
      const sessionDoc = await getDoc(sessionRef);
      const sessionData = sessionDoc.data();

      if (sessionDoc.exists() && sessionData?.name === 'draft') {
        // Use message text if available, otherwise use file name, or fallback to 'New Chat'
        const newName =
          userMessage.substring(0, 30) ||
          (currentFileAttachment
            ? `File: ${currentFileAttachment.fileName.substring(0, 20)}`
            : 'New Chat');
        await updateDoc(sessionRef, {
          name: newName,
          propertyId: id,
        });
      }

      // Get agentSessionId from session
      const agentSessionId = sessionData?.agentSessionId;
      if (!agentSessionId) {
        throw new Error('Agent session ID not found');
      }

      // Prepare file data if attachment exists
      let fileData = undefined;
      if (currentFileAttachment && currentFileAttachment.downloadURL) {
        const storageRef = ref(storage, currentFileAttachment.storagePath);
        fileData = {
          name: currentFileAttachment.fileName,
          type: currentFileAttachment.fileType,
          url: currentFileAttachment.downloadURL,
          gsURI: `gs://${storageRef.bucket}/${storageRef.fullPath}`,
          width: currentFileAttachment.width,
          height: currentFileAttachment.height,
        };
      }

      // Add user message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'chats', selectedSessionId, 'messages'), {
        role: 'user',
        content: userMessage,
        createdAt: serverTimestamp(),
        ...(fileData && { file: fileData }),
      });

      // Create placeholder for assistant message
      const assistantMessageRef = await addDoc(
        collection(db, 'users', user.uid, 'chats', selectedSessionId, 'messages'),
        {
          role: 'assistant',
          content: '',
          createdAt: serverTimestamp(),
        }
      );

      // Prepare context document URIs
      const contextDocURIs = selectedDocuments
        .map((doc) => doc.gsURI)
        .filter((uri): uri is string => !!uri);

      // Prepare diagnosis URIs from file attachment
      const diagnosisURIs = fileData?.gsURI ? [fileData.gsURI] : [];

      // Get property address
      const currentProperty = properties.find((p: any) => p.id === id);
      const propertyAddress = currentProperty?.address;

      // Stream agent response
      let assistantContent = '';
      let agentSteps: AgentStep[] = [];

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      // If no message text, provide a default query for file-only messages
      const queryText = userMessage || 'What can you tell me about this?';

      await streamAgentResponse({
        userId: user.uid,
        agentSessionId,
        userQuery: queryText,
        contextDocURIs,
        diagnosisURIs,
        propertyAddress,
        analysisOptionalAgents: selectedOptionalAgents,
        signal,
        onChunk: (chunk) => {
          // Accumulate content but don't update Firestore yet
          // This keeps the message in "loading" state
          assistantContent += chunk;
        },
        onAgentStep: (step) => {
          // Update agent steps in memory only (not in Firestore)
          const existingStepIndex = agentSteps.findIndex((s) => s.name === step.name);
          if (existingStepIndex > -1) {
            agentSteps[existingStepIndex] = step;
          } else {
            agentSteps.push(step);
          }
          // Update message locally in context (in-memory only)
          if (updateMessageLocallyRef.current) {
            updateMessageLocallyRef.current(assistantMessageRef.id, {
              agentSteps: [...agentSteps],
            });
          }
        },
        onComplete: (finalResponse) => {
          // Final update with complete response (removes agent steps by replacing with content)
          updateDoc(assistantMessageRef, {
            content: finalResponse,
          }).catch((err) => console.error('Error completing message:', err));
        },
        onError: (error) => {
          // Update message to show error
          updateDoc(assistantMessageRef, {
            content: `Error: ${error.message}`,
          }).catch((err) => console.error('Error updating error message:', err));
          throw error;
        },
      });

      // Keep documents selected for next message (removed automatic reset)
    } catch (error) {
      // Don't show error for abort - user intentionally stopped
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Message sending was stopped by user');
        return;
      }

      console.error('Error sending message:', error);
      setErrorMessage(
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setErrorAlertOpen(true);
      // Restore message and file attachment if there was an error
      setMessage(userMessage);
      setFileAttachment(currentFileAttachment);
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  }, [
    user,
    selectedSessionId,
    message,
    isSending,
    fileAttachment,
    db,
    storage,
    id,
    selectedDocuments,
    properties,
    selectedOptionalAgents,
  ]);

  const toggleDocumentSelection = (document: Document) => {
    setHasManuallyInteracted(true);
    setSelectedDocuments((prev) => {
      const isSelected = prev.some((doc) => doc.id === document.id);
      if (isSelected) {
        return prev.filter((doc) => doc.id !== document.id);
      } else {
        return [...prev, document];
      }
    });
  };

  // Find the property with the matching ID
  const property = properties.find((p: any) => p.id === id);

  if (!property) {
    return (
      <SafeAreaView className="flex-1 bg-light-background-alt" edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-foreground">Property not found</Text>
          <Button onPress={() => router.back()} variant="default" className="mt-4">
            <Text className="text-primary-foreground">Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <PushDrawer
      visible={documentsDrawerVisible}
      onClose={() => setDocumentsDrawerVisible(false)}
      width={75}
      direction="right"
      mainContent={
        <PushDrawer
          visible={sessionsDrawerVisible}
          onClose={() => setSessionsDrawerVisible(false)}
          width={80}
          direction="left"
          mainContent={
            <SafeAreaView
              className="flex-1 bg-light-background-alt"
              edges={['top', 'left', 'right']}>
              <Stack.Screen
                options={{
                  headerShown: false,
                }}
              />

              {/* Navigation Header */}
              <View className="bg-light-background-alt px-4 py-3">
                <View className="flex-row items-center justify-between" style={{ minHeight: 40 }}>
                  <Button onPress={() => router.back()} variant="ghost" size="icon">
                    <Icon as={ArrowLeft} size={24} className="text-foreground" />
                  </Button>
                  <View className="mx-3 flex-1">
                    <Text
                      className="text-center text-xl font-bold text-foreground"
                      numberOfLines={1}>
                      {property.name}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    {/* Chat Session Controls - Show only on chat tab */}
                    {activeTab === 'chat' && (
                      <View className="flex-row items-center gap-1 rounded-lg border border-border/50 px-1">
                        <View className="relative">
                          <Button
                            onPress={() => setSessionsDrawerVisible(true)}
                            variant="ghost"
                            size="icon">
                            <Icon as={MessageSquare} size={20} className="text-foreground" />
                          </Button>
                          {sessionsByProperty[id] && sessionsByProperty[id].length > 0 && (
                            <View className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1 py-0.5">
                              <Text className="text-center text-[10px] font-semibold text-primary-foreground">
                                {sessionsByProperty[id].length}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Button
                          onPress={async () => {
                            if (!user) return;
                            // Claim existing draft or create new one
                            if (draftsByProperty[id]) {
                              // Select the existing draft session
                              setSelectedSessionId(draftsByProperty[id].id);
                            } else {
                              // Create a new draft session
                              const newSessionId = await createPropertyDraftSession(user.uid, id);
                              if (newSessionId) {
                                setSelectedSessionId(newSessionId);
                              }
                            }
                          }}
                          variant="ghost"
                          size="icon">
                          <Icon as={Plus} size={20} className="text-foreground" />
                        </Button>
                      </View>
                    )}
                    {/* Docs Button - Show on both tabs */}
                    <View className="relative">
                      <Button
                        onPress={() => setDocumentsDrawerVisible(true)}
                        variant="ghost"
                        size="icon">
                        <Icon as={File} size={20} className="text-foreground" />
                      </Button>
                      {documents.length > 0 && (
                        <View className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1 py-0.5">
                          <Text className="text-center text-[10px] font-semibold text-primary-foreground">
                            {documents.length}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {/* Tabs */}
              <View className="flex-row border-b border-border px-4">
                <Pressable
                  onPress={() => setActiveTab('chat')}
                  className={`flex-1 py-3 ${activeTab === 'chat' ? 'border-b-2 border-primary' : ''}`}>
                  <Text
                    className={`text-center font-medium ${
                      activeTab === 'chat' ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                    AI Chat
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setActiveTab('details')}
                  className={`flex-1 py-3 ${activeTab === 'details' ? 'border-b-2 border-primary' : ''}`}>
                  <Text
                    className={`text-center font-medium ${
                      activeTab === 'details' ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                    Details
                  </Text>
                </Pressable>
              </View>

              {/* Selected Documents Display - Compact */}
              {activeTab === 'chat' && selectedDocuments.length > 0 && (
                <View className="border-b border-border bg-secondary/50 px-3 py-1.5">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row items-center gap-1.5">
                      <View className="mr-1 flex-row items-center gap-1">
                        <Icon as={FileText} size={12} className="text-muted-foreground" />
                        <Text className="text-xs font-medium text-muted-foreground">
                          {selectedDocuments.length}
                        </Text>
                      </View>
                      {selectedDocuments.map((doc) => (
                        <Pressable
                          key={doc.id}
                          onPress={() => toggleDocumentSelection(doc)}
                          className="flex-row items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5">
                          <Text className="max-w-24 text-xs text-foreground" numberOfLines={1}>
                            {doc.name}
                          </Text>
                          <Icon as={X} size={12} className="text-muted-foreground" />
                        </Pressable>
                      ))}
                      <Pressable
                        onPress={() => {
                          setHasManuallyInteracted(true);
                          setSelectedDocuments([]);
                        }}
                        className="ml-1 rounded-full bg-background px-2 py-0.5">
                        <Text className="text-xs text-muted-foreground">Clear</Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Main Content Area */}
              {activeTab === 'chat' ? (
                <MessagesProvider sessionId={selectedSessionId}>
                  <ChatTab
                    sessionId={selectedSessionId}
                    onMessagesReady={(updateFn) => {
                      updateMessageLocallyRef.current = updateFn;
                    }}
                    userId={user?.uid || ''}
                    fileAttachment={fileAttachment}
                    onAttachmentPress={handleAttachmentPress}
                    onRemoveAttachment={removeFileAttachment}
                    selectedOptionalAgents={selectedOptionalAgents}
                    onToggleOptionalAgent={toggleOptionalAgent}
                    isSending={isSending}
                    onStop={handleStop}
                    attachmentOptionsVisible={attachmentOptionsVisible}
                    onCloseAttachmentOptions={() => setAttachmentOptionsVisible(false)}
                    onTakePhoto={handleTakePhoto}
                    onRecordVideo={handleRecordVideo}
                    onSelectFromLibrary={handleSelectFromLibrary}
                    onSend={(messages) => {
                      // GiftedChat calls this when user sends - extract text and call our handler
                      if (messages.length > 0) {
                        const text = messages[0].text;
                        setMessage(text);
                        // Call handleSendMessage with the text directly
                        handleSendMessage(text);
                      }
                    }}
                  />
                </MessagesProvider>
              ) : (
                <ScrollView className="flex-1 bg-light-background-alt px-4 py-4">
                  <DetailsTab property={property} />
                </ScrollView>
              )}

              {/* Error Alert Dialog */}
              <AlertDialog open={errorAlertOpen} onOpenChange={setErrorAlertOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Error</AlertDialogTitle>
                    <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogAction onPress={() => setErrorAlertOpen(false)}>
                      <Text>OK</Text>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SafeAreaView>
          }>
          {/* Sessions Drawer Content */}
          <View className="border-b border-border bg-light-background-alt px-4 py-3">
            <View className="flex-row items-center gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-lg font-semibold text-foreground">Sessions</Text>
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {property.name}
                </Text>
              </View>
              <Button onPress={() => setSessionsDrawerVisible(false)} variant="ghost" size="icon">
                <Icon as={X} size={24} className="text-foreground" />
              </Button>
            </View>
          </View>
          <SessionsList
            propertyId={id}
            onSessionPress={(session: Session) => {
              setSelectedSessionId(session.id);
              setActiveTab('chat');
              setSessionsDrawerVisible(false);
            }}
            onCreateSession={() => {
              setActiveTab('chat');
              setSessionsDrawerVisible(false);
            }}
          />
        </PushDrawer>
      }>
      {/* Documents Drawer Content */}
      <View className="border-b border-border bg-light-background-alt px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">
              {activeTab === 'chat' ? 'Select Resources' : 'Property Documents'}
            </Text>
            {activeTab === 'chat' ? (
              <Text className="text-sm text-muted-foreground">
                {selectedDocuments.length} selected for chat context
              </Text>
            ) : (
              <Text className="text-sm text-muted-foreground">
                {documents.length} document{documents.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <Button
            onPress={() => setDocumentsDrawerVisible(false)}
            variant="ghost"
            size="icon"
            className="ml-2">
            <Icon as={X} size={24} className="text-foreground" />
          </Button>
        </View>
      </View>
      <ScrollView className="flex-1 px-4 py-4">
        {documents.length === 0 ? (
          <View className="items-center py-8">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Icon as={FileText} size={32} className="text-muted-foreground" />
            </View>
            <Text className="text-center text-muted-foreground">
              No documents available for this property.
            </Text>
            {activeTab === 'details' && (
              <Text className="mt-2 text-center text-sm text-muted-foreground">
                Go to the Details tab to upload documents.
              </Text>
            )}
          </View>
        ) : (
          <View className="gap-3">
            {activeTab === 'chat' && (
              <View className="rounded-lg bg-secondary p-3">
                <Text className="text-sm text-muted-foreground">
                  Select documents to provide context for your chat conversation
                </Text>
              </View>
            )}
            {documents.map((document) => {
              const isSelected = selectedDocuments.some((doc) => doc.id === document.id);
              return (
                <Pressable
                  key={document.id}
                  onPress={() => {
                    if (activeTab === 'chat') {
                      toggleDocumentSelection(document);
                    }
                  }}
                  className={`rounded-lg border p-4 ${
                    activeTab === 'chat' && isSelected
                      ? 'border-primary bg-secondary'
                      : 'border-border bg-card'
                  }`}>
                  <View className="flex-row items-start gap-3">
                    <View
                      className={`h-10 w-10 items-center justify-center rounded-full ${
                        activeTab === 'chat' && isSelected ? 'bg-primary' : 'bg-secondary'
                      }`}>
                      <Icon
                        as={FileText}
                        size={20}
                        className={
                          activeTab === 'chat' && isSelected
                            ? 'text-primary-foreground'
                            : 'text-muted-foreground'
                        }
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground">{document.name}</Text>
                      {document.documentType && (
                        <Text className="mt-1 text-xs capitalize text-muted-foreground">
                          {document.documentType.replace(/_/g, ' ').toLowerCase()}
                        </Text>
                      )}
                      {document.createdAt && (
                        <Text className="mt-1 text-xs text-muted-foreground">
                          {new Date(
                            document.createdAt instanceof Date
                              ? document.createdAt
                              : document.createdAt.toDate()
                          ).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    {activeTab === 'chat' && isSelected && (
                      <View className="rounded-full bg-primary p-1">
                        <Icon as={X} size={16} className="text-primary-foreground" />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </PushDrawer>
  );
}
