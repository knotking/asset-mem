/**
 * Mirrored from @homeapp/common — webapp cannot import common (App Hosting).
 */
const TRUTHY_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

/** Parse build-time or runtime env flags (`NEXT_PUBLIC_*`, etc.). */
export function parseFeatureFlagEnv(
  value: string | boolean | undefined | null
): boolean {
  if (typeof value === "boolean") return value;
  if (value == null || value === "") return false;
  return TRUTHY_ENV_VALUES.has(String(value).trim().toLowerCase());
}
