/**
 * Shared chat helpers — local copy for App Hosting (webapp does not depend on @homeapp/common).
 * Keep in sync with apps/common/src/lib/shared-chat.ts.
 */
import { Timestamp } from "firebase/firestore";

/** Default lifetime for a public shared chat link. */
export const SHARED_CHAT_TTL_DAYS = 30;

export type SharedChatDoc = {
  originalUserId: string;
  originalSessionId: string;
  name?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  propertyId?: string | null;
  /** When set, public reads should be denied after this time. */
  expiresAt?: Timestamp;
};

export function sharedChatExpiresAtFromNow(
  days: number = SHARED_CHAT_TTL_DAYS
): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return Timestamp.fromDate(d);
}

export function isSharedChatExpired(
  expiresAt: Timestamp | Date | string | null | undefined
): boolean {
  if (expiresAt == null) {
    return false;
  }
  const ms =
    expiresAt instanceof Timestamp
      ? expiresAt.toMillis()
      : typeof expiresAt === "string"
        ? new Date(expiresAt).getTime()
        : expiresAt.getTime();
  return Number.isFinite(ms) && Date.now() > ms;
}
