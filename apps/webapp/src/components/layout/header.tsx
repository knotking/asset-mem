
'use client';

import React, { useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Bot, Bell, Settings, LogOut, LifeBuoy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '../ui/skeleton';
import { ThemeToggle } from './theme-toggle';
import { TokenUsageToolbar } from './token-usage-toolbar';
import { SupportDialog } from '@/components/support/support-dialog';

export function Header() {
  const { user, loading, signingOut, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [supportOpen, setSupportOpen] = React.useState(false);

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
  
  const getUserInitials = () => {
      if (!user?.email) return '..';
      const parts = user.email.split('@')[0].split(/[._-]/);
      if (parts.length > 1) {
          return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return user.email.substring(0,2).toUpperCase();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 min-h-14 items-center justify-between gap-3 border-b bg-background px-3 sm:gap-4 sm:px-6">
      <div className="flex min-w-0 shrink items-center gap-2">
        <Bot className="h-7 w-7 shrink-0 text-primary" />
        <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">AssetMem AI</h1>
      </div>
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-2">
         {loading || signingOut ? (
            <Skeleton className='h-8 w-32' />
         ) : user ? (
            <>
                <ThemeToggle />
                <Button variant="ghost" size="icon" className='h-9 w-9'>
                    <Bell className="h-4 w-4" />
                    <span className="sr-only">Notifications</span>
                </Button>
                <TokenUsageToolbar />
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className='h-9 w-9'
                    onClick={() => router.push('/home/settings')}
                >
                    <Settings className="h-4 w-4" />
                    <span className="sr-only">Settings</span>
                </Button>

                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2 h-9">
                        <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                                {getUserInitials()}
                            </AvatarFallback>
                        </Avatar>
                        <span className="hidden sm:inline-block">{user.displayName || user.email}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/home/settings')}>
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
            </>
         ) : (
             <Button onClick={() => router.push('/login')}>Sign In</Button>
         )}
      </div>
    </header>
  );
}
