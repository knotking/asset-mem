import * as React from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, X } from 'lucide-react-native';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useFirebase } from '@homeapp/common/contexts/firebase-context';
import { useNotifications } from '@homeapp/common/hooks/use-notifications';
import {
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
    return propertyDeleteFailedBody(propertyName ?? 'Property', deletionError);
  }
  if (type === 'property_deletion_completed') {
    return propertyName ? `"${propertyName}" and its data were removed.` : 'Property removed.';
  }
  return '';
}

export function NotificationsBell() {
  const { user } = useAuth();
  const { db } = useFirebase();
  const {
    notifications,
    unreadCount,
    unreadActionCount,
    dismissNotification,
    markAllNotificationsRead,
  } = useNotifications(db, user?.uid);

  if (!user) return null;

  return (
    <Popover
      onOpenChange={(next) => {
        if (next) void markAllNotificationsRead();
      }}>
      <View className="relative">
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 min-w-8 p-0"
            accessibilityLabel={
              unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
            }>
            <Icon as={Bell} size={20} className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        {unreadCount > 0 ? (
          <View
            pointerEvents="none"
            className={`absolute -right-1 -top-1 min-w-[18px] rounded-full px-1 py-0.5 ${
              unreadActionCount > 0 ? 'bg-destructive' : 'bg-primary'
            }`}>
            <Text
              className="text-center text-[10px] font-semibold leading-none text-primary-foreground"
              allowFontScaling={false}
              numberOfLines={1}>
              {unreadCount > 9 ? '9+' : String(unreadCount)}
            </Text>
          </View>
        ) : null}
      </View>
      <PopoverContent align="end" className="w-80 p-0">
        <View className="border-b border-border px-3 py-2">
          <Text className="text-sm font-semibold text-foreground">Notifications</Text>
        </View>
        {notifications.length === 0 ? (
          <View className="px-3 py-6">
            <Text className="text-center text-sm text-muted-foreground">No notifications</Text>
          </View>
        ) : (
          <ScrollView className="max-h-72">
            {notifications.map((n) => (
              <View key={n.id} className="border-b border-border px-3 py-3">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">
                      {notificationTitle(n.type, n.propertyName)}
                    </Text>
                    <Text className="mt-1 text-xs text-muted-foreground">
                      {notificationBody(n.type, n.propertyName, n.deletionError)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void dismissNotification(n.id)}
                    accessibilityLabel="Dismiss notification">
                    <Icon as={X} size={16} className="text-muted-foreground" />
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </PopoverContent>
    </Popover>
  );
}
