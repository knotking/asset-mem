'use client';

import * as React from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { useNotifications } from '@homeapp/common/hooks/use-notifications';
import {
  formatDeletionErrorMessage,
  propertyDeleteFailedBody,
  propertyDeleteFailedTitle,
  propertyRemovedToast,
} from '@homeapp/common/lib/deletion';

function notificationTitle(type: string, propertyName?: string): string {
  if (type === 'property_deletion_failed') return propertyDeleteFailedTitle;
  if (type === 'property_deletion_completed') {
    return propertyRemovedToast(propertyName ?? 'Property');
  }
  return 'Notification';
}

function notificationBody(
  type: string,
  propertyName?: string,
  deletionError?: string
): string {
  if (type === 'property_deletion_failed') {
    return propertyDeleteFailedBody(
      propertyName ?? 'Property',
      deletionError ? formatDeletionErrorMessage(deletionError) : undefined
    );
  }
  if (type === 'property_deletion_completed') {
    return propertyName ? `"${propertyName}" and its data were removed.` : 'Property removed.';
  }
  return '';
}

export function NotificationsBell() {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    unreadActionCount,
    dismissNotification,
    markAllNotificationsRead,
  } = useNotifications(db, user?.uid);
  const [open, setOpen] = React.useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      void markAllNotificationsRead();
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span
              className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-primary-foreground ${
                unreadActionCount > 0 ? 'bg-destructive' : 'bg-primary'
              }`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-sm font-semibold">Notifications</div>
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-2 border-b px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {notificationTitle(n.type, n.propertyName)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {notificationBody(n.type, n.propertyName, n.deletionError)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label="Dismiss notification"
                  onClick={() => void dismissNotification(n.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
