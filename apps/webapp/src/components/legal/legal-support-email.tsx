'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_SUPPORT_EMAIL } from '@/lib/enterprise-config';
import { useSupportEmail } from '@/hooks/use-support-email';

const SupportEmailContext = createContext(DEFAULT_SUPPORT_EMAIL);

export function LegalSupportEmailProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const email = useSupportEmail();

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
