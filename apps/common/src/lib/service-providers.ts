/**
 * Flattens service-provider payloads from checkpoint / service agents.
 * Many pipelines return `serpAPIResults` / `googleSearchResults` as arrays of
 * human-readable strings; the chat UIs expect objects with `name`, `contact_info`, etc.
 *
 * **mapp** imports this module. **webapp** cannot depend on `@asset-mem/common` (Firebase App
 * Hosting); it keeps copies under `apps/webapp/src/lib/` and `apps/webapp/src/contexts/` — update
 * both sides when changing parsing or saved-provider behavior (`service-providers.ts`,
 * `saved-service-provider-dedupe.ts`, `saved-service-providers-context.tsx`, related types).
 */

const GENERIC_PROVIDER_NAMES = new Set([
  'provider',
  'search guidance',
  'business',
  'local business',
  'unknown',
]);

const VERTEX_GROUNDING_REDIRECT_RE =
  /vertexaisearch\.cloud\.google\.com\/grounding-api-redirect/i;

const VERTEX_GROUNDING_URL_IN_TEXT_RE =
  /https?:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\/\S+/gi;

/** Google Search / Gemini grounding redirect URLs are not useful as provider links. */
export function isVertexGroundingRedirectUrl(value: string): boolean {
  return VERTEX_GROUNDING_REDIRECT_RE.test(value);
}

export function stripVertexGroundingUrls(text: string): string {
  return text.replace(VERTEX_GROUNDING_URL_IN_TEXT_RE, '').replace(/\s{2,}/g, ' ').trim();
}

function pickString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) return t;
    }
  }
  return undefined;
}

function hasUsefulField(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  return (
    lower !== 'n/a' &&
    lower !== 'not available' &&
    lower !== 'none' &&
    lower !== 'null' &&
    lower !== 'no additional information available.'
  );
}

function sanitizeUrlField(value: unknown): string | undefined {
  const s = pickString(value);
  if (!s) return undefined;
  if (isVertexGroundingRedirectUrl(s)) return undefined;
  return s;
}

function cleanseTextField(value: unknown): string | undefined {
  const s = pickString(value);
  if (!s) return undefined;
  const cleaned = stripVertexGroundingUrls(s);
  if (!cleaned || isVertexGroundingRedirectUrl(cleaned)) return undefined;
  return cleaned;
}

function isMeaninglessProviderName(name: string): boolean {
  const t = name.trim();
  if (!t) return true;
  if (GENERIC_PROVIDER_NAMES.has(t.toLowerCase())) return true;
  if (isVertexGroundingRedirectUrl(t)) return true;
  if (/^https?:\/\//i.test(t)) return true;
  return false;
}

function scrubRecordUrls(rec: Record<string, unknown>): void {
  const textKeys = [
    'website',
    'link',
    'url',
    'directions',
    'directions_url',
    'map_link',
    'additional_information',
    'description',
    'about',
    'name',
    'title',
    'business_name',
    'businessName',
    'company',
    'provider',
    'store',
  ] as const;
  for (const key of textKeys) {
    const val = rec[key];
    if (typeof val !== 'string') continue;
    const cleaned = cleanseTextField(val);
    if (!cleaned) {
      delete rec[key];
    } else if (cleaned !== val) {
      rec[key] = cleaned;
    }
  }
}

/**
 * Whether a normalized/raw provider object is worth showing in the Service Recommendations UI.
 */
export function isDisplayableServiceProvider(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object' || Array.isArray(provider)) return false;
  const p = provider as Record<string, unknown>;

  const name = pickString(p.name, p.business_name, p.businessName, p.title, p.company, p.provider, p.store);
  if (!name || isMeaninglessProviderName(name)) return false;

  const contact = pickString(p.contact_info, p.phone, p.phoneNumber, p.contact, p.contactInfo);
  const location = pickString(p.location, p.address, p.address_line);
  const ratings = pickString(p.ratings, p.rating);
  const reviews = pickString(p.reviews, p.review_count, p.reviewCount);
  const distance = p.distance_miles ?? p._distance_miles ?? p.distance;
  const specialties = pickString(p.specialties, p.services);
  const additional = cleanseTextField(
    pickString(p.additional_information, p.description, p.about)
  );

  const website = sanitizeUrlField(pickString(p.website, p.url, p.link));
  const link = sanitizeUrlField(pickString(p.link, p.url, p.website));
  const directions = sanitizeUrlField(pickString(p.directions, p.directions_url, p.map_link));

  if (hasUsefulField(contact) || hasUsefulField(location) || hasUsefulField(ratings)) return true;
  if (hasUsefulField(reviews) || hasUsefulField(specialties)) return true;
  if (distance != null && String(distance).trim() !== '') return true;
  if (website || link || directions) return true;
  if (additional && additional.length <= 240) return true;

  // Real business name only (not generic "Provider")
  return name.length >= 3 && /[a-z]/i.test(name) && !GENERIC_PROVIDER_NAMES.has(name.toLowerCase());
}

function providerObjectFromFreeformLine(line: string): Record<string, string> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (isVertexGroundingRedirectUrl(trimmed)) return null;
  if (/^https?:\/\/\S+$/i.test(trimmed)) return null;

  const ratingMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*Rating\s*\((\d+)\s*reviews?\)/i);
  const mapsRatingMatch = trimmed.match(/\brating\s+(\d+(?:\.\d+)?)/i);
  const mapsReviewsMatch = trimmed.match(/\breviews\s+(\d+)/i);
  const distanceMatch = trimmed.match(/\b(\d+(?:\.\d+)?)\s*mi\b/i);
  const phoneMatch = trimmed.match(/(?:Phone:\s*)?(\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4})\b/);
  const looksLikeListing = !!(ratingMatch || mapsRatingMatch || phoneMatch || distanceMatch);

  // Drop long narrative blobs (former "Search guidance") — not actionable as provider cards.
  if (!looksLikeListing && trimmed.length > 120) {
    return null;
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

  name = stripVertexGroundingUrls(name);
  if (!name || isMeaninglessProviderName(name)) return null;

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

  if (!isDisplayableServiceProvider(out)) return null;
  return out;
}

function sanitizeProviderObject(item: Record<string, unknown>): Record<string, unknown> | null {
  const copy: Record<string, unknown> = { ...item };
  scrubRecordUrls(copy);

  const name = pickString(
    copy.name,
    copy.business_name,
    copy.businessName,
    copy.title,
    copy.company,
    copy.provider,
    copy.store
  );
  if (!name) return null;

  if (isMeaninglessProviderName(name)) {
    const alt = cleanseTextField(pickString(copy.snippet, copy.summary));
    if (!alt || isMeaninglessProviderName(alt)) return null;
    copy.name = alt;
  }

  if (!isDisplayableServiceProvider(copy)) return null;
  return copy;
}

/**
 * Returns a flat list of provider-like objects (each a plain object, never raw strings).
 */
export function flattenServiceProviderRawList(providers: unknown): unknown[] {
  if (providers == null) return [];

  if (typeof providers === 'string') {
    const trimmed = providers.trim();
    if (isVertexGroundingRedirectUrl(trimmed) || /^https?:\/\/\S+$/i.test(trimmed)) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(providers);
      return flattenServiceProviderRawList(parsed);
    } catch {
      const o = providerObjectFromFreeformLine(providers);
      return o ? [o] : [];
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
        const cleaned = sanitizeProviderObject(item as Record<string, unknown>);
        if (cleaned) out.push(cleaned);
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

function providerDisplayName(item: Record<string, unknown>): string | undefined {
  return pickString(
    item.name,
    item.business_name,
    item.businessName,
    item.title,
    item.company,
    item.provider,
    item.store
  );
}

/** Dedupe flattened provider objects by normalized business name (matches agent normalize). */
export function dedupeServiceProvidersByName(providers: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const item of providers) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const name = providerDisplayName(item as Record<string, unknown>);
    if (!name) continue;
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Flatten serviceResults / localPros into one provider list without duplicates.
 * After agent normalization, `serpAPIResults` is the merged display list (Google + Maps);
 * `googleSearchResults` repeats the Google rows — do not concatenate both.
 */
export function collectServiceProviderCandidates(
  service: Record<string, unknown> | undefined | null
): unknown[] {
  if (!service || typeof service !== 'object') return [];

  const localPros =
    service.localPros && typeof service.localPros === 'object' && !Array.isArray(service.localPros)
      ? (service.localPros as Record<string, unknown>)
      : undefined;

  const yelp = flattenServiceProviderRawList(localPros?.yelpAPIResults);
  const serp = flattenServiceProviderRawList(localPros?.serpAPIResults);
  const google = flattenServiceProviderRawList(localPros?.googleSearchResults);
  const localProsMerged = serp.length > 0 ? serp : google;

  const legacy = [
    ...flattenServiceProviderRawList(service.providers),
    ...flattenServiceProviderRawList(service.localProviders),
    ...flattenServiceProviderRawList(service.local_pros),
    ...flattenServiceProviderRawList(service.results),
    ...flattenServiceProviderRawList(service.nearbyProviders),
  ];

  return dedupeServiceProvidersByName([...yelp, ...localProsMerged, ...legacy]);
}
