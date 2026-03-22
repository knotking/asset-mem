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
import { FileText, MapPin, Pencil, Upload, Trash2, AlertCircle } from 'lucide-react-native';
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
import { ref, deleteObject } from 'firebase/storage';
import * as DocumentPicker from 'expo-document-picker';
import type { Document } from '@homeapp/common/types';
import { PROPERTY_TYPES, getSubTypesForType, type PropertyType, type PropertySubType } from '@homeapp/common/constants/property-types';
import { extractDocInfo, postFileToAgent } from '@/lib/api';
import { RotatingSparkles } from './RotatingSparkles';
import { AlertDialogWrapper } from './AlertDialogWrapper';

interface PropertyDetailsTabProps {
  property: any;
}

export function PropertyDetailsTab({ property }: PropertyDetailsTabProps) {
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
            extractDocInfo({ docUrl: gsURI, contentType: doc.mimeType, userId: user.uid }),
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
      <AlertDialogWrapper
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Document"
        description={`Are you sure you want to delete "${documentToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteDocument}
        showCancel={true}
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
