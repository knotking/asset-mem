/** UI-only hint that a Firebase session likely exists (not used for authorization). */
export const AUTH_HINT_STORAGE_KEY = 'assetmem_auth_hint';

export function readAuthHint(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(AUTH_HINT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAuthHint(active: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (active) {
      window.localStorage.setItem(AUTH_HINT_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(AUTH_HINT_STORAGE_KEY);
    }
  } catch {
    // Private browsing / blocked storage — landing falls back to Firebase auth state.
  }
}

export function clearAuthHint(): void {
  setAuthHint(false);
}
