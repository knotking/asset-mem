/** Uppercase the first character for checkpoint overall-condition display. Keep in sync with @homeapp/common/lib/checkpoint-summary-display (mapp). */
export function formatCheckpointOverallCondition(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
