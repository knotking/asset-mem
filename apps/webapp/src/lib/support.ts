/**
 * Support helpers — local copy for App Hosting (webapp does not depend on @homeapp/common).
 * Keep in sync with apps/common/src/lib/support.ts.
 */

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';

/** Top-level collection (same pattern as `llm_token_usage`). */
export const SUPPORT_REQUESTS_COLLECTION = 'support_requests';

/** Per-user support messages (`support_requests/{userId}/messages/{messageId}`). */
export const SUPPORT_REQUESTS_MESSAGES_SUBCOLLECTION = 'messages';

export const DEFAULT_SUPPORT_EMAIL = 'support@asset-mem.com';

export const SUPPORT_MESSAGE_MAX_LENGTH = 5000;

export type SupportRequestApp = 'web' | 'mobile';

export type SupportRequestContext = {
  userId?: string | null;
  userEmail?: string | null;
  app?: SupportRequestApp;
  appEnv?: string | null;
};

export type SupportRequestInput = {
  message: string;
  userEmail?: string | null;
  app: SupportRequestApp;
  appEnv?: string | null;
};

/** Persists a support message under support_requests/{userId}/messages. */
export async function submitSupportRequest(
  db: Firestore,
  userId: string,
  input: SupportRequestInput
): Promise<string> {
  const trimmed = input.message.trim();
  if (!trimmed) {
    throw new Error('Message is required');
  }
  if (trimmed.length > SUPPORT_MESSAGE_MAX_LENGTH) {
    throw new Error(
      `Message must be at most ${SUPPORT_MESSAGE_MAX_LENGTH} characters`
    );
  }
  if (!userId) {
    throw new Error('You must be signed in to contact support');
  }

  await setDoc(
    doc(db, SUPPORT_REQUESTS_COLLECTION, userId),
    {
      userEmail: input.userEmail ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const docRef = await addDoc(
    collection(
      db,
      SUPPORT_REQUESTS_COLLECTION,
      userId,
      SUPPORT_REQUESTS_MESSAGES_SUBCOLLECTION
    ),
    {
      message: trimmed,
      userEmail: input.userEmail ?? null,
      app: input.app,
      appEnv: input.appEnv ?? null,
      status: 'open',
      createdAt: serverTimestamp(),
    }
  );
  return docRef.id;
}

/** Builds a mailto URL with subject and body (user message + account context). */
export function buildSupportMailtoUrl(
  supportEmail: string,
  message: string,
  ctx: SupportRequestContext = {}
): string {
  const trimmed = message.trim();
  const subject = encodeURIComponent('AssetMem AI support request');
  const bodyLines = [
    trimmed,
    '',
    '---',
    ctx.userEmail ? `Account: ${ctx.userEmail}` : null,
    ctx.userId ? `User ID: ${ctx.userId}` : null,
    ctx.app ? `App: ${ctx.app}` : null,
    ctx.appEnv ? `Environment: ${ctx.appEnv}` : null,
  ].filter((line): line is string => line != null && line.length > 0);
  const body = encodeURIComponent(bodyLines.join('\n'));
  const email = supportEmail.trim() || DEFAULT_SUPPORT_EMAIL;
  return `mailto:${email}?subject=${subject}&body=${body}`;
}
