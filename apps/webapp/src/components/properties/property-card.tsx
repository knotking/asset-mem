
'use client';

import React from 'react';
import type { Property } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Home, MapPin, Trash2, FileText, Wrench, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { db, storage } from '@/lib/firebase';
import { collection, deleteDoc, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { deleteCollection } from '@/lib/utils';
import { cn } from '@/lib/utils';


const StatItem = ({ icon: Icon, value, label }: { icon: React.ElementType, value: number, label: string }) => (
    <div className="flex flex-col items-center justify-center p-3 bg-muted/50 rounded-lg gap-1 text-center">
        <Icon className={cn("h-5 w-5", 
            label === 'Docs' ? 'text-blue-500' : 
            label === 'Services' ? 'text-orange-500' : 
            'text-green-500'
        )} />
        <span className="text-sm font-semibold text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
    </div>
);


export function PropertyCard({ property }: { property: Property }) {
    const router = useRouter();
    const { user } = useAuth();
    const { toast } = useToast();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    
    const docCount = property.documents?.length || 0;
    const servicesCount = property.servicesCount || 0;
    const checksCount = property.checksCount || 0;

    const propertyType = property.documents?.find(d => d.documentType === 'DEED') ? 'House' : 'Apartment';
    const Icon = propertyType === 'House' ? Home : Building;

    const handleCardClick = () => {
        router.push(`/home/properties/${property.id}/chat`);
    };

    const handleDelete = async () => {
    if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to delete a property.' });
            return;
        }

        setIsDeleteDialogOpen(false);
        toast({ title: 'Deleting property...', description: `"${property.name}" is being deleted.` });
        
        try {
            const batch = writeBatch(db);

            // 1. Delete the property document itself
            const propertyRef = doc(db, 'users', user.uid, 'properties', property.id);
            batch.delete(propertyRef);

            // 2. Query and delete all documents associated with the property
            const docsRef = collection(db, 'users', user.uid, 'docs');
            const docsQuery = query(docsRef, where('propertyId', '==', property.id));
            const docsSnapshot = await getDocs(docsQuery);
            docsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            // 3. Delete all files from Storage
            const deleteStoragePromises = (property.docGsURIs || []).map(gsUri => {
                if (gsUri) {
                    const storageRef = ref(storage, gsUri);
                    return deleteObject(storageRef).catch(err => {
                        if (err.code !== 'storage/object-not-found') {
                            console.error(`Failed to delete file from storage: ${gsUri}`, err);
                        }
                    });
                }
                return Promise.resolve();
            });
            await Promise.all(deleteStoragePromises);

            // 4. Delete all associated chat sessions
            const chatsRef = collection(db, 'users', user.uid, 'chats');
            const chatsQuery = query(chatsRef, where('propertyId', '==', property.id));
            const chatsSnapshot = await getDocs(chatsQuery);

            const deleteSessionPromises = chatsSnapshot.docs.map(async (docSnap) => {
                const messagesRef = collection(docSnap.ref, 'messages');
                await deleteCollection(messagesRef);
                batch.delete(docSnap.ref);
            });
            await Promise.all(deleteSessionPromises);

            // Commit all batched Firestore deletes
            await batch.commit();

            toast({ title: 'Success', description: 'Property and all associated data have been deleted.' });

        } catch (error) {
            console.error('Error deleting property:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({ variant: 'destructive', title: 'Error', description: `Failed to delete property: ${errorMessage}` });
        }
    };


    return (
        <>
            <Card onClick={handleCardClick} className="flex flex-col transition-shadow hover:shadow-lg group cursor-pointer">
                <CardContent className="p-4 flex-1 flex flex-col gap-4">
                     <div className="flex flex-col">
                        <div className="flex items-start justify-between ">
                            <div className="flex items-center gap-3 ">
                                <div className="flex items-center justify-center h-10 w-10 bg-muted rounded-lg shrink-0">
                                    <Icon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <h3 className="font-medium leading-tight text-foreground" title={property.name}>
                                    {property.name}
                                </h3>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => { e.stopPropagation(); setIsDeleteDialogOpen(true);}}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-6">
                            <MapPin className="h-4 w-4 shrink-0" />
                            <p className="truncate" title={property.address}>{property.address}</p>
                        </div>
                    </div>


                    <div className="grid grid-cols-3 gap-2 mt-auto">
                        <StatItem icon={FileText} value={docCount} label="Docs" />
                        <StatItem icon={Wrench} value={servicesCount} label="Services" />
                        <StatItem icon={CheckCircle2} value={checksCount} label="Checks" />
                    </div>

                </CardContent>
            </Card>

             <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the property &quot;{property.name}&quot; and all of its associated documents and chat sessions. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex justify-end gap-2">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </div>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
