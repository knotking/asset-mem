/** B2B pilot program — landing CTAs and external form (Tier A). */

export function getPilotFormUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_PILOT_FORM_URL?.trim();
  return url || undefined;
}

export function getPilotsEmail(): string {
  return (
    process.env.NEXT_PUBLIC_PILOTS_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
    'support@asset-mem.com'
  );
}

export function getPilotMailtoHref(): string {
  const subject = encodeURIComponent('AssetMem AI pilot request');
  return `mailto:${getPilotsEmail()}?subject=${subject}`;
}

/** True when the URL is likely safe to embed in an iframe (Tally, Typeform). */
export function isEmbeddablePilotFormUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith('tally.so') ||
      host.endsWith('typeform.com') ||
      host.endsWith('fillout.com')
    );
  } catch {
    return false;
  }
}
