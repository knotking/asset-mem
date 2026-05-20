/**
 * Flattens service-provider payloads from checkpoint / service agents.
 * Many pipelines return `serpAPIResults` / `googleSearchResults` as arrays of
 * human-readable strings; the chat UIs expect objects with `name`, `contact_info`, etc.
 *
 * **mapp** imports this module. **webapp** cannot depend on `@homeapp/common` (Firebase App
 * Hosting); it keeps copies under `apps/webapp/src/lib/` and `apps/webapp/src/contexts/` — update
 * both sides when changing parsing or saved-provider behavior (`service-providers.ts`,
 * `saved-service-provider-dedupe.ts`, `saved-service-providers-context.tsx`, related types).
 */

function providerObjectFromFreeformLine(line: string): Record<string, string> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const ratingMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*Rating\s*\((\d+)\s*reviews?\)/i);
  const mapsRatingMatch = trimmed.match(/\brating\s+(\d+(?:\.\d+)?)/i);
  const mapsReviewsMatch = trimmed.match(/\breviews\s+(\d+)/i);
  const distanceMatch = trimmed.match(/\b(\d+(?:\.\d+)?)\s*mi\b/i);
  const phoneMatch = trimmed.match(/(?:Phone:\s*)?(\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4})\b/);
  const looksLikeListing = !!(ratingMatch || mapsRatingMatch || phoneMatch || distanceMatch);

  if (!looksLikeListing && trimmed.length > 120) {
    return {
      name: 'Search guidance',
      additional_information: trimmed,
    };
  }

  let name = trimmed;
  const ratingIdx = trimmed.search(/\d+(?:\.\d+)?\s*Rating/i);
  if (ratingIdx > 0) {
    name = trimmed.slice(0, ratingIdx).replace(/\s*-\s*$/, '').trim();
  }
  if (!name) {
    name = trimmed.length > 72 ? `${trimmed.slice(0, 69)}…` : trimmed;
  }

  const locationMatch = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  let location: string | undefined;
  if (locationMatch && /,\s*[A-Za-z]/.test(locationMatch[2])) {
    name = locationMatch[1].trim();
    location = locationMatch[2].trim();
  }

  const out: Record<string, string> = { name };
  if (location) out.location = location;
  if (ratingMatch) {
    out.ratings = ratingMatch[1];
    out.reviews = ratingMatch[2];
  } else if (mapsRatingMatch) {
    out.ratings = mapsRatingMatch[1];
    if (mapsReviewsMatch) out.reviews = mapsReviewsMatch[1];
  }
  if (distanceMatch) {
    out.distance_miles = distanceMatch[1];
  }
  if (phoneMatch) {
    out.contact_info = phoneMatch[1].trim();
  }
  return out;
}

/**
 * Returns a flat list of provider-like objects (each a plain object, never raw strings).
 */
export function flattenServiceProviderRawList(providers: unknown): unknown[] {
  if (providers == null) return [];

  if (typeof providers === 'string') {
    try {
      const parsed: unknown = JSON.parse(providers);
      return flattenServiceProviderRawList(parsed);
    } catch {
      return [];
    }
  }

  if (Array.isArray(providers)) {
    const out: unknown[] = [];
    for (const item of providers) {
      if (item == null) continue;
      if (typeof item === 'string') {
        const o = providerObjectFromFreeformLine(item);
        if (o) out.push(o);
        continue;
      }
      if (typeof item === 'object' && !Array.isArray(item)) {
        out.push(item);
      }
    }
    return out;
  }

  if (typeof providers === 'object') {
    const keys = ['providers', 'results', 'items', 'pros', 'list'] as const;
    for (const k of keys) {
      const inner = (providers as Record<string, unknown>)[k];
      if (Array.isArray(inner)) return flattenServiceProviderRawList(inner);
    }
  }

  return [];
}
