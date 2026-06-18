import * as React from 'react';
import { Linking } from 'react-native';
import { deleteUser } from 'firebase/auth';
import { Trash2 } from 'lucide-react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import {
  ACCOUNT_DELETION_BILLING_NOTE,
  ACCOUNT_DELETION_CARD_DESCRIPTION,
  ACCOUNT_DELETION_DIALOG_BODY,
  ACCOUNT_DELETION_REAUTH_MESSAGE,
  fullDataErasureSupportLine,
} from '@homeapp/common/lib/account-deletion';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { getAccountDeletionHelpUrl } from '@/lib/legal-urls';
import { openExternalWebUrl } from '@/lib/open-external-url';
import { createLogger } from '@/lib/logger';

const accountLog = createLogger('account');

function getSupportEmail(): string {
  const fromExtra = Constants.expoConfig?.extra?.supportEmail as string | undefined;
  return fromExtra?.trim() || 'hello@asset-mem.com';
}

export function AccountDeletionSettings() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const supportEmail = getSupportEmail();
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogError, setDialogError] = React.useState<string | null>(null);

  if (!user) {
    return null;
  }

  const handleDelete = async () => {
    setError(null);
    setDialogError(null);
    try {
      await deleteUser(user);
      setOpen(false);
      await logout();
      router.replace('/');
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : undefined;
      accountLog.warn('account.delete.failed', { code });
      const message =
        code === 'auth/requires-recent-login'
          ? ACCOUNT_DELETION_REAUTH_MESSAGE
          : err instanceof Error
            ? err.message
            : 'Could not delete your account. Please try again.';
      setError(message);
      setDialogError(message);
    } finally {
      setDeleting(false);
    }
  };

  const openSupportEmail = () => {
    void Linking.openURL(`mailto:${supportEmail}?subject=${encodeURIComponent('Complete data erasure request')}`);
  };

  const openDeletionHelp = () => {
    void openExternalWebUrl(getAccountDeletionHelpUrl()).catch(() => {
      setError('Could not open the account deletion help page.');
    });
  };

  return (
    <Card className="mb-4 border-destructive/30">
      <CardHeader>
        <CardTitle>
          <Text className="text-destructive">Delete account</Text>
        </CardTitle>
        <CardDescription>
          <Text className="text-muted-foreground">{ACCOUNT_DELETION_CARD_DESCRIPTION}</Text>
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-3">
        <Text className="text-sm text-muted-foreground">{ACCOUNT_DELETION_BILLING_NOTE}</Text>
        <Text className="text-sm text-muted-foreground">
          {fullDataErasureSupportLine()}{' '}
          <Text className="text-sm text-blue-600" onPress={openSupportEmail}>
            {supportEmail}
          </Text>
          .
        </Text>
        <Button variant="link" className="h-auto self-start p-0" onPress={openDeletionHelp}>
          <Text className="text-sm text-blue-600">How account deletion works</Text>
        </Button>
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (!deleting) {
              setOpen(next);
              if (!next) setDialogError(null);
            }
          }}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="border-destructive">
              <Icon as={Trash2} size={18} className="mr-2 text-destructive" />
              <Text className="font-semibold text-destructive">Delete my account</Text>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                <Text className="text-sm text-muted-foreground">{ACCOUNT_DELETION_DIALOG_BODY}</Text>
              </AlertDialogDescription>
            </AlertDialogHeader>
            {dialogError ? (
              <Text className="text-sm text-destructive">{dialogError}</Text>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>
                <Text>Cancel</Text>
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                variant="destructive"
                onPress={() => {
                  setDeleting(true);
                  void handleDelete();
                }}>
                <Text>{deleting ? 'Deleting…' : 'Delete account'}</Text>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
