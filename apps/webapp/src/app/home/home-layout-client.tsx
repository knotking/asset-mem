'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { LlmTokenUsageProvider } from '@/contexts/llm-token-usage-context';
import { PropertiesDashboardProvider } from '@/contexts/properties-dashboard-context';
import { cn } from '@/lib/utils';

function isPropertyShellRoute(pathname: string | null): boolean {
  return Boolean(pathname?.match(/^\/home\/properties\/[^/]+(\/|$)/));
}

export default function HomeLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const propertyShellRoute = isPropertyShellRoute(pathname);

  return (
    <div className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-background">
      <LlmTokenUsageProvider>
        <PropertiesDashboardProvider>
          <Header />
          <main
            className={cn(
              'min-h-0 flex-1 overscroll-y-contain',
              propertyShellRoute
                ? 'flex flex-col overflow-hidden'
                : 'overflow-y-auto',
            )}
          >
            {children}
          </main>
        </PropertiesDashboardProvider>
      </LlmTokenUsageProvider>
    </div>
  );
}
