import {
  DISPLAY_NAME_ACCOUNT_FALLBACK,
  DISPLAY_NAME_PLACEHOLDER,
  displayNameFromEmail,
  getUserDisplayLabel,
  getUserDisplayPresentation,
  getUserInitials,
  getUserAvatarAlt,
} from '@/lib/user-display';

describe('displayNameFromEmail', () => {
  it('formats local part into a readable name', () => {
    expect(displayNameFromEmail('jane.doe@example.com')).toBe('Jane Doe');
    expect(displayNameFromEmail('bob_smith@corp.io')).toBe('Bob Smith');
  });

  it('returns null for invalid email', () => {
    expect(displayNameFromEmail('')).toBeNull();
    expect(displayNameFromEmail('not-an-email')).toBeNull();
  });
});

describe('getUserDisplayPresentation', () => {
  it('prefers saved display name', () => {
    expect(getUserDisplayPresentation({ displayName: 'Pat Smith', email: 'pat@x.com' })).toEqual({
      label: 'Pat Smith',
      isUnset: false,
      source: 'displayName',
    });
  });

  it('falls back to email-derived name when display name is empty', () => {
    expect(getUserDisplayPresentation({ displayName: '', email: 'jane.doe@example.com' })).toEqual({
      label: 'Jane Doe',
      isUnset: true,
      source: 'email',
    });
  });

  it('uses placeholder when no name or email', () => {
    expect(getUserDisplayPresentation(null)).toEqual({
      label: DISPLAY_NAME_PLACEHOLDER,
      isUnset: true,
      source: 'fallback',
    });
  });
});

describe('getUserDisplayLabel', () => {
  it('returns email-derived label when display name is unset', () => {
    expect(getUserDisplayLabel({ displayName: null, email: 'user@example.com' })).toBe('User');
  });

  it('returns account fallback when nothing is set', () => {
    expect(getUserDisplayLabel(null)).toBe(DISPLAY_NAME_ACCOUNT_FALLBACK);
  });
});

describe('getUserInitials', () => {
  it('uses display name initials', () => {
    expect(getUserInitials({ displayName: 'Pat Smith', email: 'pat@x.com' })).toBe('PS');
  });

  it('uses email local part when display name is missing', () => {
    expect(getUserInitials({ displayName: null, email: 'jane.doe@example.com' })).toBe('JD');
  });

  it('returns ?? when user is null', () => {
    expect(getUserInitials(null)).toBe('??');
  });
});

describe('getUserAvatarAlt', () => {
  it('uses display label for alt text', () => {
    expect(getUserAvatarAlt({ displayName: 'Pat Smith', email: 'pat@x.com' })).toBe('Pat Smith');
  });

  it('falls back to Profile for account fallback label', () => {
    expect(getUserAvatarAlt(null)).toBe('Profile');
  });
});
