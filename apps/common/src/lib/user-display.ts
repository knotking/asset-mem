import type { User } from 'firebase/auth';

export const DISPLAY_NAME_MAX_LENGTH = 64;

/** Shown in profile when the user has not set a display name. */
export const DISPLAY_NAME_PLACEHOLDER = 'Add your name';

/** Last-resort label when there is no display name and no email. */
export const DISPLAY_NAME_ACCOUNT_FALLBACK = 'Your account';

/** @deprecated Use DISPLAY_NAME_PLACEHOLDER; kept for input placeholders in legacy call sites. */
export const DEFAULT_DISPLAY_LABEL = DISPLAY_NAME_PLACEHOLDER;

export type UserLike = Pick<User, 'displayName' | 'email'> | null | undefined;

export type UserDisplayPresentation = {
  label: string;
  /** True when Firebase displayName is not set (label may be inferred from email). */
  isUnset: boolean;
  source: 'displayName' | 'email' | 'fallback';
};

export function hasSavedDisplayName(displayName: string | null | undefined): boolean {
  return Boolean(displayName?.trim());
}

/** e.g. jane.doe@x.com → "Jane Doe" */
export function displayNameFromEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  if (!trimmed || !trimmed.includes('@')) return null;

  const local = (trimmed.split('@')[0] ?? '').trim();
  if (!local) return null;

  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) return null;

  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function getUserDisplayPresentation(user: UserLike): UserDisplayPresentation {
  const saved = user?.displayName?.trim();
  if (saved) {
    return { label: saved, isUnset: false, source: 'displayName' };
  }

  const fromEmail = displayNameFromEmail(user?.email);
  if (fromEmail) {
    return { label: fromEmail, isUnset: true, source: 'email' };
  }

  return {
    label: DISPLAY_NAME_PLACEHOLDER,
    isUnset: true,
    source: 'fallback',
  };
}

/** Compact label for headers, settings rows, and menus (never shows the profile placeholder). */
export function getUserDisplayLabel(
  displayNameOrUser: string | null | undefined | UserLike,
  email?: string | null,
): string {
  const user: UserLike =
    typeof displayNameOrUser === 'object' && displayNameOrUser !== null
      ? displayNameOrUser
      : { displayName: displayNameOrUser ?? null, email: email ?? null };

  const presentation = getUserDisplayPresentation(user);
  if (!presentation.isUnset) {
    return presentation.label;
  }

  if (presentation.source === 'email') {
    return presentation.label;
  }

  const mail = user?.email?.trim();
  if (mail) {
    return mail;
  }

  return DISPLAY_NAME_ACCOUNT_FALLBACK;
}

/** Profile row: prompts to add a name when unset. */
export function getProfileDisplayPresentation(user: UserLike): UserDisplayPresentation {
  if (hasSavedDisplayName(user?.displayName)) {
    return getUserDisplayPresentation(user);
  }

  return {
    label: DISPLAY_NAME_PLACEHOLDER,
    isUnset: true,
    source: user?.email?.trim() ? 'email' : 'fallback',
  };
}

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
  const label = getUserDisplayLabel(user);
  return label === DISPLAY_NAME_ACCOUNT_FALLBACK ? 'Profile' : label;
}
