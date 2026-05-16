

'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useProperty } from "@/contexts/property-context";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import type { Document as DocumentType } from '@/lib/types';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { Home, ShieldCheck, ReceiptText, Search, FileKey, FileText, File as FileIcon, Pencil, MapPin, Upload, Download, Trash2, Building, Calendar, Check, X as CancelIcon, Sparkles } from "lucide-react";
import { useUploadDialog } from "@/contexts/upload-dialog-context";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROPERTY_TYPES, getSubTypesForType, type PropertyType, type PropertySubType } from '@/lib/property-types';
import { createLogger } from '@/lib/logger';

const propertyLog = createLogger('property');

const docTypeIcons: { [key: string]: React.ElementType } = {
  DEED: Home,
  INSURANCE_POLICY: ShieldCheck,
  UTILITY_BILL: ReceiptText,
  INSPECTION_REPORT: Search,
  MORTGAGE_STATEMENT: FileKey,
  OTHER: FileIcon,
};


function DocumentListItem({ doc, onDeleteClick }: { doc: DocumentType, onDeleteClick: (docId: string, docName: string) => void }) {
    const getFileExtension = (contentType: string | undefined) => {
        if (!contentType) return 'DOC';
        const parts = contentType.split('/');
        return (parts[1] || 'doc').toUpperCase();
    }
    
    const Icon = docTypeIcons[doc.documentType || 'OTHER'] || FileIcon;

    return (
        <Card className="group transition-shadow hover:shadow-lg">
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
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" asChild>
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" download={doc.name}>
                                <Download className="h-4 w-4" />
                            </a>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDeleteClick(doc.id, doc.name)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function PropertyDetailsContent() {
    const { property, documents, isLoading: isPropertyLoading } = useProperty();
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const { onOpen: openUploadDialog } = useUploadDialog();
    const [docToDelete, setDocToDelete] = useState<{id: string, name: string} | null>(null);

    // Redirect if not logged in
    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

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

    const handleDelete = async () => {
        if (!docToDelete || !user) return;
        
        const docToDeleteCache = docToDelete;
        setDocToDelete(null);

        try {
            const docRef = doc(db, 'users', user.uid, 'docs', docToDeleteCache.id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                toast({ variant: 'destructive', title: 'Error', description: 'Document not found.' });
                return;
            }

            const docData = docSnap.data();
            const storagePath = docData.storagePath;

            await deleteDoc(docRef);

            if (storagePath) {
                const fileRef = ref(storage, storagePath);
                await deleteObject(fileRef).catch((storageError: any) => {
                     if (storageError.code !== 'storage/object-not-found') throw storageError;
                });
            }
            
            toast({ title: "Document Deleted", description: `"${docToDeleteCache.name}" has been removed.` });
        } catch (error) {
            propertyLog.error('document.delete.failed', { docId: docToDeleteCache.id }, error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({ variant: "destructive", title: "Deletion Failed", description: errorMessage });
        }
    };


    if (isPropertyLoading) {
        return (
            <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }
    
    return (
        <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto min-h-full">
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
                                <DocumentListItem key={doc.id} doc={doc} onDeleteClick={(id, name) => setDocToDelete({id, name})} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 px-6 border-t">
                            <p className="text-muted-foreground">No documents have been uploaded for this property yet.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                    This will permanently delete the document &quot;{docToDelete?.name}&quot;. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex justify-end gap-2">
                    <AlertDialogCancel onClick={() => setDocToDelete(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}


export default function PropertyDetailsPage() {
    return <PropertyDetailsContent />;
}
