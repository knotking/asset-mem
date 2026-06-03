'use client';

import { Header } from '@/components/layout/header';
import { LlmTokenUsageProvider } from '@/contexts/llm-token-usage-context';

export default function HomeLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <LlmTokenUsageProvider>
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </LlmTokenUsageProvider>
    </div>
  );
}
