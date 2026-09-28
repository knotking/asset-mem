import { auth } from '@asset-mem/common/firebase';
import type { GetFirebaseIdToken } from '@asset-mem/common/lib/correlation-id';

export const getFirebaseIdTokenForProxy: GetFirebaseIdToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return user.getIdToken();
};
