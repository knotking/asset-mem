'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  DEFAULT_SUPPORT_EMAIL,
  getEnterpriseConfigFromEnv,
} from '@/lib/enterprise-config';
import { fetchLandingRemoteConfig } from '@/lib/landing-demo-video';

const SupportEmailContext = createContext(DEFAULT_SUPPORT_EMAIL);

export function LegalSupportEmailProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [email, setEmail] = useState(
    () => getEnterpriseConfigFromEnv().supportEmail || DEFAULT_SUPPORT_EMAIL,
  );

  useEffect(() => {
    let cancelled = false;
    void fetchLandingRemoteConfig().then((remote) => {
      if (cancelled) return;
      const next = remote.enterprise.supportEmail?.trim() || DEFAULT_SUPPORT_EMAIL;
      setEmail(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SupportEmailContext.Provider value={email}>{children}</SupportEmailContext.Provider>
  );
}

export function useLegalSupportEmail(): string {
  return useContext(SupportEmailContext);
}

type SupportEmailLinkProps = {
  className?: string;
};

export function SupportEmailLink({ className }: SupportEmailLinkProps) {
  const email = useLegalSupportEmail();
  return (
    <a href={`mailto:${email}`} className={className}>
      {email}
    </a>
  );
}
