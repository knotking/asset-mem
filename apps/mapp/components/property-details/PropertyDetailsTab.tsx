import * as React from 'react';
import { View, ActivityIndicator, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
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
import { FileText, MapPin, Pencil, Upload, Trash2, AlertCircle, Loader2 } from 'lucide-react-native';
import { useProperty } from '@homeapp/common/contexts/property-context';
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
import {
  deleteDocumentAsset,
  documentDeleteConfirm,
  deletionRetryLabel,
  isResourceDeletionFailed,
  markDocumentDeletionFailed,
  resourceDeletingLabel,
  deletionErrorLabel,
} from '@homeapp/common/lib/deletion';
import { getMappDeletionApiUrls } from '@/lib/deletion-api';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import * as DocumentPicker from 'expo-document-picker';
import type { Document } from '@homeapp/common/types';
import { PROPERTY_TYPES, getSubTypesForType, type PropertyType, type PropertySubType } from '@homeapp/common/constants/property-types';
import { queueExtractDocInfo, postFileToAgent } from '@/lib/api';
import { createLogger } from '@/lib/logger';

const propertyLog = createLogger('property');
const uploadLog = createLogger('upload');
import {
  DOCUMENT_QUOTA_USER_MESSAGE,
  getDocumentAnalysisFailureMessage,
  getFailedDocumentSummary,
  isDocumentQuotaMessage,
} from '@homeapp/common/lib/document-analysis-errors';
import {
  isAtPlanLimit,
  planLimitBlockMessage,
} from '@homeapp/common/lib/plan-limit-slice';
import { useLlmTokenUsage } from '@homeapp/common/contexts/llm-token-usage-context';
import { isPlaceholderPropertyAddress } from '@/lib/property-address-placeholder';
import { mergePropertyDocuments } from '@/lib/merge-property-documents';
import { waitForUserDocAnalysis } from '@/lib/wait-user-doc-analysis';
import { RotatingSparkles } from './RotatingSparkles';
import { AlertDialogWrapper } from './AlertDialogWrapper';
import { usePreferences } from '@homeapp/common/contexts/preferences-context';
import { shouldShowFeatureTip } from '@homeapp/common/lib/feature-discovery';
import { FeatureTipBanner } from '@/components/feature-discovery/FeatureTipBanner';
import { useDismissFeatureTip } from '@/hooks/use-dismiss-feature-tip';
import { useRouter } from 'expo-router';

interface PropertyDetailsTabProps {
  property: any;
}

export function PropertyDetailsTab({ property }: PropertyDetailsTabProps) {
  const router = useRouter();
  const {
    documents,
    isLoading: documentsLoading,
    markDocumentsDeleting,
    clearDocumentsDeleting,
    isDocumentDeletingOverlay,
  } = useProperty();
  const { preferences } = usePreferences();
  const { dismissTip } = useDismissFeatureTip();
  const { user } = useAuth();
  const { db, storage } = useFirebase();
  const { uploadingDocs, uploadDocuments, removeUploadingDoc } = useDocumentUpload();
  const { documentsLimit, limitsLoading } = useLlmTokenUsage();
  const documentLimitMessage = planLimitBlockMessage('document', documentsLimit);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [documentToDelete, setDocumentToDelete] = React.useState<Document | null>(null);
  const [deleteDialogDocumentName, setDeleteDialogDocumentName] = React.useState('');
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
  const [editedType, setEditedType] = React.useState<PropertyType | null>(property.propertyType as PropertyType || null);
  const [editedSubType, setEditedSubType] = React.useState<PropertySubType | null>(property.propertySubType as PropertySubType || null);
  const [editedAddress, setEditedAddress] = React.useState(property.address);
  const [isSaving, setIsSaving] = React.useState(false);

  // Update form fields when property changes
  React.useEffect(() => {
    setEditedName(property.name);
    setEditedType(property.propertyType as PropertyType || null);
    setEditedSubType(property.propertySubType as PropertySubType || null);
    setEditedAddress(property.address);
  }, [property.name, property.propertyType, property.propertySubType, property.address]);

  const handleEditToggle = () => {
    if (isEditMode) {
      // Cancel editing - reset to original values
      setEditedName(property.name);
      setEditedType(property.propertyType as PropertyType || null);
      setEditedSubType(property.propertySubType as PropertySubType || null);
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
      const updateData: any = {
        name: editedName.trim(),
        address: editedAddress.trim(),
      };
      
      if (editedType) {
        updateData.propertyType = editedType;
      }
      if (editedSubType && editedSubType !== 'none') {
        updateData.propertySubType = editedSubType;
      }
      
      await updateDoc(propertyRef, updateData);

      setIsEditMode(false);
      setSuccessMessage('Property updated successfully.');
      setSuccessAlertOpen(true);
    } catch (error) {
      propertyLog.error('property.update.failed', undefined, error);
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

      if (!limitsLoading && isAtPlanLimit(documentsLimit, result.assets.length)) {
        setErrorMessage(DOCUMENT_QUOTA_USER_MESSAGE);
        setErrorAlertOpen(true);
        return;
      }

      uploadLog.debug('picker.result');

      // Start uploading using the common hook
      await uploadDocuments(result.assets, {
        userId: user.uid,
        storage,
        onAnalyze: async (doc, gsURI, meta) => {
          const docRef = await addDoc(collection(db, 'users', user.uid, 'docs'), {
            userId: user.uid,
            propertyId: property.id,
            name: doc.name,
            url: meta.downloadURL,
            storagePath: meta.storagePath,
            createdAt: serverTimestamp(),
            gsURI,
            contentType: doc.mimeType,
            status: 'analyzing',
            ragIndexed: false,
            summary: 'Processing...',
          });

          try {
            const ragResult = await postFileToAgent(gsURI, user.uid, docRef.id);
            let queueExtractError: unknown;
            try {
              await queueExtractDocInfo({
                docId: docRef.id,
                docUrl: gsURI,
                contentType: doc.mimeType,
                userId: user.uid,
              });
            } catch (err) {
              queueExtractError = err;
            }

            if (queueExtractError) {
              const queueMsg = getDocumentAnalysisFailureMessage(queueExtractError);
              throw new Error(queueMsg);
            }
            if (ragResult.error && isDocumentQuotaMessage(ragResult.error)) {
              throw new Error(ragResult.error);
            }
            if (!ragResult.success) {
              uploadLog.warn('rag.upload.failed', { error: ragResult.error });
            }

            const data = await waitForUserDocAnalysis(db, user.uid, docRef.id);
            if (data.status === 'failed') {
              throw new Error(
                typeof data.summary === 'string' ? data.summary : 'Document analysis failed'
              );
            }

            return {
              documentType: typeof data.documentType === 'string' ? data.documentType : 'OTHER',
              propertyAddress:
                typeof data.propertyAddress === 'string' ? data.propertyAddress : 'N/A',
              keyEntities: Array.isArray(data.keyEntities) ? data.keyEntities : [],
              summary: typeof data.summary === 'string' ? data.summary : 'No summary available',
              firestoreDocId: docRef.id,
            };
          } catch (error) {
            const summary = getDocumentAnalysisFailureMessage(error);
            await updateDoc(docRef, { status: 'failed', summary });
            throw error;
          }
        },
        onComplete: async (completedDoc) => {
          try {
            if (!completedDoc.firestoreDocId) {
              removeUploadingDoc(completedDoc.id);
              return;
            }

            if (completedDoc.status === 'failed') {
              const failureMessage =
                completedDoc.error ||
                completedDoc.summary ||
                getDocumentAnalysisFailureMessage(new Error('Document analysis failed'));
              setErrorMessage(failureMessage);
              setErrorAlertOpen(true);
              removeUploadingDoc(completedDoc.id);
              return;
            }

            if (
              completedDoc.propertyAddress &&
              completedDoc.propertyAddress !== 'N/A' &&
              !isPlaceholderPropertyAddress(completedDoc.propertyAddress)
            ) {
              const propertyRef = doc(db, 'users', user.uid, 'properties', property.id);
              const propertyDoc = await getDoc(propertyRef);
              const propertyData = propertyDoc.data();
              const currentAddress = propertyData?.address;

              if (isPlaceholderPropertyAddress(currentAddress)) {
                await updateDoc(propertyRef, {
                  address: completedDoc.propertyAddress,
                  name: completedDoc.propertyAddress,
                });
                uploadLog.debug('property.address.autoUpdated');
              } else if (currentAddress && currentAddress !== completedDoc.propertyAddress) {
                setAddressDialogData({
                  newAddress: completedDoc.propertyAddress,
                  currentAddress: currentAddress,
                  propertyRef: propertyRef,
                });
                setAddressDialogOpen(true);
              }
            }

            removeUploadingDoc(completedDoc.id);
          } catch (error) {
            uploadLog.error('postUpload.failed', undefined, error);
          }
        },
      });
    } catch (error) {
      uploadLog.error('picker.failed', undefined, error);
      setErrorMessage('Failed to pick documents');
      setErrorAlertOpen(true);
    }
  };

  const handleDeleteDocument = (document: Document) => {
    setDocumentToDelete(document);
    setDeleteDialogDocumentName(document.name || '');
    setDeleteDialogOpen(true);
  };

  const handleConfirmAddressUpdate = async () => {
    if (!addressDialogData) return;

    try {
      await updateDoc(addressDialogData.propertyRef, {
        address: addressDialogData.newAddress,
        name: addressDialogData.newAddress,
      });
      propertyLog.debug('property.address.confirmed');
    } catch (error) {
      propertyLog.error('property.address.update.failed', undefined, error);
    }

    setAddressDialogOpen(false);
    setAddressDialogData(null);
  };

  const runDeleteDocument = React.useCallback(
    async (document: Document) => {
      if (!user) return;
      const deletionUrls = getMappDeletionApiUrls();

      try {
        if (deletionUrls?.document) {
          try {
            await updateDoc(doc(db, 'users', user.uid, 'docs', document.id), {
              deletionStatus: 'deleting',
              deletionStartedAt: serverTimestamp(),
            });
          } catch (tombstoneError) {
            uploadLog.error('document.delete.tombstone.failed', undefined, tombstoneError);
          }
        }

        const result = await deleteDocumentAsset({
          db,
          storage,
          userId: user.uid,
          docId: document.id,
          storagePath: document.storagePath,
          gsURI: document.gsURI,
          documentDeleteUrl: deletionUrls?.document,
          getIdToken: getFirebaseIdTokenForProxy,
        });

        if (!result.ok) {
          throw new Error(result.failed[0]?.message ?? 'Delete failed');
        }

        uploadLog.debug('document.deleted');
        setSuccessMessage('Document deleted successfully.');
        setSuccessAlertOpen(true);
      } catch (error) {
        uploadLog.error('document.delete.failed', undefined, error);
        await markDocumentDeletionFailed(db, user.uid, document.id, error);
        setErrorMessage('Failed to delete document. Please try again.');
        setErrorAlertOpen(true);
      } finally {
        clearDocumentsDeleting([document.id]);
      }
    },
    [user, db, storage, clearDocumentsDeleting]
  );

  const confirmDeleteDocument = () => {
    const doc = documentToDelete;
    if (!doc) return;
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
    setDeleteDialogDocumentName('');
    markDocumentsDeleting([doc.id]);
    void runDeleteDocument(doc);
  };

  return (
    <View className="mb-4 w-full">
      {documents.length > 0 && shouldShowFeatureTip(preferences, 'docs_linked_to_chat') ? (
        <FeatureTipBanner
          tipId="docs_linked_to_chat"
          title="Chat with your uploads"
          description="Switch to Docs mode in AI Chat to ask about warranties, manuals, and receipts."
          onDismiss={dismissTip}
          actionLabel="Open AI Chat"
          onAction={() =>
            router.push({
              pathname: '/home/property-details',
              params: { id: property.id, tab: 'chat' },
            })
          }
        />
      ) : null}
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
                value={editedType ? { value: editedType, label: PROPERTY_TYPES.find(t => t.value === editedType)?.label || editedType } : undefined}
                onValueChange={(option) => {
                  if (option?.value) {
                    setEditedType(option.value as PropertyType);
                    setEditedSubType(null); // Reset sub-type when type changes
                  } else {
                    setEditedType(null);
                  }
                }}
                disabled={isSaving}>
                <SelectTrigger className="mt-1" style={{ alignSelf: 'stretch' }}>
                  <SelectValue placeholder="Select property type (optional)" />
                </SelectTrigger>
                <SelectContent className="max-w-full">
                  <NativeSelectScrollView>
                    <SelectGroup>
                      {PROPERTY_TYPES.map((type) => (
                        <SelectItem key={type.value} label={type.label} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </NativeSelectScrollView>
                </SelectContent>
              </Select>
            ) : (
              <Text className="text-md font-medium text-foreground">
                {property.propertyType 
                  ? PROPERTY_TYPES.find(t => t.value === property.propertyType)?.label || property.propertyType
                  : 'Not set'}
              </Text>
            )}
          </View>
          {isEditMode && editedType && getSubTypesForType(editedType).length > 0 && (
            <View className="mb-2">
              <Text className="text-sm text-muted-foreground">Sub-Type (Optional)</Text>
              <Select
                value={editedSubType ? { value: editedSubType, label: getSubTypesForType(editedType).find(st => st.value === editedSubType)?.label || editedSubType } : undefined}
                onValueChange={(option) => {
                  if (option?.value) {
                    setEditedSubType(option.value as PropertySubType);
                  } else {
                    setEditedSubType(null);
                  }
                }}
                disabled={isSaving}>
                <SelectTrigger className="mt-1" style={{ alignSelf: 'stretch' }}>
                  <SelectValue placeholder="Select sub-type (optional)" />
                </SelectTrigger>
                <SelectContent className="max-w-full">
                  <NativeSelectScrollView>
                    <SelectGroup>
                      {getSubTypesForType(editedType).map((subType) => (
                        <SelectItem key={subType.value} label={subType.label} value={subType.value}>
                          {subType.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </NativeSelectScrollView>
                </SelectContent>
              </Select>
            </View>
          )}
          {!isEditMode && property.propertySubType && (
            <View className="mb-2">
              <Text className="text-sm text-muted-foreground">Sub-Type</Text>
              <Text className="text-md font-medium text-foreground">
                {getSubTypesForType(property.propertyType as PropertyType).find(st => st.value === property.propertySubType)?.label || property.propertySubType}
              </Text>
            </View>
          )}
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
        {documentLimitMessage ? (
          <Text className="px-6 pb-2 text-sm text-destructive">{documentLimitMessage}</Text>
        ) : null}
        {documentsLoading && uploadingDocs.length === 0 ? (
          <CardContent>
            <ActivityIndicator />
          </CardContent>
        ) : (
          <CardContent className="space-y-3 border-t border-border pt-4">
            {/* Merged Documents List - Optimistic UI with Overlay */}
            {(() => {
              const mergedDocs = mergePropertyDocuments(uploadingDocs, documents);

              return mergedDocs.map((doc) => {
                const isUploading = doc.source === 'uploading';
                const uploadDoc = isUploading ? doc : null;
                const persistedDoc = doc as Document;
                const isDeleting = !isUploading && isDocumentDeletingOverlay(persistedDoc);
                const isDeleteFailed = !isUploading && isResourceDeletionFailed(persistedDoc);

                return (
                  <Card key={doc.id} className="relative mb-2">
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
                            <View className="mt-2 flex-row items-start gap-1">
                              <Icon as={AlertCircle} size={16} className="text-destructive" />
                              <Text className="flex-1 text-xs text-destructive">
                                {uploadDoc.error || uploadDoc.summary || 'Upload failed'}
                              </Text>
                            </View>
                          )}

                          {!isUploading && doc.status === 'analyzing' && (
                            <View className="mt-2 flex-row items-center gap-1">
                              <RotatingSparkles size={16} color="#3B82F6" />
                              <Text className="text-xs text-muted-foreground">Analyzing...</Text>
                            </View>
                          )}

                          {!isUploading &&
                            (() => {
                              const failureSummary = getFailedDocumentSummary(
                                doc as Document
                              );
                              if (!failureSummary) return null;
                              return (
                                <View className="mt-2 flex-row items-start gap-1">
                                  <Icon
                                    as={AlertCircle}
                                    size={16}
                                    className="text-destructive"
                                  />
                                  <Text className="flex-1 text-xs text-destructive">
                                    {failureSummary}
                                  </Text>
                                </View>
                              );
                            })()}

                          {!isUploading && isDeleteFailed ? (
                            <View className="mt-2 gap-2">
                              <View className="flex-row items-start gap-1">
                                <Icon as={AlertCircle} size={16} className="text-destructive" />
                                <Text className="flex-1 text-xs text-destructive">
                                  {deletionErrorLabel(persistedDoc.deletionError)}
                                </Text>
                              </View>
                              <Button
                                variant="outline"
                                size="sm"
                                onPress={() => {
                                  markDocumentsDeleting([persistedDoc.id]);
                                  void runDeleteDocument(persistedDoc);
                                }}>
                                <Text className="text-xs">{deletionRetryLabel}</Text>
                              </Button>
                            </View>
                          ) : null}
                        </View>

                        {!isDeleting ? (
                          <Pressable
                            onPress={() => {
                              if (isUploading) {
                                removeUploadingDoc(doc.id);
                              } else {
                                handleDeleteDocument(persistedDoc);
                              }
                            }}
                            className="ml-2 p-2">
                            <Icon as={Trash2} size={20} color="#ef4444" />
                          </Pressable>
                        ) : null}
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
                    {isDeleting ? (
                      <View className="absolute inset-0 items-center justify-center rounded-lg bg-background/90">
                        <View className="flex-row items-center gap-2">
                          <Icon as={Loader2} size={16} className="animate-spin text-muted-foreground" />
                          <Text className="text-sm font-medium text-foreground">
                            {resourceDeletingLabel}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </Card>
                );
              });
            })()}
          </CardContent>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialogWrapper
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setDocumentToDelete(null);
            setDeleteDialogDocumentName('');
          }
        }}
        title="Delete Document"
        description={documentDeleteConfirm(deleteDialogDocumentName)}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteDocument}
        showCancel={true}
        confirmVariant="destructive"
      />

      {/* Success Alert Dialog */}
      <AlertDialogWrapper
        open={successAlertOpen}
        onOpenChange={setSuccessAlertOpen}
        title="Success"
        description={successMessage}
      />

      {/* Error Alert Dialog */}
      <AlertDialogWrapper
        open={errorAlertOpen}
        onOpenChange={setErrorAlertOpen}
        title="Error"
        description={errorMessage}
      />

      {/* Address Update Confirmation Dialog */}
      <AlertDialogWrapper
        open={addressDialogOpen}
        onOpenChange={setAddressDialogOpen}
        title="Update Property Address?"
        description={
          addressDialogData ? (
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
          ) : (
            ''
          )
        }
        confirmText="Update"
        cancelText="Keep Current"
        onConfirm={handleConfirmAddressUpdate}
        showCancel={true}
      />
    </View>
  );
}
