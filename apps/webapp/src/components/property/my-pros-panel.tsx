'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Star, Users, Phone, Map, CheckCircle, Heart, ExternalLink } from 'lucide-react';
import {
  savedProviderSavedAtDate,
  useSavedServiceProviders,
} from '@/contexts/saved-service-providers-context';
import type { SavedServiceProvider } from '@/lib/types';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
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
import { savedProviderDeleteConfirm } from '@/lib/deletion';

function hasValue(val: unknown): boolean {
  if (!val) return false;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return (
      trimmed !== '' &&
      trimmed.toLowerCase() !== 'n/a' &&
      trimmed.toLowerCase() !== 'not available' &&
      trimmed.toLowerCase() !== 'none' &&
      trimmed.toLowerCase() !== 'null'
    );
  }
  return true;
}

function SavedProviderCard({ provider }: { provider: SavedServiceProvider }) {
  const { removeProvider } = useSavedServiceProviders();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const savedDate = savedProviderSavedAtDate(provider.savedAt);
  const ratingValue =
    provider.ratings && typeof provider.ratings === 'string'
      ? provider.ratings.split('/')[0].trim()
      : null;
  const link = provider.link?.trim() || provider.website?.trim() || undefined;
  const websiteUrl =
    link && /^https?:\/\//i.test(link) ? link : link ? `https://${link}` : undefined;

  const handleRemove = async () => {
    if (pending) return;
    setPending(true);
    try {
      await removeProvider(provider.id);
      setConfirmOpen(false);
      toast({ title: 'Removed from My pros' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not remove pro' });
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex justify-between items-start gap-2">
          <span className="line-clamp-2 flex-1">{provider.name}</span>
          {provider.authorized === 'True' && (
            <Badge variant="outline" className="shrink-0 bg-blue-100 text-blue-800 border-blue-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Authorized
            </Badge>
          )}
        </CardTitle>
        {(hasValue(ratingValue) || hasValue(provider.reviews)) && (
          <CardDescription className="flex items-center gap-2">
            {hasValue(ratingValue) && (
              <span className="flex items-center gap-1 text-yellow-500 text-sm">
                <Star className="h-4 w-4 fill-current" />
                {ratingValue}
              </span>
            )}
            {hasValue(provider.reviews) && (
              <span className="text-xs text-muted-foreground">({provider.reviews} reviews)</span>
            )}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {hasValue(provider.contact_info) && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" />
            <span>{provider.contact_info}</span>
          </div>
        )}
        {hasValue(provider.location) && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Map className="h-4 w-4 shrink-0" />
            <span className="line-clamp-2">{provider.location}</span>
          </div>
        )}
        {hasValue(provider.searchContext) && (
          <p className="text-xs text-muted-foreground">Saved from: {provider.searchContext}</p>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Saved{savedDate ? `: ${format(savedDate, 'M/d/yyyy')}` : ''}
        </p>
        <div className="flex gap-2">
          {websiteUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Website
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirmOpen(true)}>
            <Heart className="h-4 w-4 mr-1 fill-red-500 text-red-500" />
            Remove
          </Button>
        </div>
      </CardFooter>
      <AlertDialog open={confirmOpen} onOpenChange={(open) => !pending && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from My pros?</AlertDialogTitle>
            <AlertDialogDescription>
              {savedProviderDeleteConfirm(provider.name)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={handleRemove}
              className="bg-destructive hover:bg-destructive/90"
            >
              {pending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function MyProsPanelSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function MyProsPanel() {
  const { savedProviders, loading } = useSavedServiceProviders();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProviders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return savedProviders;
    return savedProviders.filter((p) => {
      const haystack = [p.name, p.contact_info, p.location, p.specialties]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [savedProviders, searchTerm]);

  if (loading) {
    return <MyProsPanelSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm text-muted-foreground">
        Local service pros you saved from AI chat for this property.
      </p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search My pros..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="space-y-4">
        {filteredProviders.length > 0 ? (
          filteredProviders.map((provider) => (
            <SavedProviderCard key={provider.id} provider={provider} />
          ))
        ) : (
          <div className="text-center py-16 px-6 border-2 border-dashed rounded-lg">
            <div className="flex flex-col items-center gap-4">
              <div className="p-3 bg-muted rounded-full">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground max-w-md text-sm">
                {savedProviders.length === 0
                  ? 'No saved pros yet. Ask the AI for service recommendations and tap the heart to save a pro here.'
                  : 'No pros match your search.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
