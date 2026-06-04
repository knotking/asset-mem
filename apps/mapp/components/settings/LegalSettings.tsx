import * as React from 'react';
import { View } from 'react-native';
import { FileText, Scale } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/lib/legal-urls';
import { openExternalWebUrl } from '@/lib/open-external-url';
import { createLogger } from '@/lib/logger';

const legalLog = createLogger('legal');

export function LegalSettings() {
  const [opening, setOpening] = React.useState<'privacy' | 'terms' | null>(null);

  const openUrl = async (kind: 'privacy' | 'terms') => {
    const url = kind === 'privacy' ? getPrivacyPolicyUrl() : getTermsOfServiceUrl();
    setOpening(kind);
    try {
      await openExternalWebUrl(url);
    } catch (err) {
      legalLog.error('legal.open.failed', { kind, url }, err);
    } finally {
      setOpening(null);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>
          <Text>Legal</Text>
        </CardTitle>
        <CardDescription>
          <Text className="text-muted-foreground">Privacy policy and terms of service</Text>
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-2">
        <Button
          variant="outline"
          className="flex-row items-center justify-start gap-2"
          disabled={opening !== null}
          onPress={() => void openUrl('privacy')}>
          <Icon as={FileText} size={18} className="text-foreground" />
          <Text className="text-sm font-medium text-foreground">
            {opening === 'privacy' ? 'Opening…' : 'Privacy Policy'}
          </Text>
        </Button>
        <Button
          variant="outline"
          className="flex-row items-center justify-start gap-2"
          disabled={opening !== null}
          onPress={() => void openUrl('terms')}>
          <Icon as={Scale} size={18} className="text-foreground" />
          <Text className="text-sm font-medium text-foreground">
            {opening === 'terms' ? 'Opening…' : 'Terms of Service'}
          </Text>
        </Button>
      </CardContent>
    </Card>
  );
}
