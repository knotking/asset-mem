
'use client';

import React from 'react';
import type { Property } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Home, MapPin, Trash2, FileText, Wrench, Clock } from "lucide-react";
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
import { db } from '@/lib/firebase';
import {
  startPropertyDeletion,
  retryPropertyDeletionJob,
  propertyRemovingLabel,
  deletionErrorLabel,
  markPropertyDeletionFailed,
} from '@/lib/deletion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_LIST_ITEM_TITLE_CLASS } from '@/lib/app-typography';
import { createLogger } from '@/lib/logger';
import { getWebDeletionApiUrls } from '@/lib/api-deletion';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import { PROPERTY_STAT_LABELS } from '@/lib/feature-discovery';

const propertyLog = createLogger('property');


type StatKind = keyof typeof PROPERTY_STAT_LABELS;

const STAT_ICON_CLASS: Record<StatKind, string> = {
  docs: 'text-blue-500',
  services: 'text-orange-500',
  checkpoints: 'text-green-500',
};

const StatItem = ({
  icon: Icon,
  value,
  kind,
}: {
  icon: React.ElementType;
  value: number;
  kind: StatKind;
}) => (
  <div className="flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-lg bg-muted/50 p-3 text-center">
    <Icon className={cn('h-5 w-5 shrink-0', STAT_ICON_CLASS[kind])} />
    <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
    <span className="flex min-h-[2.25rem] w-full flex-col items-center justify-center text-center text-xs leading-tight text-muted-foreground">
      <span>{PROPERTY_STAT_LABELS[kind][0]}</span>
      <span>{PROPERTY_STAT_LABELS[kind][1]}</span>
    </span>
  </div>
);


export function PropertyCard({ property }: { property: Property }) {
    const router = useRouter();
    const { user } = useAuth();
    const { toast } = useToast();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [isStartingDelete, setIsStartingDelete] = React.useState(false);
    const isRemoving = property.deletionStatus === 'deleting' || isStartingDelete;
    const isFailed = property.deletionStatus === 'failed';

    React.useEffect(() => {
      if (property.deletionStatus === 'failed') {
        setIsStartingDelete(false);
      }
    }, [property.deletionStatus]);

    const docCount = property.documents?.length || 0;
    const servicesCount = property.servicesCount || 0;
    const checksCount = property.checksCount || 0;

    const propertyType = property.documents?.find(d => d.documentType === 'DEED') ? 'House' : 'Apartment';
    const Icon = propertyType === 'House' ? Home : Building;

    const handleCardClick = () => {
        if (isRemoving) return;
        router.push(`/home/properties/${property.id}/chat`);
    };

    const handleDelete = async (event: React.MouseEvent) => {
        event.preventDefault();
        if (!user || isStartingDelete) {
            if (!user) {
                toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to delete a property.' });
            }
            return;
        }

        setIsStartingDelete(true);

        try {
            const deletionUrls = getWebDeletionApiUrls();
            const useJobRetry = isFailed && property.deletionJobId;
            const { jobId, result } = useJobRetry
                ? await retryPropertyDeletionJob({
                    db,
                    userId: user.uid,
                    propertyId: property.id,
                    jobId: property.deletionJobId!,
                    jobRetryUrl: deletionUrls.jobRetry(property.deletionJobId!),
                    getIdToken: getFirebaseIdTokenForProxy,
                  })
                : await startPropertyDeletion({
                    db,
                    userId: user.uid,
                    propertyId: property.id,
                    propertyDeleteUrl: deletionUrls.property,
                    getIdToken: getFirebaseIdTokenForProxy,
                  });

            if (!result.ok || !jobId) {
                throw new Error(result.failed[0]?.message ?? 'Failed to start property deletion');
            }

            setIsDeleteDialogOpen(false);
            toast({
                title: 'Removing property',
                description: propertyRemovingLabel(property.name),
            });
        } catch (error) {
            propertyLog.error('property.delete.failed', undefined, error);
            await markPropertyDeletionFailed(db, user.uid, property.id, error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            setIsDeleteDialogOpen(false);
            setIsStartingDelete(false);
            toast({ variant: 'destructive', title: 'Error', description: `Failed to delete property: ${errorMessage}` });
        }
    };


    return (
        <>
            <Card
              onClick={handleCardClick}
              className={cn(
                'relative flex min-w-0 flex-col transition-shadow group',
                isRemoving ? 'cursor-default opacity-90' : 'cursor-pointer hover:shadow-lg'
              )}
            >
                <CardContent className="p-4 flex-1 flex flex-col gap-4">
                     <div className="flex flex-col min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                                <div className="flex items-center justify-center h-10 w-10 bg-muted rounded-lg shrink-0">
                                    <Icon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <h3
                                  className={cn(
                                    APP_LIST_ITEM_TITLE_CLASS,
                                    'min-w-0 break-words leading-tight',
                                  )}
                                  title={property.name}
                                >
                                    {property.name}
                                </h3>
                            </div>
                            {!isRemoving && !isFailed ? (
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground opacity-100 transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setIsDeleteDialogOpen(true);}}>
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-6">
                            <MapPin className="h-4 w-4 shrink-0" />
                            <p className="truncate" title={property.address}>{property.address}</p>
                        </div>
                    </div>


                    <div className="grid grid-cols-3 gap-2 mt-auto">
                        <StatItem icon={FileText} value={docCount} kind="docs" />
                        <StatItem icon={Wrench} value={servicesCount} kind="services" />
                        <StatItem icon={Clock} value={checksCount} kind="checkpoints" />
                    </div>

                </CardContent>
                {isRemoving ? (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/90 px-4 text-center text-sm font-medium">
                    {isStartingDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {propertyRemovingLabel(property.name)}
                  </div>
                ) : null}
                {isFailed ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-background/95 px-4 text-center">
                    <p className="mb-2 text-sm font-medium text-destructive">Removal failed</p>
                    {property.deletionError ? (
                      <p className="mb-3 text-xs text-muted-foreground">
                        {deletionErrorLabel(property.deletionError)}
                      </p>
                    ) : null}
                    <Button
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(e as unknown as React.MouseEvent);
                        }}
                    >
                      Retry
                    </Button>
                  </div>
                ) : null}
            </Card>

             <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={(open) => {
                    if (!open && !isStartingDelete) setIsDeleteDialogOpen(false);
                }}
             >
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the property &quot;{property.name}&quot; and all of its associated documents and chat sessions. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex justify-end gap-2">
                    <AlertDialogCancel disabled={isStartingDelete}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={isStartingDelete}
                        onClick={(event) => void handleDelete(event)}
                        className="bg-destructive hover:bg-destructive/90"
                    >
                        {isStartingDelete && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isStartingDelete ? 'Deleting…' : 'Delete'}
                    </AlertDialogAction>
                </div>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
