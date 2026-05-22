import type { User } from 'firebase/auth';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getUserInitials } from '@homeapp/common/lib/user-display';

type UserProfileAvatarProps = {
  user: Pick<User, 'displayName' | 'email' | 'photoURL'>;
  className?: string;
  fallbackTextClassName?: string;
};

export function UserProfileAvatar({
  user,
  className,
  fallbackTextClassName,
}: UserProfileAvatarProps) {
  const photoURL = user.photoURL?.trim();

  return (
    <Avatar className={cn('size-16', className)}>
      {photoURL ? <AvatarImage source={{ uri: photoURL }} /> : null}
      <AvatarFallback>
        <Text
          className={cn('text-xl font-semibold text-secondary-foreground', fallbackTextClassName)}>
          {getUserInitials(user)}
        </Text>
      </AvatarFallback>
    </Avatar>
  );
}
