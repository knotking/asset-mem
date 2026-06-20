'use client';

import React, { useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, LifeBuoy, Loader2, LogOut, Settings } from 'lucide-react';
import { NotificationsBell } from '@/components/layout/notifications-bell';
import { Button } from '@/components/ui/button';
import { UserProfileAvatar } from '@/components/user-profile-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { TokenUsageToolbar } from '@/components/layout/token-usage-toolbar';
import { SupportDialog } from '@/components/support/support-dialog';
import { HeaderIconTooltip } from '@/components/layout/header-icon-tooltip';
import { getUserDisplayLabel } from '@/lib/user-display';
import { buildSettingsHref, resolveHeaderReturnContext } from '@/lib/settings-navigation';
import { cn } from '@/lib/utils';

type HeaderToolbarActionsProps = {
  className?: string;
  /** Icon-only account trigger (property shell mobile toolbar). */
  compactAccount?: boolean;
  /** When false, hide the AI usage control below `md` (property shell mobile header). */
  showMobileTokenUsage?: boolean;
  /** When false, hide light/dark toggle (e.g. property shell mobile — usage ring instead). */
  showThemeToggle?: boolean;
  /** When false, hide notifications bell (e.g. property shell mobile). */
  showNotificationsBell?: boolean;
};

export function HeaderToolbarActions({
  className,
  compactAccount = false,
  showMobileTokenUsage = true,
  showThemeToggle = true,
  showNotificationsBell = true,
}: HeaderToolbarActionsProps) {
  const { user, loading, signingOut, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [supportOpen, setSupportOpen] = React.useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const returnContext = resolveHeaderReturnContext(pathname);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      toast({
        variant: 'destructive',
        title: 'Logout Failed',
        description: 'An error occurred while signing out.',
      });
    }
  }, [logout, toast]);

  return (
    <div
      ref={anchorRef}
      className={cn(
        'relative flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-2',
        className,
      )}
    >
      {loading || signingOut ? (
        <Skeleton className="h-8 w-8 rounded-full sm:w-32" />
      ) : user ? (
        <TooltipProvider delayDuration={300}>
          {showThemeToggle ? <ThemeToggle /> : null}
          {showNotificationsBell ? (
            <NotificationsBell anchorRef={anchorRef} />
          ) : null}
          {showMobileTokenUsage ? (
            <TokenUsageToolbar settingsReturnContext={returnContext} />
          ) : (
            <span className="hidden md:contents">
              <TokenUsageToolbar settingsReturnContext={returnContext} />
            </span>
          )}
          <HeaderIconTooltip label="FAQ & guides">
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 md:inline-flex"
              onClick={() => router.push(buildSettingsHref('faq', returnContext))}
              aria-label="FAQ & guides"
            >
              <BookOpen className="h-4 w-4" />
            </Button>
          </HeaderIconTooltip>
          <HeaderIconTooltip label="Settings">
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 md:inline-flex"
              onClick={() => router.push(buildSettingsHref(undefined, returnContext))}
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </HeaderIconTooltip>

          <DropdownMenu>
            <HeaderIconTooltip label="Account">
              <DropdownMenuTrigger asChild>
                <Button
                  variant={compactAccount ? 'ghost' : 'outline'}
                  size={compactAccount ? 'icon' : 'default'}
                  className={cn(
                    compactAccount
                      ? 'h-9 w-9 shrink-0'
                      : 'flex h-9 items-center gap-2 px-2 sm:px-3',
                  )}
                  aria-label="Account menu"
                >
                  <UserProfileAvatar user={user} className="h-6 w-6" />
                  {!compactAccount ? (
                    <span className="hidden sm:inline-block truncate max-w-[12rem]">
                      {getUserDisplayLabel(user)}
                    </span>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
            </HeaderIconTooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="md:hidden"
                onClick={() => router.push(buildSettingsHref('faq', returnContext))}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                <span>FAQ & guides</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(buildSettingsHref(undefined, returnContext))}
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSupportOpen(true)}>
                <LifeBuoy className="mr-2 h-4 w-4" />
                <span>Support</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} disabled={signingOut}>
                {signingOut ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                <span>{signingOut ? 'Signing out…' : 'Log out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
        </TooltipProvider>
      ) : (
        <Button onClick={() => router.push('/login')}>Sign In</Button>
      )}
    </div>
  );
}
