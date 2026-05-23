'use client';

import * as React from 'react';
import { LifeBuoy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import { useFirebase } from '@/contexts/firebase-context';
import { useToast } from '@/hooks/use-toast';
import { submitSupportRequest } from '@/lib/support';

type SupportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SupportDialog({ open, onOpenChange }: SupportDialogProps) {
  const { user } = useAuth();
  const { db } = useFirebase();
  const { toast } = useToast();
  const [message, setMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) setMessage('');
  }, [open]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      toast({
        variant: 'destructive',
        title: 'Message required',
        description: 'Please describe your issue or question before sending.',
      });
      return;
    }

    if (!user?.uid) {
      toast({
        variant: 'destructive',
        title: 'Sign in required',
        description: 'Please sign in to send a support message.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await submitSupportRequest(db, user.uid, {
        message: trimmed,
        userEmail: user.email,
        app: 'web',
        appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
      });
      toast({
        title: 'Message sent',
        description: 'Our team will get back to you as soon as we can.',
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not send message',
        description: err instanceof Error ? err.message : 'Please try again in a moment.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" />
            Contact support
          </DialogTitle>
          <DialogDescription>
            Describe your issue and we&apos;ll get back to you. Your account details are included
            automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="support-message">Message</Label>
          <Textarea
            id="support-message"
            placeholder="What can we help you with?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="resize-y"
            disabled={isSubmitting}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSend} disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
