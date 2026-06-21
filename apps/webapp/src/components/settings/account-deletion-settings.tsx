'use client';

import * as React from 'react';
import Link from 'next/link';
import { deleteUser } from 'firebase/auth';
import { Trash2 } from 'lucide-react';
import {
  ACCOUNT_DELETION_BILLING_NOTE,
  ACCOUNT_DELETION_CARD_DESCRIPTION,
  ACCOUNT_DELETION_DIALOG_BODY,
  ACCOUNT_DELETION_REAUTH_MESSAGE,
  fullDataErasureSupportLine,
} from '@/lib/account-deletion';
import { useAuth } from '@/contexts/auth-context';
import { useSupportEmail } from '@/hooks/use-support-email';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_SECTION_TITLE_CLASS } from '@/lib/app-typography';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/lib/logger';

const accountLog = createLogger('account');

export function AccountDeletionSettings() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const supportEmail = useSupportEmail();
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogError, setDialogError] = React.useState<string | null>(null);

  if (!user) {
    return null;
  }

  const handleDelete = async (event: React.MouseEvent) => {
    event.preventDefault();
    setError(null);
    setDialogError(null);
    try {
      await deleteUser(user);
      setOpen(false);
      await logout();
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
      toast({ variant: 'destructive', title: 'Could not delete account', description: message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className={cn(APP_SECTION_TITLE_CLASS, 'text-destructive')}>Delete account</CardTitle>
        <CardDescription>{ACCOUNT_DELETION_CARD_DESCRIPTION}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">{ACCOUNT_DELETION_BILLING_NOTE}</p>
        <p className="text-sm text-muted-foreground">
          {fullDataErasureSupportLine()}{' '}
          <a href={`mailto:${supportEmail}`} className="text-primary underline hover:text-foreground">
            {supportEmail}
          </a>
          .
        </p>
        <Link
          href="/account-deletion"
          className="block w-fit text-sm font-medium text-primary hover:underline"
        >
          How account deletion works
        </Link>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (!deleting) {
              setOpen(next);
              if (!next) setDialogError(null);
            }
          }}
        >
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
            {dialogError ? (
              <p className="text-sm text-destructive">{dialogError}</p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                disabled={deleting}
                onClick={(event) => {
                  setDeleting(true);
                  void handleDelete(event);
                }}
              >
                {deleting ? 'Deleting…' : 'Delete account'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
