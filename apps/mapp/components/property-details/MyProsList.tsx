import * as React from 'react';
import { View, ScrollView, Pressable, Linking } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Heart, Map, Phone, Search, Star, Users } from 'lucide-react-native';
import {
  savedProviderSavedAtDate,
  useSavedServiceProviders,
} from '@homeapp/common/contexts/saved-service-providers-context';
import type { SavedServiceProvider } from '@homeapp/common/types';
import { format } from 'date-fns';
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
import { savedProviderDeleteConfirm } from '@homeapp/common/lib/deletion';

function hasValue(val: unknown): boolean {
  if (!val) return false;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed !== '' && trimmed.toLowerCase() !== 'n/a';
  }
  return true;
}

function SavedProviderRow({
  provider,
  onRemove,
}: {
  provider: SavedServiceProvider;
  onRemove: (id: string) => void;
}) {
  const savedDate = savedProviderSavedAtDate(provider.savedAt);
  const ratingValue =
    provider.ratings && typeof provider.ratings === 'string'
      ? provider.ratings.split('/')[0].trim()
      : null;
  const link = provider.link?.trim() || provider.website?.trim();

  return (
    <View className="mb-3 rounded-lg border border-border bg-background p-4">
      <View className="mb-2 flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={2}>
          {provider.name}
        </Text>
        <Pressable onPress={() => onRemove(provider.id)} accessibilityLabel="Remove from My pros">
          <Icon as={Heart} size={20} className="text-red-500" />
        </Pressable>
      </View>
      {(hasValue(ratingValue) || hasValue(provider.reviews)) && (
        <View className="mb-2 flex-row items-center gap-2">
          {hasValue(ratingValue) && (
            <>
              <Icon as={Star} size={16} className="text-warning" />
              <Text className="text-sm text-foreground">{ratingValue}</Text>
            </>
          )}
          {hasValue(provider.reviews) && (
            <Text className="text-xs text-muted-foreground">({provider.reviews})</Text>
          )}
        </View>
      )}
      {hasValue(provider.contact_info) && (
        <View className="mb-1 flex-row items-center gap-2">
          <Icon as={Phone} size={16} className="text-muted-foreground" />
          <Text className="flex-1 text-sm text-foreground">{provider.contact_info}</Text>
        </View>
      )}
      {hasValue(provider.location) && (
        <View className="mb-2 flex-row items-center gap-2">
          <Icon as={Map} size={16} className="text-muted-foreground" />
          <Text className="flex-1 text-sm text-muted-foreground" numberOfLines={2}>
            {provider.location}
          </Text>
        </View>
      )}
      <Text className="text-xs text-muted-foreground">
        Saved{savedDate ? ` ${format(savedDate, 'M/d/yyyy')}` : ''}
      </Text>
      {link ? (
        <Button
          variant="outline"
          className="mt-3"
          onPress={() => {
            const url = /^https?:\/\//i.test(link) ? link : `https://${link}`;
            Linking.openURL(url);
          }}>
          <Text>Website</Text>
        </Button>
      ) : null}
    </View>
  );
}

export function MyProsList() {
  const { savedProviders, loading, removeProvider } = useSavedServiceProviders();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [providerToRemove, setProviderToRemove] = React.useState<SavedServiceProvider | null>(null);
  const [providerRemoveDialogName, setProviderRemoveDialogName] = React.useState('');
  const [isRemoving, setIsRemoving] = React.useState(false);
  const isRemovingRef = React.useRef(false);

  const filtered = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return savedProviders;
    return savedProviders.filter((p) =>
      [p.name, p.contact_info, p.location, p.specialties]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [savedProviders, searchTerm]);

  const handleRemove = React.useCallback((provider: SavedServiceProvider) => {
    setProviderToRemove(provider);
    setProviderRemoveDialogName(provider.name || 'this pro');
  }, []);

  const confirmRemove = React.useCallback(async () => {
    const provider = providerToRemove;
    if (!provider) {
      isRemovingRef.current = false;
      setIsRemoving(false);
      return;
    }
    try {
      await removeProvider(provider.id);
      setProviderToRemove(null);
      setProviderRemoveDialogName('');
    } catch {
      // context logs errors
    } finally {
      isRemovingRef.current = false;
      setIsRemoving(false);
    }
  }, [providerToRemove, removeProvider]);

  const beginRemove = React.useCallback(() => {
    if (!providerToRemove || isRemoving || isRemovingRef.current) return;
    isRemovingRef.current = true;
    setIsRemoving(true);
    void confirmRemove();
  }, [providerToRemove, isRemoving, confirmRemove]);

  return (
    <ScrollView
      className="flex-1 bg-light-background-alt px-4 py-4"
      keyboardShouldPersistTaps="handled">
      <Text className="mb-4 text-sm text-muted-foreground">
        Local service pros you saved from AI chat for this property.
      </Text>
      <View className="mb-4 flex-row items-center rounded-lg border border-border bg-background px-3">
        <Icon as={Search} size={18} className="text-muted-foreground" />
        <Input
          className="ml-2 flex-1 border-0 bg-transparent"
          placeholder="Search My pros..."
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {loading ? (
        <Text className="text-center text-muted-foreground">Loading...</Text>
      ) : filtered.length > 0 ? (
        filtered.map((provider) => (
          <SavedProviderRow
            key={provider.id}
            provider={provider}
            onRemove={() => handleRemove(provider)}
          />
        ))
      ) : (
        <View className="items-center rounded-lg border border-dashed border-border px-6 py-16">
          <Icon as={Users} size={32} className="mb-3 text-muted-foreground" />
          <Text className="text-center text-muted-foreground">
            {savedProviders.length === 0
              ? 'No saved pros yet. Ask the AI for service recommendations and tap the heart to save a pro here.'
              : 'No pros match your search.'}
          </Text>
        </View>
      )}
      <AlertDialog
        open={!!providerToRemove || isRemoving}
        onOpenChange={(open) => {
          if (!open && !isRemovingRef.current && !isRemoving) {
            setProviderToRemove(null);
            setProviderRemoveDialogName('');
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from My pros?</AlertDialogTitle>
            <AlertDialogDescription>
              {savedProviderDeleteConfirm(providerRemoveDialogName)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction disabled={isRemoving} onPress={beginRemove} variant="destructive">
              <Text className="text-sm">{isRemoving ? 'Removing…' : 'Remove'}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollView>
  );
}
