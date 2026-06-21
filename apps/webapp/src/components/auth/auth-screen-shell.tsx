'use client';

import Link from 'next/link';
import { AssetMemWordmark } from '@/components/brand/asset-mem-wordmark';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type AuthScreenShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
};

export function AuthScreenShell({
  title,
  description,
  children,
  className,
}: AuthScreenShellProps) {
  return (
    <div
      className={cn(
        'flex min-h-dvh w-full flex-col items-center justify-center bg-background px-4 py-8',
        className,
      )}
    >
      <div className="mb-6 flex w-full max-w-sm flex-col items-center text-center">
        <Link
          href="/"
          className="mb-5 inline-flex rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="AssetMem AI home"
        >
          <AssetMemWordmark size="auth" tone="app" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">{children}</CardContent>
      </Card>
    </div>
  );
}
