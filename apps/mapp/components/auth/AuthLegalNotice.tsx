import * as React from 'react';
import { Text } from '@/components/ui/text';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/lib/legal-urls';
import { openExternalWebUrl } from '@/lib/open-external-url';
import { createLogger } from '@/lib/logger';

const legalLog = createLogger('legal');

export function AuthLegalNotice() {
  const openUrl = async (url: string, kind: 'privacy' | 'terms') => {
    try {
      await openExternalWebUrl(url);
    } catch (err) {
      legalLog.error('auth.legal.open.failed', { kind, url }, err);
    }
  };

  return (
    <Text className="mt-4 text-center text-xs leading-5 text-muted-foreground">
      By creating an account, you agree to our{' '}
      <Text
        className="text-xs text-primary underline"
        accessibilityRole="link"
        onPress={() => void openUrl(getTermsOfServiceUrl(), 'terms')}>
        Terms of Service
      </Text>{' '}
      and{' '}
      <Text
        className="text-xs text-primary underline"
        accessibilityRole="link"
        onPress={() => void openUrl(getPrivacyPolicyUrl(), 'privacy')}>
        Privacy Policy
      </Text>
      .
    </Text>
  );
}
