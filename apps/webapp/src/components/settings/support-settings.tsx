'use client';

import * as React from 'react';
import { LifeBuoy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import { useFirebase } from '@/contexts/firebase-context';
import { useToast } from '@/hooks/use-toast';
import { submitSupportRequest } from '@/lib/support';

export function SupportSettings() {
  const { user } = useAuth();
  const { db } = useFirebase();
  const { toast } = useToast();
  const [message, setMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
      setMessage('');
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5" />
          Support
        </CardTitle>
        <CardDescription>
          Send us a message below. Your account details are included automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="settings-support-message">Message</Label>
          <Textarea
            id="settings-support-message"
            placeholder="What can we help you with?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="resize-y"
            disabled={isSubmitting}
          />
        </div>
        <Button type="button" onClick={handleSend} disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send message'}
        </Button>
      </CardContent>
    </Card>
  );
}
