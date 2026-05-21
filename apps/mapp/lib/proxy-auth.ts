import { auth } from '@homeapp/common/firebase';
import type { GetFirebaseIdToken } from '@homeapp/common/lib/correlation-id';

export const getFirebaseIdTokenForProxy: GetFirebaseIdToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return user.getIdToken();
};
