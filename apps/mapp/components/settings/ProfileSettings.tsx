import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { updateProfile } from 'firebase/auth';
import { ChevronRight, Loader2 } from 'lucide-react-native';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import {
  DISPLAY_NAME_MAX_LENGTH,
  displayNameFromEmail,
  getProfileDisplayPresentation,
} from '@homeapp/common/lib/user-display';
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

const profileLog = createLogger('profile');

export function ProfileSettings() {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = React.useState(false);
  const [editedName, setEditedName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  if (!user) {
    return null;
  }

  const savedName = user.displayName?.trim() ?? '';
  const profileDisplay = getProfileDisplayPresentation(user);
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
      Alert.alert(
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
    } catch (error: unknown) {
      profileLog.error('displayName.update.failed', undefined, error);
      Alert.alert(
        'Could not update profile',
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const isSaveDisabled = saving || editedName.trim().length > DISPLAY_NAME_MAX_LENGTH;

  return (
    <>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>
            <Text>Profile</Text>
          </CardTitle>
          <CardDescription>
            <Text className="text-muted-foreground">Your account information</Text>
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                      'text-base font-semibold',
                      profileDisplay.isUnset
                        ? 'text-muted-foreground'
                        : 'text-foreground'
                    )}
                    numberOfLines={1}>
                    {profileDisplay.label}
                  </Text>
                </View>
                <Icon as={ChevronRight} size={18} className="shrink-0 text-muted-foreground" />
              </Pressable>
              {user.email ? (
                <Text className="text-sm text-muted-foreground">{user.email}</Text>
              ) : null}
            </View>
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
