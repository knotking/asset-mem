import * as React from 'react';
import { Linking, View } from 'react-native';
import Constants from 'expo-constants';
import { LifeBuoy } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import {
  buildSupportMailtoUrl,
  DEFAULT_SUPPORT_EMAIL,
} from '@homeapp/common/lib/support';
import { createLogger } from '@/lib/logger';

const supportLog = createLogger('support');

function getSupportEmail(): string {
  const fromExtra = Constants.expoConfig?.extra?.supportEmail as string | undefined;
  return fromExtra?.trim() || DEFAULT_SUPPORT_EMAIL;
}

export function SupportSettings() {
  const { user } = useAuth();
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const supportEmail = getSupportEmail();

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError('Please describe your issue or question before sending.');
      return;
    }
    setError(null);

    const mailto = buildSupportMailtoUrl(supportEmail, trimmed, {
      userId: user?.uid,
      userEmail: user?.email,
      app: 'mobile',
      appEnv: Constants.expoConfig?.extra?.appEnv as string | undefined,
    });

    try {
      const canOpen = await Linking.canOpenURL(mailto);
      if (!canOpen) {
        setError('Unable to open your email app. Email us directly at ' + supportEmail);
        return;
      }
      await Linking.openURL(mailto);
      setMessage('');
    } catch (err) {
      supportLog.error('support.mailto.failed', undefined, err);
      setError('Could not open your email app. Try ' + supportEmail);
    }
  };

  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-center gap-2">
          <Icon as={LifeBuoy} className="size-5 text-foreground" />
          <CardTitle>Support</CardTitle>
        </View>
        <CardDescription>
          Email {supportEmail}. Your account details are included automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-3">
        <Textarea
          placeholder="What can we help you with?"
          value={message}
          onChangeText={setMessage}
          numberOfLines={5}
          className="min-h-[120px]"
        />
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        <Button onPress={handleSend}>
          <Text className="font-semibold text-primary-foreground">Send email</Text>
        </Button>
      </CardContent>
    </Card>
  );
}
