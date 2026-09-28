import * as React from 'react';
import { View } from 'react-native';
import Constants from 'expo-constants';
import { LifeBuoy } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@asset-mem/common/contexts/auth-context';
import { useFirebase } from '@asset-mem/common/contexts/firebase-context';
import { submitSupportRequest } from '@asset-mem/common/lib/support';
import { createLogger } from '@/lib/logger';

const supportLog = createLogger('support');

export function SupportSettings() {
  const { user } = useAuth();
  const { db } = useFirebase();
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError('Please describe your issue or question before sending.');
      setSuccess(false);
      return;
    }

    if (!user?.uid) {
      setError('Please sign in to send a support message.');
      setSuccess(false);
      return;
    }

    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      await submitSupportRequest(db, user.uid, {
        message: trimmed,
        userEmail: user.email,
        app: 'mobile',
        appEnv: Constants.expoConfig?.extra?.appEnv as string | undefined,
      });
      setMessage('');
      setSuccess(true);
    } catch (err) {
      supportLog.error('support.submit.failed', undefined, err);
      setError(
        err instanceof Error ? err.message : 'Could not send your message. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <View className="flex-row items-center gap-2">
          <Icon as={LifeBuoy} className="size-5 text-foreground" />
          <CardTitle>Support</CardTitle>
        </View>
        <CardDescription>
          Send us a message below. Your account details are included automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-3">
        <Textarea
          placeholder="What can we help you with?"
          value={message}
          onChangeText={(text) => {
            setMessage(text);
            if (error) setError(null);
            if (success) setSuccess(false);
          }}
          numberOfLines={5}
          className="min-h-[120px]"
          editable={!isSubmitting}
        />
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        {success ? (
          <Text className="text-sm text-muted-foreground">
            Message sent. Our team will get back to you as soon as we can.
          </Text>
        ) : null}
        <Button onPress={handleSend} disabled={isSubmitting}>
          <Text className="font-semibold text-primary-foreground">
            {isSubmitting ? 'Sending…' : 'Send message'}
          </Text>
        </Button>
      </CardContent>
    </Card>
  );
}
