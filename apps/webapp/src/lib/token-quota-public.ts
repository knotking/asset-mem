/**
 * Fallback when the proxy `/token-quota-status` call has not succeeded yet or fails (offline).
 * Authoritative default is `TOKEN_QUOTA_PERIOD_MAX_TOKENS` on the proxy; optional
 * NEXT_PUBLIC_TOKEN_QUOTA_PERIOD_MAX_TOKENS mirrors it for UI fallback only.
 * Firestore users/{uid}/preferences/user.monthlyTokenLimit overrides when set.
 */
export function getPublicDefaultMonthlyTokenLimit(): number | null {
  const raw = process.env.NEXT_PUBLIC_TOKEN_QUOTA_PERIOD_MAX_TOKENS;
  if (raw == null || String(raw).trim() === '') {
    return null;
  }
  const n = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}
