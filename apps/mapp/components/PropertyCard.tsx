import React from 'react';
import { View, Pressable } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  CheckCircle2,
  Trash2,
  MoreVertical,
  AlertCircle,
  X,
  Pencil,
  MapPin,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useFirebase } from '@homeapp/common/contexts/firebase-context';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

interface PropertyCardProps {
  address: string;
  name: string;
  cityStateZip: string;
  docsCount: number;
  servicesCount: number;
  checksCount: number;
  id: string;
  docGsURIs?: string[]; // Storage URIs for property documents
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
  onPress,
}: PropertyCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { db, storage } = useFirebase();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteProgress, setDeleteProgress] = React.useState(0);
  const [successDialogOpen, setSuccessDialogOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handlePress = () => {
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

  const deleteCollection = async (collectionRef: any) => {
    const querySnapshot = await getDocs(collectionRef);

    if (querySnapshot.size === 0) {
      return; // No documents to delete
    }

    const batch = writeBatch(db);
    querySnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  };

  const handleDelete = async () => {
    if (!user) {
      setErrorMessage('You must be logged in to delete a property.');
      return;
    }

    setDeleteDialogOpen(false);
    setIsDeleting(true);
    setDeleteProgress(0);

    try {
      const batch = writeBatch(db);

      // 1. Delete the property document itself (20%)
      setDeleteProgress(20);
      const propertyRef = doc(db, 'users', user.uid, 'properties', id);
      batch.delete(propertyRef);

      // 2. Query and delete all documents associated with the property (40%)
      setDeleteProgress(40);
      const docsRef = collection(db, 'users', user.uid, 'docs');
      const docsQuery = query(docsRef, where('propertyId', '==', id));
      const docsSnapshot = await getDocs(docsQuery);
      docsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 3. Delete all files from Storage (60%)
      setDeleteProgress(60);
      const deleteStoragePromises = docGsURIs.map((gsUri) => {
        if (gsUri) {
          const storageRef = ref(storage, gsUri);
          return deleteObject(storageRef).catch((err: any) => {
            if (err.code !== 'storage/object-not-found') {
              console.error(`Failed to delete file from storage: ${gsUri}`, err);
            }
          });
        }
        return Promise.resolve();
      });
      await Promise.all(deleteStoragePromises);

      // 4. Delete all associated chat sessions and their messages (80%)
      setDeleteProgress(80);
      const chatsRef = collection(db, 'users', user.uid, 'chats');
      const chatsQuery = query(chatsRef, where('propertyId', '==', id));
      const chatsSnapshot = await getDocs(chatsQuery);

      const deleteSessionPromises = chatsSnapshot.docs.map(async (docSnap) => {
        const messagesRef = collection(docSnap.ref, 'messages');
        await deleteCollection(messagesRef);
        batch.delete(docSnap.ref);
      });
      await Promise.all(deleteSessionPromises);

      // Commit all batched Firestore deletes (100%)
      setDeleteProgress(100);
      await batch.commit();

      // Show success dialog after deletion completes
      setSuccessDialogOpen(true);
    } catch (error) {
      console.error('Error deleting property:', error);
      const errMsg = error instanceof Error ? error.message : 'An unknown error occurred.';
      setErrorMessage(`Failed to delete property: ${errMsg}`);
      setIsDeleting(false);
      setDeleteProgress(0);
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
        disabled={isDeleting}
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
              {!isDeleting && (
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
              <View className="flex-1 items-center rounded-lg bg-muted/50 px-3 py-2">
                <View className="h-5 w-5 items-center justify-center">
                  <Icon as={FileText} size={20} className="text-info" />
                </View>
                <Text className="text-sm font-semibold text-foreground">{docsCount}</Text>
                <Text className="text-xs text-muted-foreground">Docs</Text>
              </View>
              <View className="flex-1 items-center rounded-lg bg-muted/50 px-3 py-2">
                <View className="h-5 w-5 items-center justify-center">
                  <Icon as={Wrench} size={20} className="text-warning" />
                </View>
                <Text className="text-sm font-semibold text-foreground">{servicesCount}</Text>
                <Text className="text-xs text-muted-foreground">Services</Text>
              </View>
              <View className="flex-1 items-center rounded-lg bg-muted/50 px-3 py-2">
                <View className="h-5 w-5 items-center justify-center">
                  <Icon as={CheckCircle2} size={20} className="text-success" />
                </View>
                <Text className="text-sm font-semibold text-foreground">{checksCount}</Text>
                <Text className="text-xs text-muted-foreground">Checks</Text>
              </View>
            </View>
          </CardContent>

          {/* Deletion Overlay */}
          {isDeleting && (
            <View className="absolute inset-0 items-center justify-center rounded-lg bg-background/90 px-8">
              <Text className="mb-4 text-sm font-medium text-foreground">Deleting property...</Text>
              <Progress value={deleteProgress} className="w-full" />
              <Text className="mt-2 text-xs text-muted-foreground">{deleteProgress}%</Text>
            </View>
          )}
        </Card>
      </Pressable>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the property "{name}" and all of its associated documents
              and chat sessions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteDialogOpen(false)}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleDelete}>
              <Text className="text-red-500">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Dialog */}
      <AlertDialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Success</AlertDialogTitle>
            <AlertDialogDescription>
              Property and all associated data have been deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setSuccessDialogOpen(false)}>
              <Text>OK</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
