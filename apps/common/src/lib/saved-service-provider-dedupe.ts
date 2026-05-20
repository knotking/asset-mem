/**
 * Dedupe keys for property-scoped saved service providers.
 * **mapp** imports this module. **webapp** keeps a copy at
 * `apps/webapp/src/lib/saved-service-provider-dedupe.ts` — update both when changing logic.
 */

import type { ServiceProvider } from '../types';

function normalizePart(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Stable key for deduplicating saved providers within a property. */
export function buildServiceProviderDedupeKey(provider: ServiceProvider): string {
  const link = normalizePart(
    provider.link || provider.website || provider.directions || undefined
  );
  if (link) {
    return `link:${link}`;
  }
  const name = normalizePart(provider.name);
  const contact = normalizePart(provider.contact_info);
  return `name:${name}|contact:${contact}`;
}

/** Firestore rejects `undefined` field values; omit those keys before writes. */
export function stripUndefinedForFirestore(obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}
