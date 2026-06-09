import { Timestamp } from 'firebase/firestore';

/** Default lifetime for a public shared report PDF link. */
export const SHARED_REPORT_TTL_DAYS = 30;

export type SharedReportDoc = {
  originalUserId: string;
  originalPropertyId: string;
  originalReportId: string;
  title?: string;
  revision?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  expiresAt?: Timestamp;
};

export function sharedReportExpiresAtFromNow(
  days: number = SHARED_REPORT_TTL_DAYS
): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return Timestamp.fromDate(d);
}

export function isSharedReportExpired(
  expiresAt: Timestamp | Date | string | null | undefined
): boolean {
  if (expiresAt == null) {
    return false;
  }
  const ms =
    expiresAt instanceof Timestamp
      ? expiresAt.toMillis()
      : typeof expiresAt === 'string'
        ? new Date(expiresAt).getTime()
        : expiresAt.getTime();
  return Number.isFinite(ms) && Date.now() > ms;
}

export function buildSharedReportPath(shareId: string): string {
  return `/share/report/${shareId}`;
}
