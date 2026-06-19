/** Truncate long property names for narrow mobile headers; full value stays in `title`. */
export function displayPropertyName(
  name: string | undefined,
  maxLength = 28,
): string {
  const value = name?.trim() || 'New Property';
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}
