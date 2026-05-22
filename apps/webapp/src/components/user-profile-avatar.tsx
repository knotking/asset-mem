'use client';

import type { User } from 'firebase/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getUserAvatarAlt, getUserInitials } from '@/lib/user-display';

type UserProfileAvatarProps = {
  user: Pick<User, 'displayName' | 'email' | 'photoURL'>;
  className?: string;
  fallbackClassName?: string;
};

export function UserProfileAvatar({
  user,
  className,
  fallbackClassName,
}: UserProfileAvatarProps) {
  const photoURL = user.photoURL?.trim();

  return (
    <Avatar className={className}>
      {photoURL ? (
        <AvatarImage src={photoURL} alt={getUserAvatarAlt(user)} referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback className={cn('text-xs', fallbackClassName)}>
        {getUserInitials(user)}
      </AvatarFallback>
    </Avatar>
  );
}
