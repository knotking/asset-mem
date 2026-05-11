import { doc, onSnapshot } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

/**
 * Resolves when `users/{userId}/docs/{docId}` reaches `status` complete or failed
 * (as written by the document-analysis worker).
 */
export function waitForUserDocAnalysis(
  db: Firestore,
  userId: string,
  docId: string,
  options?: { timeoutMs?: number }
): Promise<Record<string, unknown>> {
  const timeoutMs = options?.timeoutMs ?? 180_000;
  const ref = doc(db, "users", userId, "docs", docId);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error("Document analysis timed out"));
    }, timeoutMs);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as Record<string, unknown> | undefined;
        const status = data?.status as string | undefined;
        if (status === "complete" || status === "failed") {
          clearTimeout(timer);
          unsub();
          resolve(data ?? {});
        }
      },
      (err) => {
        clearTimeout(timer);
        unsub();
        reject(err);
      }
    );
  });
}
