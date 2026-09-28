import React from 'react';
import { View, Pressable } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Home,
  FileText,
  Wrench,
  Clock,
  Trash2,
  MoreVertical,
  AlertCircle,
  X,
  Pencil,
  MapPin,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@asset-mem/common/contexts/auth-context';
import { useFirebase } from '@asset-mem/common/contexts/firebase-context';
import {
  startPropertyDeletion,
  retryPropertyDeletionJob,
  propertyRemovingLabel,
  deletionErrorLabel,
  markPropertyDeletionFailed,
} from '@asset-mem/common/lib/deletion';
import { createLogger } from '@/lib/logger';
import { getMappDeletionApiUrls } from '@/lib/deletion-api';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import { PROPERTY_STAT_LABELS } from '@asset-mem/common/lib/feature-discovery';

const propertyLog = createLogger('property');

interface PropertyCardProps {
  address: string;
  name: string;
  cityStateZip: string;
  docsCount: number;
  servicesCount: number;
  checksCount: number;
  id: string;
  docGsURIs?: string[]; // Storage URIs for property documents
  deletionStatus?: 'deleting' | 'failed';
  deletionJobId?: string;
  deletionError?: string | null;
  onPress?: () => void;
}

export default function PropertyCard({
  address,
  name,
  cityStateZip,
  docsCount,
  servicesCount,
  checksCount,
  id,
  docGsURIs = [],
  deletionStatus,
  deletionJobId,
  deletionError,
  onPress,
}: PropertyCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { db } = useFirebase();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [isStartingDelete, setIsStartingDelete] = React.useState(false);
  const isStartingDeleteRef = React.useRef(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const isRemoving = deletionStatus === 'deleting' || isStartingDelete;
  const isFailed = deletionStatus === 'failed';

  React.useEffect(() => {
    if (deletionStatus === 'failed') {
      isStartingDeleteRef.current = false;
      setIsStartingDelete(false);
    }
  }, [deletionStatus]);

  const handlePress = () => {
    if (isRemoving) return;
    if (onPress) {
      onPress();
    } else {
      router.push({ pathname: '/(tabs)/home/property-details', params: { id: id } });
    }
  };

  const handleEditPress = () => {
    router.push({ pathname: '/(tabs)/home/property-details', params: { id: id, tab: 'details' } });
  };

  const handleDeletePress = (e: any) => {
    // Stop propagation to prevent card navigation
    e?.stopPropagation?.();
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!user || isStartingDelete) {
      if (!user) setErrorMessage('You must be logged in to delete a property.');
      return;
    }

    const deletionUrls = getMappDeletionApiUrls();
    if (!deletionUrls) {
      setErrorMessage('Deletion API is not configured.');
      return;
    }

    setErrorMessage(null);
    isStartingDeleteRef.current = true;
    setIsStartingDelete(true);

    try {
      const useJobRetry = isFailed && deletionJobId;
      const { jobId, result } = useJobRetry
        ? await retryPropertyDeletionJob({
            db,
            userId: user.uid,
            propertyId: id,
            jobId: deletionJobId,
            jobRetryUrl: deletionUrls.jobRetry(deletionJobId),
            getIdToken: getFirebaseIdTokenForProxy,
          })
        : await startPropertyDeletion({
            db,
            userId: user.uid,
            propertyId: id,
            propertyDeleteUrl: deletionUrls.property,
            getIdToken: getFirebaseIdTokenForProxy,
          });

      if (!result.ok || !jobId) {
        throw new Error(result.failed[0]?.message ?? 'Failed to start property deletion');
      }

      setDeleteDialogOpen(false);
    } catch (error) {
      propertyLog.error('property.delete.failed', undefined, error);
      await markPropertyDeletionFailed(db, user.uid, id, error);
      const errMsg = error instanceof Error ? error.message : 'An unknown error occurred.';
      setDeleteDialogOpen(false);
      setErrorMessage(`Failed to delete property: ${errMsg}`);
      isStartingDeleteRef.current = false;
      setIsStartingDelete(false);
    }
  };

  return (
    <>
      {errorMessage && (
        <View className="relative mb-4">
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

      <Pressable
        onPress={handlePress}
        disabled={isRemoving}
        className="relative mb-4"
        android_ripple={{ color: 'rgba(0, 0, 0, 0.05)' }}
        style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
      >
        <Card className="rounded-lg shadow-sm">
          <CardHeader className="pb-3">
            <View className="flex-row items-start gap-3">
              {/* Property Icon */}
              <View className="h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Icon as={Home} size={20} className="text-muted-foreground" />
              </View>

              {/* Property Info */}
              <View className="flex-1">
                <Text
                  className="text-base font-semibold text-foreground"
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {name}
                </Text>
                <View className="mt-0.5 flex-row items-center gap-1">
                  <Icon as={MapPin} size={12} className="text-muted-foreground" />
                  <Text
                    className="text-sm text-muted-foreground"
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {address}
                  </Text>
                </View>
              </View>

              {/* Menu Button */}
              {!isRemoving && !isFailed && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8">
                      <Icon as={MoreVertical} size={18} className="text-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 min-w-0">
                    <DropdownMenuItem onPress={handleEditPress} className="py-2">
                      <Icon as={Pencil} size={14} className="text-foreground" />
                      <Text className="text-sm">Edit</Text>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onPress={handleDeletePress}
                      variant="destructive"
                      className="py-2">
                      <Icon as={Trash2} size={14} className="text-destructive" />
                      <Text className="text-sm">Delete</Text>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </View>
          </CardHeader>

          <CardContent className="pt-0">
            <View className="flex-row gap-2">
              <View className="min-w-0 flex-1 items-center rounded-lg bg-muted/50 px-2 py-2">
                <View className="h-5 w-5 items-center justify-center">
                  <Icon as={FileText} size={20} className="text-info" />
                </View>
                <Text className="text-center text-sm font-semibold text-foreground">{docsCount}</Text>
                <View className="min-h-[34px] w-full items-center justify-center">
                  <Text className="text-center text-xs leading-tight text-muted-foreground">
                    {PROPERTY_STAT_LABELS.docs[0]}
                  </Text>
                  <Text className="text-center text-xs leading-tight text-muted-foreground">
                    {PROPERTY_STAT_LABELS.docs[1]}
                  </Text>
                </View>
              </View>
              <View className="min-w-0 flex-1 items-center rounded-lg bg-muted/50 px-2 py-2">
                <View className="h-5 w-5 items-center justify-center">
                  <Icon as={Wrench} size={20} className="text-warning" />
                </View>
                <Text className="text-center text-sm font-semibold text-foreground">
                  {servicesCount}
                </Text>
                <View className="min-h-[34px] w-full items-center justify-center">
                  <Text className="text-center text-xs leading-tight text-muted-foreground">
                    {PROPERTY_STAT_LABELS.services[0]}
                  </Text>
                  <Text className="text-center text-xs leading-tight text-muted-foreground">
                    {PROPERTY_STAT_LABELS.services[1]}
                  </Text>
                </View>
              </View>
              <View className="min-w-0 flex-1 items-center rounded-lg bg-muted/50 px-2 py-2">
                <View className="h-5 w-5 items-center justify-center">
                  <Icon as={Clock} size={20} className="text-success" />
                </View>
                <Text className="text-center text-sm font-semibold text-foreground">
                  {checksCount}
                </Text>
                <View className="min-h-[34px] w-full items-center justify-center">
                  <Text className="text-center text-xs leading-tight text-muted-foreground">
                    {PROPERTY_STAT_LABELS.checkpoints[0]}
                  </Text>
                  <Text className="text-center text-xs leading-tight text-muted-foreground">
                    {PROPERTY_STAT_LABELS.checkpoints[1]}
                  </Text>
                </View>
              </View>
            </View>
          </CardContent>

          {isRemoving ? (
            <View className="absolute inset-0 items-center justify-center rounded-lg bg-background/90 px-6">
              <Text className="text-center text-sm font-medium text-foreground">
                {propertyRemovingLabel(name)}
              </Text>
            </View>
          ) : null}
          {isFailed ? (
            <View className="absolute inset-0 items-center justify-center rounded-lg bg-background/95 px-4">
              <Text className="mb-2 text-center text-sm font-medium text-destructive">
                Removal failed
              </Text>
              {deletionError ? (
                <Text className="mb-3 text-center text-xs text-muted-foreground">
                  {deletionErrorLabel(deletionError)}
                </Text>
              ) : null}
              <Button size="sm" onPress={handleDelete}>
                <Text>Retry</Text>
              </Button>
            </View>
          ) : null}
        </Card>
      </Pressable>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isStartingDeleteRef.current) setDeleteDialogOpen(false);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the property "{name}" and all of its associated documents
              and chat sessions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStartingDelete} onPress={() => setDeleteDialogOpen(false)}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isStartingDelete}
              onPress={() => {
                isStartingDeleteRef.current = true;
                setIsStartingDelete(true);
                void handleDelete();
              }}>
              <Text>{isStartingDelete ? 'Deleting…' : 'Delete'}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
