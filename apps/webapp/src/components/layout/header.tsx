
'use client';

import React, { useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Bot, Bell, Settings, LogOut } from 'lucide-react';
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

export function Header() {
  const { user, auth, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Logout Failed',
        description: 'An error occurred while signing out.',
      });
    }
  }, [auth, router, toast]);
  
  const getUserInitials = () => {
      if (!user?.email) return '..';
      const parts = user.email.split('@')[0].split(/[._-]/);
      if (parts.length > 1) {
          return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return user.email.substring(0,2).toUpperCase();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
       <div className="flex items-center gap-2">
            <Bot className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-bold text-foreground">HomeGeek AI</h1>
       </div>
      <div className="flex items-center gap-2">
         {loading ? (
            <Skeleton className='h-8 w-32' />
         ) : user ? (
            <>
                <ThemeToggle />
                <Button variant="ghost" size="icon" className='h-9 w-9'>
                    <Bell className="h-4 w-4" />
                    <span className="sr-only">Notifications</span>
                </Button>
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
                    <DropdownMenuItem>Support</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            </>
         ) : (
             <Button onClick={() => router.push('/login')}>Sign In</Button>
         )}
      </div>
    </header>
  );
}
