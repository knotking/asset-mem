import * as React from 'react';
import { Linking, Pressable } from 'react-native';
import { deleteUser } from 'firebase/auth';
import { Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import {
  ACCOUNT_DELETION_BILLING_NOTE,
  ACCOUNT_DELETION_CARD_DESCRIPTION,
  ACCOUNT_DELETION_DIALOG_BODY,
  ACCOUNT_DELETION_REAUTH_MESSAGE,
  fullDataErasureSupportLine,
} from '@asset-mem/common/lib/account-deletion';
import { useAuth } from '@asset-mem/common/contexts/auth-context';
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
import {
  IOS_ACCOUNT_DELETION_BILLING_NOTE,
  IOS_ACCOUNT_DELETION_DIALOG_BODY,
  isIosAppStoreBillingRestricted,
} from '@/lib/ios-billing-compliance';
import { useSupportEmail } from '@/hooks/useSupportEmail';
import { createLogger } from '@/lib/logger';

const accountLog = createLogger('account');

const BODY_TEXT_CLASS = 'text-sm leading-5 text-muted-foreground';

export function AccountDeletionSettings() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const supportEmail = useSupportEmail();
  const iosBillingRestricted = isIosAppStoreBillingRestricted();
  const billingNote = iosBillingRestricted
    ? IOS_ACCOUNT_DELETION_BILLING_NOTE
    : ACCOUNT_DELETION_BILLING_NOTE;
  const dialogBody = iosBillingRestricted ? IOS_ACCOUNT_DELETION_DIALOG_BODY : ACCOUNT_DELETION_DIALOG_BODY;
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
    void Linking.openURL(
      `mailto:${supportEmail}?subject=${encodeURIComponent('Complete data erasure request')}`,
    );
  };

  const openDeletionHelp = () => {
    void openExternalWebUrl(getAccountDeletionHelpUrl()).catch(() => {
      setError('Could not open the account deletion help page.');
    });
  };

  return (
    <Card className="mb-4 border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">Delete account</CardTitle>
        <CardDescription>{ACCOUNT_DELETION_CARD_DESCRIPTION}</CardDescription>
      </CardHeader>
      <CardContent className="gap-3">
        <Text className={BODY_TEXT_CLASS}>{billingNote}</Text>
        <Text className={BODY_TEXT_CLASS}>
          {fullDataErasureSupportLine()}{' '}
          <Text className="text-sm leading-5 text-primary" onPress={openSupportEmail}>
            {supportEmail}
          </Text>
          .
        </Text>
        <Pressable
          onPress={openDeletionHelp}
          accessibilityRole="link"
          className="self-start active:opacity-80">
          <Text className="text-sm font-medium leading-5 text-primary">
            How account deletion works
          </Text>
        </Pressable>
        {error ? <Text className="text-sm leading-5 text-destructive">{error}</Text> : null}
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (!deleting) {
              setOpen(next);
              if (!next) setDialogError(null);
            }
          }}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="flex-row items-center gap-2 border-destructive">
              <Icon as={Trash2} size={18} className="text-destructive" />
              <Text className="text-sm font-semibold text-destructive">Delete my account</Text>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription className="leading-5">
                {dialogBody}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {dialogError ? (
              <Text className="text-sm leading-5 text-destructive">{dialogError}</Text>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>
                <Text className="text-sm">Cancel</Text>
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                variant="destructive"
                onPress={() => {
                  setDeleting(true);
                  void handleDelete();
                }}>
                <Text className="text-sm">{deleting ? 'Deleting…' : 'Delete account'}</Text>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
