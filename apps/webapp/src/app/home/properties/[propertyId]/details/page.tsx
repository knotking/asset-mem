

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
        <Card className={cn('group relative transition-shadow hover:shadow-lg', isDeleting && 'opacity-90')}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <Icon className="h-6 w-6 text-red-500 mt-1 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground">{doc.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <Badge variant="outline">{getFileExtension(doc.contentType)}</Badge>
                                {doc.createdAt && (
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="h-3 w-3" />
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
                                            <div key={index} className="flex justify-between items-center text-muted-foreground">
                                                <span className="font-medium text-foreground/80">{entity.name}:</span>
                                                <span className="text-right">{entity.value}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-muted-foreground">{doc.summary || 'No details available.'}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    {!isDeleting ? (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }
    
    return (
        <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto min-h-full">
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
            <Card className="transition-shadow hover:shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Building className="h-5 w-5" /> Basic Information
                            </CardTitle>
                        </div>
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={handleCancelClick} disabled={isSaving}>
                                    <CancelIcon className="h-3 w-3 mr-2" />
                                    Cancel
                                </Button>
                                <Button variant="default" size="sm" onClick={handleSaveClick} disabled={isSaving}>
                                    <Check className="h-3 w-3 mr-2" />
                                    {isSaving ? 'Saving...' : 'Save'}
                                </Button>
                            </div>
                        ) : (
                            <Button variant="outline" size="sm" onClick={handleEditClick}>
                                <Pencil className="h-3 w-3 mr-2" />
                                Edit Details
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">Property Name</label>
                        {isEditing ? (
                            <Input 
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                placeholder="Enter property name"
                                className="text-base"
                                disabled={isSaving}
                            />
                        ) : (
                            <p className="text-foreground p-3 bg-muted/50 rounded-md min-h-[40px] flex items-center">{property?.name}</p>
                        )}
                    </div>
                     <div className="space-y-1">
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
                                <SelectTrigger className="text-base">
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
                            <p className="text-foreground p-3 bg-muted/50 rounded-md min-h-[40px] flex items-center">
                                {property?.propertyType 
                                    ? PROPERTY_TYPES.find(t => t.value === property.propertyType)?.label || property.propertyType 
                                    : 'Not set'}
                            </p>
                         )}
                    </div>
                    {isEditing && editedPropertyType && getSubTypesForType(editedPropertyType).length > 0 && (
                        <div className="space-y-1">
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
                                <SelectTrigger className="text-base">
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
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-muted-foreground">Sub-Type</label>
                            <p className="text-foreground p-3 bg-muted/50 rounded-md min-h-[40px] flex items-center">
                                {getSubTypesForType(property?.propertyType as PropertyType).find(st => st.value === property.propertySubType)?.label || property.propertySubType}
                            </p>
                        </div>
                    )}
                    <div className="space-y-1 md:col-span-2">
                        <label className="text-sm font-medium text-muted-foreground">Address</label>
                         {isEditing ? (
                            <Input 
                                value={editedAddress}
                                onChange={(e) => setEditedAddress(e.target.value)}
                                placeholder="Enter full property address"
                                className="text-base"
                                disabled={isSaving}
                            />
                         ) : (
                             <p className="text-foreground p-3 bg-muted/50 rounded-md flex items-center gap-2 min-h-[40px]">
                                <MapPin className="h-4 w-4" />
                                {property?.address}
                            </p>
                         )}
                    </div>
                </CardContent>
            </Card>

            <Card
              className="transition-shadow hover:shadow-lg cursor-pointer"
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
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-full bg-muted p-3">
                  <Heart className="h-5 w-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">My pros</p>
                  <p className="text-sm text-muted-foreground">
                    {savedProviders.length > 0
                      ? `${savedProviders.length} saved service pro${savedProviders.length === 1 ? '' : 's'}`
                      : 'Save local pros from AI chat recommendations'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card className="transition-shadow hover:shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" /> Property Documents</CardTitle>
                        </div>
                        <Button variant="default" size="sm" onClick={openUploadDialog}>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Documents
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
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
