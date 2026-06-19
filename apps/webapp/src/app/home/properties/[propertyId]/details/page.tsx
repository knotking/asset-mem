

'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useProperty } from "@/contexts/property-context";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useToast } from "@/hooks/use-toast";
import type { Document as DocumentType } from '@/lib/types';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { deleteDocumentAsset } from '@/lib/deletion/delete-document';
import { isResourceDeletionFailed } from '@/lib/deletion';
import { useOptimisticDeletionOverlay } from '@/hooks/use-optimistic-deletion-overlay';
import { getWebDeletionApiUrls } from '@/lib/api-deletion';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Home, ShieldCheck, ReceiptText, Search, FileKey, FileText, File as FileIcon, Pencil, MapPin, Upload, Download, Trash2, Building, Calendar, Check, X as CancelIcon, Sparkles, Loader2, Heart, ChevronRight } from "lucide-react";
import { useMyProsSheet } from '@/contexts/my-pros-sheet-context';
import { useSavedServiceProviders } from '@/contexts/saved-service-providers-context';
import {
  documentDeleteConfirm,
  documentDeleteFailed,
  deletionRetryLabel,
  markDocumentDeletionFailed,
  resourceDeletingLabel,
  deletionErrorLabel,
} from '@/lib/deletion';
import { useUploadDialog } from "@/contexts/upload-dialog-context";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROPERTY_TYPES, getSubTypesForType, type PropertyType, type PropertySubType } from '@/lib/property-types';
import { createLogger } from '@/lib/logger';
import { getFailedDocumentSummary } from '@/lib/plan-limit-errors';
import { FeatureTipBanner } from '@/components/feature-discovery/feature-tip-banner';
import { usePreferences } from '@/contexts/preferences-context';
import { useDismissFeatureTip } from '@/hooks/use-dismiss-feature-tip';
import { shouldShowFeatureTip } from '@/lib/feature-discovery';
import { cn } from '@/lib/utils';
import { APP_FIELD_VALUE_BOX_CLASS, APP_FIELD_VALUE_CLASS, APP_LIST_ITEM_TITLE_CLASS, APP_SECTION_TITLE_CLASS } from '@/lib/app-typography';

const propertyLog = createLogger('property');

const docTypeIcons: { [key: string]: React.ElementType } = {
  DEED: Home,
  INSURANCE_POLICY: ShieldCheck,
  UTILITY_BILL: ReceiptText,
  INSPECTION_REPORT: Search,
  MORTGAGE_STATEMENT: FileKey,
  OTHER: FileIcon,
};


function DocumentListItem({
  doc,
  isDeleting,
  isDeleteFailed,
  onDeleteClick,
  onRetryClick,
}: {
  doc: DocumentType;
  isDeleting?: boolean;
  isDeleteFailed?: boolean;
  onDeleteClick: (doc: DocumentType) => void;
  onRetryClick?: (doc: DocumentType) => void;
}) {
    const getFileExtension = (contentType: string | undefined) => {
        if (!contentType) return 'DOC';
        const parts = contentType.split('/');
        return (parts[1] || 'doc').toUpperCase();
    }
    
    const Icon = docTypeIcons[doc.documentType || 'OTHER'] || FileIcon;
    const failureSummary = getFailedDocumentSummary(doc);

    return (
        <Card className={cn('group relative min-w-0 transition-shadow hover:shadow-lg', isDeleting && 'opacity-90')}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                        <Icon className="mt-1 h-6 w-6 shrink-0 text-red-500" />
                        <div className="min-w-0 flex-1">
                            <p className={cn(APP_LIST_ITEM_TITLE_CLASS, 'break-words')}>{doc.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline">{getFileExtension(doc.contentType)}</Badge>
                                {doc.createdAt && (
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="h-3 w-3 shrink-0" />
                                        <span>{format(doc.createdAt.toDate(), 'M/d/yyyy')}</span>
                                    </div>
                                )}
                            </div>
                            {doc.status === 'analyzing' ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                                    <Sparkles className="h-4 w-4 animate-spin text-primary" />
                                    <span>Analyzing...</span>
                                </div>
                            ) : isDeleteFailed ? (
                                <div className="mt-2 space-y-2">
                                  <p className="text-sm text-destructive">{deletionErrorLabel(doc.deletionError)}</p>
                                  {onRetryClick ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => onRetryClick(doc)}
                                    >
                                      {deletionRetryLabel}
                                    </Button>
                                  ) : null}
                                </div>
                            ) : failureSummary ? (
                                <p className="mt-2 text-sm text-destructive">{failureSummary}</p>
                            ) : (
                                <div className="mt-2 space-y-1 text-sm">
                                    {doc.keyEntities && doc.keyEntities.length > 0 ? (
                                        doc.keyEntities.map((entity, index) => (
                                            <div key={index} className="flex flex-col gap-0.5 text-muted-foreground sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                                <span className="shrink-0 font-medium text-foreground/80">{entity.name}:</span>
                                                <span className="min-w-0 break-words sm:text-right">{entity.value}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="break-words text-muted-foreground">{doc.summary || 'No details available.'}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    {!isDeleting ? (
                      <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" asChild>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" download={doc.name}>
                                  <Download className="h-4 w-4" />
                              </a>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDeleteClick(doc)}>
                              <Trash2 className="h-4 w-4" />
                          </Button>
                      </div>
                    ) : null}
                </div>
            </CardContent>
            {isDeleting ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/90">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {resourceDeletingLabel}
                </div>
              </div>
            ) : null}
        </Card>
    );
}

function PropertyDetailsContent() {
    const { property, documents, isLoading: isPropertyLoading } = useProperty();
    const { savedProviders } = useSavedServiceProviders();
    const { openMyPros } = useMyProsSheet();
    const { user, authPending } = useRequireAuth();
    const router = useRouter();
    const { toast } = useToast();
    const { onOpen: openUploadDialog } = useUploadDialog();
    const { preferences } = usePreferences();
    const { dismissTip } = useDismissFeatureTip();
    const [docToDelete, setDocToDelete] = useState<DocumentType | null>(null);
    const [deleteDialogDocumentName, setDeleteDialogDocumentName] = useState('');
    const { markDeleting, clearDeleting, isDeletingOverlay } = useOptimisticDeletionOverlay();
    const handleOpenDeleteDocumentDialog = useCallback((doc: DocumentType) => {
        setDocToDelete(doc);
        setDeleteDialogDocumentName(doc.name || '');
    }, []);

    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(property?.name || '');
    const [editedAddress, setEditedAddress] = useState(property?.address || '');
    const [editedPropertyType, setEditedPropertyType] = useState<PropertyType | null>(property?.propertyType as PropertyType || null);
    const [editedPropertySubType, setEditedPropertySubType] = useState<PropertySubType | null>(property?.propertySubType as PropertySubType || null);
    const [isSaving, setIsSaving] = useState(false);

    const handleEditClick = () => {
        setEditedName(property?.name || '');
        setEditedAddress(property?.address || '');
        setEditedPropertyType(property?.propertyType as PropertyType || null);
        setEditedPropertySubType(property?.propertySubType as PropertySubType || null);
        setIsEditing(true);
    };

    const handleCancelClick = () => {
        setIsEditing(false);
    };

    const handleSaveClick = async () => {
        if (!user || !property) return;
        
        if (!editedName.trim() || !editedAddress.trim()) {
            toast({ variant: "destructive", title: "Invalid Input", description: "Property name and address cannot be empty." });
            return;
        }

        setIsSaving(true);
        try {
            const propertyRef = doc(db, 'users', user.uid, 'properties', property.id);
            const updateData: any = {
                name: editedName,
                address: editedAddress,
            };
            
            if (editedPropertyType) {
                updateData.propertyType = editedPropertyType;
            }
            if (editedPropertySubType && editedPropertySubType !== 'none') {
                updateData.propertySubType = editedPropertySubType;
            }
            
            await updateDoc(propertyRef, updateData);
            toast({ title: "Property Updated", description: "The property details have been saved." });
            setIsEditing(false);
        } catch (error) {
            propertyLog.error('property.update.failed', undefined, error);
            toast({ variant: "destructive", title: "Error", description: "Could not save the new property details." });
        } finally {
            setIsSaving(false);
        }
    };

    const runDeleteDocument = useCallback(
        async (doc: DocumentType) => {
            if (!user) return;

            try {
                const deletionUrls = getWebDeletionApiUrls();
                const result = await deleteDocumentAsset({
                    db,
                    storage,
                    userId: user.uid,
                    docId: doc.id,
                    storagePath: doc.storagePath,
                    gsURI: doc.gsURI,
                    documentDeleteUrl: deletionUrls.document,
                    getIdToken: getFirebaseIdTokenForProxy,
                });

                if (!result.ok) {
                    throw new Error(result.failed[0]?.message ?? 'Delete failed');
                }

                toast({ title: "Document Deleted", description: `"${doc.name}" has been removed.` });
            } catch (error) {
                propertyLog.error('document.delete.failed', { docId: doc.id }, error);
                await markDocumentDeletionFailed(db, user.uid, doc.id, error);
                const errorMessage = error instanceof Error ? error.message : documentDeleteFailed;
                toast({ variant: "destructive", title: "Deletion Failed", description: errorMessage });
            } finally {
                clearDeleting([doc.id]);
            }
        },
        [user, db, toast, clearDeleting]
    );

    const handleConfirmDeleteDocument = useCallback(
        (event: React.MouseEvent) => {
            event.preventDefault();
            const doc = docToDelete;
            if (!doc) return;
            setDocToDelete(null);
            setDeleteDialogDocumentName('');
            markDeleting([doc.id]);
            void runDeleteDocument(doc);
        },
        [docToDelete, markDeleting, runDeleteDocument]
    );


    if (authPending || !user || isPropertyLoading) {
        return (
            <div className="mx-auto w-full min-w-0 max-w-5xl space-y-8 p-4 sm:p-6 md:p-10">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }
    
    return (
        <div className="mx-auto min-h-full w-full min-w-0 max-w-5xl space-y-6 p-4 sm:space-y-8 sm:p-6 md:p-10">
            {documents.length > 0 && shouldShowFeatureTip(preferences, 'docs_linked_to_chat') ? (
              <FeatureTipBanner
                tipId="docs_linked_to_chat"
                title="Chat with your uploads"
                description="Switch to Docs mode in AI Chat to ask questions about warranties, manuals, and receipts — answers cite your uploaded files."
                onDismiss={dismissTip}
                actionLabel="Open AI Chat"
                onAction={() => property && router.push(`/home/properties/${property.id}/chat`)}
              />
            ) : null}
            <Card className="min-w-0 transition-shadow hover:shadow-lg">
                <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <CardTitle className={cn(APP_SECTION_TITLE_CLASS, 'flex items-center gap-2')}>
                                <Building className="h-5 w-5 shrink-0" /> Basic Information
                            </CardTitle>
                        </div>
                        {isEditing ? (
                            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                                <Button variant="outline" size="sm" onClick={handleCancelClick} disabled={isSaving} className="flex-1 sm:flex-none">
                                    <CancelIcon className="h-3 w-3 mr-2" />
                                    Cancel
                                </Button>
                                <Button variant="default" size="sm" onClick={handleSaveClick} disabled={isSaving} className="flex-1 sm:flex-none">
                                    <Check className="h-3 w-3 mr-2" />
                                    {isSaving ? 'Saving...' : 'Save'}
                                </Button>
                            </div>
                        ) : (
                            <Button variant="outline" size="sm" onClick={handleEditClick} className="w-full shrink-0 sm:w-auto">
                                <Pencil className="h-3 w-3 mr-2" />
                                Edit Details
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 p-4 pt-0 sm:gap-6 sm:p-6 sm:pt-0 md:grid-cols-2">
                    <div className="min-w-0 space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">Property Name</label>
                        {isEditing ? (
                            <Input 
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                placeholder="Enter property name"
                                className="text-sm sm:text-base"
                                disabled={isSaving}
                            />
                        ) : (
                            <p className={cn(APP_FIELD_VALUE_BOX_CLASS, APP_FIELD_VALUE_CLASS)}>{property?.name}</p>
                        )}
                    </div>
                     <div className="min-w-0 space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">Property Type</label>
                         {isEditing ? (
                            <Select 
                                value={editedPropertyType || ''} 
                                onValueChange={(value) => {
                                    if (value) {
                                        setEditedPropertyType(value as PropertyType);
                                        setEditedPropertySubType(null); // Reset sub-type when type changes
                                    } else {
                                        setEditedPropertyType(null);
                                    }
                                }} 
                                disabled={isSaving}>
                                <SelectTrigger className="w-full text-sm sm:text-base">
                                    <SelectValue placeholder="Select property type (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PROPERTY_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         ) : (
                            <p className={cn(APP_FIELD_VALUE_BOX_CLASS, APP_FIELD_VALUE_CLASS)}>
                                {property?.propertyType 
                                    ? PROPERTY_TYPES.find(t => t.value === property.propertyType)?.label || property.propertyType 
                                    : 'Not set'}
                            </p>
                         )}
                    </div>
                    {isEditing && editedPropertyType && getSubTypesForType(editedPropertyType).length > 0 && (
                        <div className="min-w-0 space-y-1">
                            <label className="text-sm font-medium text-muted-foreground">Sub-Type (Optional)</label>
                            <Select 
                                value={editedPropertySubType || ''} 
                                onValueChange={(value) => {
                                    if (value) {
                                        setEditedPropertySubType(value as PropertySubType);
                                    } else {
                                        setEditedPropertySubType(null);
                                    }
                                }} 
                                disabled={isSaving}>
                                <SelectTrigger className="w-full text-sm sm:text-base">
                                    <SelectValue placeholder="Select sub-type (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {getSubTypesForType(editedPropertyType).map((subType) => (
                                        <SelectItem key={subType.value} value={subType.value}>
                                            {subType.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {!isEditing && property?.propertySubType && (
                        <div className="min-w-0 space-y-1">
                            <label className="text-sm font-medium text-muted-foreground">Sub-Type</label>
                            <p className={cn(APP_FIELD_VALUE_BOX_CLASS, APP_FIELD_VALUE_CLASS)}>
                                {getSubTypesForType(property?.propertyType as PropertyType).find(st => st.value === property.propertySubType)?.label || property.propertySubType}
                            </p>
                        </div>
                    )}
                    <div className="min-w-0 space-y-1 md:col-span-2">
                        <label className="text-sm font-medium text-muted-foreground">Address</label>
                         {isEditing ? (
                            <Input 
                                value={editedAddress}
                                onChange={(e) => setEditedAddress(e.target.value)}
                                placeholder="Enter full property address"
                                className="text-sm sm:text-base"
                                disabled={isSaving}
                            />
                         ) : (
                             <p className={cn(APP_FIELD_VALUE_BOX_CLASS, APP_FIELD_VALUE_CLASS, 'flex items-start gap-2')}>
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                                <span className="min-w-0 break-words">{property?.address}</span>
                            </p>
                         )}
                    </div>
                </CardContent>
            </Card>

            <Card
              className="min-w-0 transition-shadow hover:shadow-lg cursor-pointer"
              onClick={openMyPros}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openMyPros();
                }
              }}
            >
              <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-6">
                <div className="rounded-full bg-muted p-3">
                  <Heart className="h-5 w-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={APP_LIST_ITEM_TITLE_CLASS}>My pros</p>
                  <p className="text-sm text-muted-foreground">
                    {savedProviders.length > 0
                      ? `${savedProviders.length} saved service pro${savedProviders.length === 1 ? '' : 's'}`
                      : 'Save local pros from AI chat recommendations'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card className="min-w-0 transition-shadow hover:shadow-lg">
                <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <CardTitle className={cn(APP_SECTION_TITLE_CLASS, 'flex items-center gap-2')}>
                              <FileText className="h-5 w-5 shrink-0" /> Property Documents
                            </CardTitle>
                        </div>
                        <Button variant="default" size="sm" onClick={openUploadDialog} className="w-full shrink-0 sm:w-auto">
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Documents
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                     {documents.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t">
                            {documents.map(doc => (
                                <DocumentListItem
                                  key={doc.id}
                                  doc={doc}
                                  isDeleting={isDeletingOverlay(doc)}
                                  isDeleteFailed={isResourceDeletionFailed(doc)}
                                  onDeleteClick={handleOpenDeleteDocumentDialog}
                                  onRetryClick={(d) => {
                                    markDeleting([d.id]);
                                    void runDeleteDocument(d);
                                  }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 px-6 border-t">
                            <p className="text-muted-foreground">No documents have been uploaded for this property yet.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            <AlertDialog
                open={!!docToDelete}
                onOpenChange={(open) => {
                    if (!open) {
                        setDocToDelete(null);
                        setDeleteDialogDocumentName('');
                    }
                }}
            >
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Document</AlertDialogTitle>
                    <AlertDialogDescription>
                    {documentDeleteConfirm(deleteDialogDocumentName)}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex justify-end gap-2">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirmDeleteDocument}
                        className="bg-destructive hover:bg-destructive/90"
                    >
                        Delete
                    </AlertDialogAction>
                </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}


export default function PropertyDetailsPage() {
    return <PropertyDetailsContent />;
}
