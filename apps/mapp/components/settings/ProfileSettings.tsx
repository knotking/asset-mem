import * as React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { updateProfile } from 'firebase/auth';
import { ChevronRight, Loader2, LogOut } from 'lucide-react-native';
import { useAuth } from '@asset-mem/common/contexts/auth-context';
import {
  DISPLAY_NAME_MAX_LENGTH,
  displayNameFromEmail,
  getProfileDisplayPresentation,
  getSignInMethodLabel,
} from '@asset-mem/common/lib/user-display';
import { cn } from '@/lib/utils';
import { UserProfileAvatar } from '@/components/UserProfileAvatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { createLogger } from '@/lib/logger';
import { useThemedAlert } from '@/contexts/themed-alert-context';

const profileLog = createLogger('profile');

export function ProfileSettings() {
  const router = useRouter();
  const { showAlert } = useThemedAlert();
  const { user, logout } = useAuth();
  const [editOpen, setEditOpen] = React.useState(false);
  const [editedName, setEditedName] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  if (!user) {
    return null;
  }

  const savedName = user.displayName?.trim() ?? '';
  const profileDisplay = getProfileDisplayPresentation(user);
  const signInMethod = getSignInMethodLabel(user);
  const inputPlaceholder =
    displayNameFromEmail(user.email) ?? 'Your name';

  const handleOpenEdit = () => {
    setEditedName(savedName);
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    if (saving) return;
    setEditOpen(false);
    setEditedName('');
  };

  const handleSave = async () => {
    const trimmed = editedName.trim();
    if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
      showAlert(
        'Name too long',
        `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`
      );
      return;
    }
    if (trimmed === savedName) {
      handleCloseEdit();
      return;
    }

    setSaving(true);
    try {
      await updateProfile(user, {
        displayName: trimmed.length > 0 ? trimmed : null,
      });
      setEditOpen(false);
      setEditedName('');
      showAlert(
        'Profile updated',
        trimmed.length > 0
          ? 'Your display name has been saved.'
          : 'Your display name has been cleared.',
      );
    } catch (error: unknown) {
      profileLog.error('displayName.update.failed', undefined, error);
      showAlert(
        'Could not update profile',
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const isSaveDisabled = saving || editedName.trim().length > DISPLAY_NAME_MAX_LENGTH;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      router.replace('/');
    } catch (error) {
      profileLog.error('signOut.failed', undefined, error);
      showAlert(
        'Could not sign out',
        error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="gap-4">
          <View className="flex-row items-start gap-4">
            <UserProfileAvatar user={user} className="size-16 shrink-0" />
            <View className="min-w-0 flex-1 gap-2">
              <Pressable
                onPress={handleOpenEdit}
                accessibilityRole="button"
                accessibilityLabel={`Edit display name, currently ${profileDisplay.label}`}
                className="flex-row items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2.5 active:opacity-80">
                <View className="min-w-0 flex-1 pr-2">
                  <Text className="text-xs text-muted-foreground">Display name</Text>
                  <Text
                    className={cn(
                      'leading-5',
                      profileDisplay.isUnset
                        ? 'text-sm font-normal text-muted-foreground'
                        : 'text-base font-semibold text-foreground',
                    )}
                    numberOfLines={1}>
                    {profileDisplay.label}
                  </Text>
                </View>
                <Icon as={ChevronRight} size={18} className="shrink-0 text-muted-foreground" />
              </Pressable>
              {user.email ? (
                <Text className="break-all text-sm leading-5 text-muted-foreground">{user.email}</Text>
              ) : null}
              {signInMethod ? (
                <Text className="text-sm leading-5 text-muted-foreground">
                  Signed in with {signInMethod}
                </Text>
              ) : null}
            </View>
          </View>
          <View className="border-t border-border pt-4">
            <Button
              variant="outline"
              disabled={signingOut}
              className="w-full flex-row items-center justify-center gap-2"
              onPress={() => void handleSignOut()}>
              {signingOut ? (
                <Icon as={Loader2} size={20} className="animate-spin text-foreground" />
              ) : (
                <Icon as={LogOut} size={20} className="text-foreground" />
              )}
              <Text className="font-semibold text-foreground">
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Text>
            </Button>
          </View>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(open) => !open && handleCloseEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit display name</DialogTitle>
            <DialogDescription>
              This name appears in the app header and on your profile.
            </DialogDescription>
          </DialogHeader>

          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Display name</Text>
            <Input
              value={editedName}
              onChangeText={setEditedName}
              placeholder={inputPlaceholder}
              autoFocus
              editable={!saving}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              onSubmitEditing={() => void handleSave()}
              returnKeyType="done"
            />
            <Text className="text-xs text-muted-foreground">
              Optional. Leave blank to clear your name; settings and the header can suggest one
              from your email until you add a name.
            </Text>
          </View>

          <DialogFooter>
            <Button variant="outline" onPress={handleCloseEdit} disabled={saving}>
              <Text className="text-sm">Cancel</Text>
            </Button>
            <Button
              onPress={() => void handleSave()}
              disabled={isSaveDisabled}
              className="flex-row items-center gap-2">
              {saving && <Icon as={Loader2} size={16} className="text-primary-foreground" />}
              <Text className="text-sm text-primary-foreground">Save</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
