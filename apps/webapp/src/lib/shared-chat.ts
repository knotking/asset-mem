/**
 * Shared chat helpers — local copy for App Hosting (webapp does not depend on @homeapp/common).
 * Keep in sync with apps/common/src/lib/shared-chat.ts.
 */
import {
  Timestamp,
  doc,
  getDocs,
  query,
  writeBatch,
  type CollectionReference,
  type Firestore,
} from "firebase/firestore";

/** Default lifetime for a public shared chat link. */
export const SHARED_CHAT_TTL_DAYS = 30;

/** Firestore batch write limit is 500; stay under for headroom. */
const FIRESTORE_BATCH_SIZE = 450;

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

/** Normalize a chat message for the public sharedChats/messages subcollection. */
export function serializeSharedChatMessage(
  data: Record<string, unknown>
): Record<string, unknown> {
  const createdAt = data.createdAt;
  let createdAtIso: string;
  if (createdAt instanceof Timestamp) {
    createdAtIso = createdAt.toDate().toISOString();
  } else if (typeof createdAt === "string") {
    createdAtIso = createdAt;
  } else if (createdAt instanceof Date) {
    createdAtIso = createdAt.toISOString();
  } else {
    createdAtIso = new Date().toISOString();
  }
  return JSON.parse(JSON.stringify({ ...data, createdAt: createdAtIso }));
}

/** Delete all docs in a collection using chunked batches (handles >500 docs). */
export async function deleteAllInCollection(
  db: Firestore,
  collectionRef: CollectionReference
): Promise<void> {
  const snap = await getDocs(query(collectionRef));
  for (let i = 0; i < snap.docs.length; i += FIRESTORE_BATCH_SIZE) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + FIRESTORE_BATCH_SIZE).forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  }
}

/** Write shared chat message snapshots in chunked batches. */
export async function writeSharedChatMessages(
  db: Firestore,
  sharedMessagesRef: CollectionReference,
  rawMessages: Record<string, unknown>[]
): Promise<void> {
  const messages = rawMessages.map(serializeSharedChatMessage);
  for (let i = 0; i < messages.length; i += FIRESTORE_BATCH_SIZE) {
    const batch = writeBatch(db);
    messages.slice(i, i + FIRESTORE_BATCH_SIZE).forEach((message) => {
      batch.set(doc(sharedMessagesRef), message);
    });
    await batch.commit();
  }
}
