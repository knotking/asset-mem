import { ImageResponse } from 'next/og';
import { LANDING_BRAND_AI_SIZE_EM } from '@/components/brand/asset-mem-wordmark';
import { LANDING_COLORS } from '@/lib/landing-theme';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';

const WORDMARK_FONT_SIZE_PX = 56;
/** Scales with wordmark size — same proportion as Tailwind `gap-1` on the landing hero eyebrow. */
const WORDMARK_GAP_EM = 0.25;
/** Satori transform requires absolute px, not em. Nudges AI up vs baseline. */
const AI_TRANSLATE_Y_PX = Math.round(
  WORDMARK_FONT_SIZE_PX * LANDING_BRAND_AI_SIZE_EM * 0.06,
);
const AI_GRADIENT = `linear-gradient(to right, ${LANDING_COLORS.primary}, rgba(34,211,238,0.6))`;

export const runtime = 'edge';
export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: 'linear-gradient(135deg, #0a0a0f 0%, #0f172a 50%, #0a0a0f 100%)',
          color: '#fafafa',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginBottom: 32,
            fontSize: WORDMARK_FONT_SIZE_PX,
            fontWeight: 300,
            letterSpacing: '-0.02em',
          }}
        >
          <span style={{ display: 'flex' }}>AssetMem</span>
          <div style={{ display: 'flex', width: `${WORDMARK_GAP_EM}em`, flexShrink: 0 }} />
          <span
            style={{
              display: 'flex',
              fontSize: `${LANDING_BRAND_AI_SIZE_EM}em`,
              fontWeight: 700,
              transform: `translateY(-${AI_TRANSLATE_Y_PX}px)`,
              background: AI_GRADIENT,
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            AI
          </span>
        </div>
        <p
          style={{
            fontSize: 36,
            fontWeight: 300,
            lineHeight: 1.35,
            color: 'rgba(250,250,250,0.85)',
            maxWidth: 900,
          }}
        >
          {SITE_TAGLINE}
        </p>
        <p
          style={{
            marginTop: 40,
            fontSize: 22,
            color: 'rgba(34,211,238,0.9)',
          }}
        >
          Evidence · Change detection · AI Agents
        </p>
      </div>
    ),
    { ...size }
  );
}
