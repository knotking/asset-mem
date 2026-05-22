import type { User } from 'firebase/auth';

export const DISPLAY_NAME_MAX_LENGTH = 64;
export const DEFAULT_DISPLAY_LABEL = 'Property Owner';

type UserLike = Pick<User, 'displayName' | 'email'> | null | undefined;

/** Initials for avatar fallback: display name first, then email local-part. */
export function getUserInitials(user: UserLike): string {
  if (!user) return '??';

  const displayName = user.displayName?.trim();
  if (displayName) {
    const names = displayName.split(/\s+/).filter(Boolean);
    if (names.length > 0) {
      return names
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 3);
    }
  }

  const email = user.email?.trim();
  if (email) {
    const local = email.split('@')[0] ?? '';
    const parts = local.split(/[._-]/).filter(Boolean);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return local.substring(0, 2).toUpperCase();
  }

  return '??';
}

export function getUserAvatarAlt(user: UserLike): string {
  if (!user) return 'Profile';
  return user.displayName?.trim() || user.email?.trim() || 'Profile';
}

export function getUserDisplayLabel(displayName: string | null | undefined): string {
  const trimmed = displayName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_DISPLAY_LABEL;
}
