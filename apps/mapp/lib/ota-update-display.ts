/** First 8 characters of an Expo Updates `updateId` (UUID prefix). */
export function otaUpdateShortId(updateId: string | null | undefined): string | null {
  const trimmed = updateId?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 8);
}
