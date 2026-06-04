'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AssetMemBrandIcon } from '@/components/brand/asset-mem-brand-icon';

type MobileHandoffShellProps = {
  variant: 'loading' | 'error';
  title?: string;
  description?: string;
  errorMessage?: string;
  onRetryLogin?: () => void;
  className?: string;
};

export function MobileHandoffShell({
  variant,
  title,
  description,
  errorMessage,
  onRetryLogin,
  className,
}: MobileHandoffShellProps) {
  const isLoading = variant === 'loading';

  return (
    <div
      className={cn(
        'flex min-h-dvh w-full flex-col items-center justify-center bg-background px-4 py-8',
        className,
      )}
    >
      <Card className="w-full max-w-sm border-border/80 shadow-sm">
        <CardHeader className="items-center space-y-4 pb-2 text-center">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full',
              isLoading ? 'bg-primary/10' : 'bg-destructive/10',
            )}
            aria-hidden
          >
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <AlertCircle className="h-6 w-6 text-destructive" />
            )}
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-xl">
              {title ?? (isLoading ? 'Signing you in' : 'Could not sign in')}
            </CardTitle>
            <CardDescription className="text-center text-sm leading-relaxed">
              {isLoading
                ? (description ??
                  'Linking your mobile account securely. This usually takes a moment.')
                : (errorMessage ??
                  'The sign-in link may have expired. Open billing from the mobile app again.')}
            </CardDescription>
          </div>
        </CardHeader>
        {!isLoading && onRetryLogin ? (
          <CardContent className="flex justify-center pb-6 pt-0">
            <Button type="button" variant="outline" onClick={onRetryLogin}>
              Go to login
            </Button>
          </CardContent>
        ) : (
          <CardContent className="pb-6 pt-0">
            <div
              className="mx-auto flex items-center justify-center gap-2 text-xs text-muted-foreground"
              aria-live="polite"
            >
              <AssetMemBrandIcon size="xs" />
              <span>AssetMem AI</span>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
