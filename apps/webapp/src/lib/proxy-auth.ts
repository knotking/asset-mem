import { auth } from '@/lib/firebase';
import type { GetFirebaseIdToken } from '@/lib/correlation-id';

/** Returns the current user's Firebase ID token for proxy Bearer auth. */
export const getFirebaseIdTokenForProxy: GetFirebaseIdToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return user.getIdToken();
};
