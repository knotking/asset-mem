import * as React from 'react';
import {
  DEFAULT_SUPPORT_EMAIL,
  getEnterpriseConfigFromEnv,
} from '@/lib/enterprise-config';
import { fetchLandingRemoteConfig } from '@/lib/landing-remote-config';

/** Env defaults first, then Firebase Remote Config `support_email`. */
export function useSupportEmail(): string {
  const [email, setEmail] = React.useState(
    () => getEnterpriseConfigFromEnv().supportEmail || DEFAULT_SUPPORT_EMAIL,
  );

  React.useEffect(() => {
    let cancelled = false;
    void fetchLandingRemoteConfig().then((remote) => {
      if (cancelled) return;
      setEmail(remote.enterprise.supportEmail?.trim() || DEFAULT_SUPPORT_EMAIL);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return email;
}
