/**
 * Mirrored from @asset-mem/common — webapp cannot import common (App Hosting).
 * Keep in sync with apps/common/src/hooks/use-notifications.ts
 */
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';

export type UserNotification = {
  id: string;
  type: string;
  propertyId?: string;
  propertyName?: string;
  jobId?: string;
  deletionError?: string;
  actionRequired: boolean;
  read: boolean;
  dismissed: boolean;
};

export function useNotifications(db: Firestore | null, userId: string | undefined) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'users', userId, 'notifications'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: UserNotification[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              type: String(data.type ?? ''),
              propertyId: data.propertyId as string | undefined,
              propertyName: data.propertyName as string | undefined,
              jobId: data.jobId as string | undefined,
              deletionError: data.deletionError as string | undefined,
              actionRequired: Boolean(data.actionRequired),
              read: Boolean(data.read),
              dismissed: Boolean(data.dismissed),
            };
          })
          .filter((n) => !n.dismissed);
        setNotifications(items);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [db, userId]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const unreadActionCount = useMemo(
    () => notifications.filter((n) => n.actionRequired && !n.read).length,
    [notifications]
  );

  const dismissNotification = async (notificationId: string) => {
    if (!db || !userId) return;
    await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), {
      dismissed: true,
      read: true,
    });
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!db || !userId) return;
    await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), {
      read: true,
    });
  };

  const markAllNotificationsRead = async () => {
    if (!db || !userId) return;
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) =>
        updateDoc(doc(db, 'users', userId, 'notifications', n.id), { read: true })
      )
    );
  };

  return {
    notifications,
    loading,
    unreadCount,
    unreadActionCount,
    dismissNotification,
    markNotificationRead,
    markAllNotificationsRead,
  };
}
