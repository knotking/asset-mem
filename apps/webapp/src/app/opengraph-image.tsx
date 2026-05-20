import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';

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
            alignItems: 'center',
            gap: 24,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #22d3ee, rgba(34,211,238,0.5))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
            }}
          >
            🏠
          </div>
          <span style={{ fontSize: 56, fontWeight: 300, letterSpacing: '-0.02em' }}>
            AssetMem <span style={{ fontWeight: 700 }}>AI</span>
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
          Checkpoints · Documents · AI agents
        </p>
      </div>
    ),
    { ...size }
  );
}
