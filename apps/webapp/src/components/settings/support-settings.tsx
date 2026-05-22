'use client';

import * as React from 'react';
import { LifeBuoy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { getSupportEmail } from '@/lib/site';
import { buildSupportMailtoUrl } from '@/lib/support';

export function SupportSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = React.useState('');

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
    setMessage('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5" />
          Support
        </CardTitle>
        <CardDescription>
          Email us at {getSupportEmail()}. Your account details are included automatically.
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
          />
        </div>
        <Button type="button" onClick={handleSend}>
          Send email
        </Button>
      </CardContent>
    </Card>
  );
}
