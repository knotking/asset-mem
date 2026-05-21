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
import { useToast } from '@/hooks/use-toast';
import { getSupportEmail } from '@/lib/site';
import { buildSupportMailtoUrl } from '@homeapp/common/lib/support';

type SupportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SupportDialog({ open, onOpenChange }: SupportDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    if (!open) setMessage('');
  }, [open]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) {
      toast({
        variant: 'destructive',
        title: 'Message required',
        description: 'Please describe your issue or question before sending.',
      });
      return;
    }

    const mailto = buildSupportMailtoUrl(getSupportEmail(), trimmed, {
      userId: user?.uid,
      userEmail: user?.email,
      app: 'web',
      appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
    });

    window.location.href = mailto;
    toast({
      title: 'Opening your email app',
      description: `Send the message to ${getSupportEmail()} from your mail client.`,
    });
    onOpenChange(false);
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
            Describe your issue. We&apos;ll open your email app with a pre-filled message to{' '}
            <span className="font-medium text-foreground">{getSupportEmail()}</span>.
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
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSend}>
            Send email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
