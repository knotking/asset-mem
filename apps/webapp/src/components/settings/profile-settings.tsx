'use client';

import * as React from 'react';
import { updateProfile } from 'firebase/auth';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserProfileAvatar } from '@/components/user-profile-avatar';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import {
  DEFAULT_DISPLAY_LABEL,
  DISPLAY_NAME_MAX_LENGTH,
  getUserDisplayLabel,
} from '@/lib/user-display';

export function ProfileSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedName, setEditedName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  if (!user) {
    return null;
  }

  const savedName = user.displayName?.trim() ?? '';
  const displayLabel = getUserDisplayLabel(user.displayName);

  const handleStartEdit = () => {
    setEditedName(savedName);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedName('');
  };

  const handleSave = async () => {
    const trimmed = editedName.trim();
    if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
      toast({
        variant: 'destructive',
        title: 'Name too long',
        description: `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
      });
      return;
    }
    if (trimmed === savedName) {
      handleCancelEdit();
      return;
    }

    setSaving(true);
    try {
      await updateProfile(user, {
        displayName: trimmed.length > 0 ? trimmed : null,
      });
      setIsEditing(false);
      setEditedName('');
      toast({
        title: 'Profile updated',
        description:
          trimmed.length > 0
            ? 'Your display name has been saved.'
            : 'Your display name has been cleared.',
      });
    } catch (error: unknown) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: string }).code)
          : '';
      toast({
        variant: 'destructive',
        title: 'Could not update profile',
        description: getAuthErrorMessage(
          code,
          error instanceof Error ? error.message : undefined
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your account information</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4">
          <UserProfileAvatar
            user={user}
            className="h-16 w-16 shrink-0"
            fallbackClassName="text-lg"
          />
          <div className="min-w-0 flex-1 space-y-1">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder={DEFAULT_DISPLAY_LABEL}
                  disabled={saving}
                  autoFocus
                  maxLength={DISPLAY_NAME_MAX_LENGTH}
                  className="h-9 text-lg font-medium"
                  aria-label="Display name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSave();
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  title="Save"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <p className="text-lg font-medium truncate">{displayLabel}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleStartEdit}
                  title="Edit display name"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit display name</span>
                </Button>
              </div>
            )}
            {user.email ? (
              <p className="text-sm text-muted-foreground break-all">{user.email}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
