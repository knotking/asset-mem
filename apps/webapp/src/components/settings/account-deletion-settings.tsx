'use client';

import * as React from 'react';
import { deleteUser } from 'firebase/auth';
import { Trash2 } from 'lucide-react';
import {
  ACCOUNT_DELETION_CARD_DESCRIPTION,
  ACCOUNT_DELETION_DIALOG_BODY,
  ACCOUNT_DELETION_REAUTH_MESSAGE,
  fullDataErasureSupportLine,
} from '@/lib/account-deletion';
import { useAuth } from '@/contexts/auth-context';
import { getSupportEmail } from '@/lib/site';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function AccountDeletionSettings() {
  const { user, logout } = useAuth();
  const supportEmail = getSupportEmail();
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!user) {
    return null;
  }

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await deleteUser(user);
      await logout();
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : undefined;
      if (code === 'auth/requires-recent-login') {
        setError(ACCOUNT_DELETION_REAUTH_MESSAGE);
      } else {
        setError(
          err instanceof Error ? err.message : 'Could not delete your account. Please try again.'
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Delete account</CardTitle>
        <CardDescription>{ACCOUNT_DELETION_CARD_DESCRIPTION}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {fullDataErasureSupportLine(supportEmail)}{' '}
          <a href={`mailto:${supportEmail}`} className="underline hover:text-foreground">
            {supportEmail}
          </a>
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="border-destructive text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>{ACCOUNT_DELETION_DIALOG_BODY}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={() => void handleDelete()}
              >
                {deleting ? 'Deleting…' : 'Delete account'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
