
'use client';

import React, { useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Settings, LogOut, LifeBuoy, Loader2, BookOpen } from 'lucide-react';
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
import {
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Skeleton } from '../ui/skeleton';
import { ThemeToggle } from './theme-toggle';
import { TokenUsageToolbar } from './token-usage-toolbar';
import { SupportDialog } from '@/components/support/support-dialog';
import { AssetMemBrandIcon } from '@/components/brand/asset-mem-brand-icon';
import { getUserDisplayLabel } from '@/lib/user-display';
import { HeaderIconTooltip } from './header-icon-tooltip';
import { buildSettingsHref, resolveHeaderReturnContext } from '@/lib/settings-navigation';

export function Header() {
  const { user, loading, signingOut, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [supportOpen, setSupportOpen] = React.useState(false);
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
    <header className="sticky top-0 z-30 flex h-14 min-h-14 items-center justify-between gap-3 border-b bg-background px-3 sm:gap-4 sm:px-6">
      <div className="flex min-w-0 shrink items-center gap-2">
        <AssetMemBrandIcon size="sm" />
        <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">AssetMem AI</h1>
      </div>
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-2">
         {loading || signingOut ? (
            <Skeleton className='h-8 w-32' />
         ) : user ? (
            <TooltipProvider delayDuration={300}>
                <ThemeToggle />
                <HeaderIconTooltip label="Notifications">
                  <NotificationsBell />
                </HeaderIconTooltip>
                <TokenUsageToolbar settingsReturnContext={returnContext} />
                <HeaderIconTooltip label="FAQ & guides">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
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
                    className="h-9 w-9"
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
                      variant="outline"
                      className="flex h-9 items-center gap-2"
                      aria-label="Account menu"
                    >
                      <UserProfileAvatar user={user} className="h-6 w-6" />
                      <span className="hidden sm:inline-block truncate max-w-[12rem]">
                        {getUserDisplayLabel(user)}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                </HeaderIconTooltip>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push(buildSettingsHref(undefined, returnContext))}>
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
    </header>
  );
}
