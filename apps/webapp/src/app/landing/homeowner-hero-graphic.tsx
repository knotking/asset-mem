'use client';

const LANDING_COLORS = {
  primary: '#22d3ee',
  primarySoft: 'rgba(34, 211, 238, 0.2)',
  surface: 'rgba(15, 23, 42, 0.7)',
  surfaceBorder: 'rgba(148, 163, 184, 0.2)',
  textMain: '#e2e8f0',
  textMuted: 'rgba(203, 213, 225, 0.78)',
};

export function HomeownerHeroGraphic() {
  return (
    <div className="flex flex-col min-h-0">
    <div
      className="relative h-[600px] sm:h-[640px] lg:h-[650px]"
      role="img"
      aria-label="Example workflow showing AI property timeline with risk detection and repair guidance"
    >
      <div
        className="absolute -top-4 -right-4 w-72 h-72 rounded-full blur-3xl animate-pulse"
        style={{ backgroundColor: LANDING_COLORS.primarySoft }}
      />
      <div
        className="absolute -bottom-4 -left-4 w-72 h-72 rounded-full blur-3xl animate-pulse"
        style={{ backgroundColor: 'rgba(59, 130, 246, 0.16)', animationDelay: '1s' }}
      />

      <div
        className="relative h-full rounded-3xl overflow-hidden shadow-2xl border transition-all duration-500"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(34,211,238,0.3)';
          e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(34,211,238,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
          e.currentTarget.style.boxShadow = '';
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 72% 30%, rgba(34,211,238,0.16), rgba(34,211,238,0.05) 30%, rgba(10,10,15,0) 56%), linear-gradient(145deg, rgba(8,15,35,1) 0%, rgba(6,12,30,1) 45%, rgba(4,9,24,1) 100%)',
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.06)_1px,transparent_1px)] bg-[size:36px_36px] opacity-35" />

        <div className="relative z-10 flex h-full flex-col gap-3 p-4 sm:p-6">
          <div className="flex items-center rounded-xl border px-4 py-2 text-xs backdrop-blur-sm"
            style={{ backgroundColor: LANDING_COLORS.surface, borderColor: LANDING_COLORS.surfaceBorder, color: LANDING_COLORS.textMuted }}>
            <span className="flex items-center gap-2 min-w-0">
              <span style={{ color: 'rgba(226,232,240,0.92)' }}>AI Property Timeline</span>
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0"
                style={{
                  backgroundColor: 'rgba(34,211,238,0.12)',
                  borderColor: 'rgba(34,211,238,0.28)',
                  color: 'rgba(165,243,252,0.92)',
                }}
              >
                Example workflow
              </span>
            </span>
          </div>

          <div className="relative grid grid-cols-2 gap-2 sm:gap-3">
            {/* Before */}
            <div className="rounded-xl border p-2.5 sm:p-3 backdrop-blur-sm" style={{ backgroundColor: LANDING_COLORS.surface, borderColor: LANDING_COLORS.surfaceBorder }}>
              <div className="mb-2 flex items-center justify-between text-[11px]">
                <span style={{ color: LANDING_COLORS.textMuted }}>Wet zone • Feb 2026</span>
                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ backgroundColor: 'rgba(148,163,184,0.12)', color: 'rgba(148,163,184,0.8)' }}>BEFORE</span>
              </div>
              <div className="relative h-16 sm:h-20 rounded-md overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e293b 100%)' }}>
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(148,163,184,0.08) 8px, rgba(148,163,184,0.08) 9px), repeating-linear-gradient(90deg, transparent, transparent 12px, rgba(148,163,184,0.06) 12px, rgba(148,163,184,0.06) 13px)' }} />
                <div className="absolute bottom-2 left-2 right-2 h-1.5 rounded-full opacity-20" style={{ backgroundColor: 'rgba(148,163,184,0.5)' }} />
              </div>
              <div className="mt-2 text-[11px] font-medium" style={{ color: LANDING_COLORS.textMain }}>Minor wear detected</div>
            </div>

            {/* After */}
            <div className="rounded-xl border p-2.5 sm:p-3 backdrop-blur-sm" style={{ backgroundColor: LANDING_COLORS.surface, borderColor: 'rgba(34,211,238,0.4)' }}>
              <div className="mb-2 flex items-center justify-between text-[11px]">
                <span style={{ color: LANDING_COLORS.textMuted }}>Wet zone • Jun 2026</span>
                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ backgroundColor: 'rgba(34,211,238,0.15)', color: '#67e8f9' }}>AFTER</span>
              </div>
              <div className="relative h-16 sm:h-20 rounded-md overflow-hidden" style={{ background: 'linear-gradient(135deg, #0c2233 0%, #0a1628 50%, #0d1f35 100%)' }}>
                <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(34,211,238,0.06) 8px, rgba(34,211,238,0.06) 9px), repeating-linear-gradient(90deg, transparent, transparent 12px, rgba(34,211,238,0.04) 12px, rgba(34,211,238,0.04) 13px)' }} />
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(239,68,68,0.7)' }} />
                <div className="absolute bottom-2 left-2 right-8 h-1.5 rounded-full opacity-30" style={{ backgroundColor: 'rgba(34,211,238,0.6)' }} />
              </div>
              <div className="mt-2 text-[11px] font-medium" style={{ color: '#a5f3fc' }}>Moisture risk increased</div>
            </div>

            {/* Change badge */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10 rounded-full border px-2.5 py-0.5 text-[9px] font-bold whitespace-nowrap" style={{ borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}>
              ▲ AI change detected
            </div>
          </div>

          <div className="mt-3 rounded-xl border p-3 backdrop-blur-sm" style={{ backgroundColor: LANDING_COLORS.surface, borderColor: LANDING_COLORS.surfaceBorder }}>
            <div className="mb-3 flex items-center justify-between text-[11px]" style={{ color: 'rgba(226,232,240,0.84)' }}>
              <span>AI condition trend score</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}>↑ +18% risk</span>
            </div>
            <div className="relative">
              <div className="flex h-16 items-end gap-1.5 px-1">
                {[24, 30, 36, 41, 47, 54, 61, 72, 84].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${h}%`,
                      backgroundColor: i === 8 ? 'rgba(34,211,238,0.9)' : `rgba(34,211,238,${0.25 + i * 0.07})`,
                      boxShadow: i === 8 ? '0 0 8px rgba(34,211,238,0.5)' : 'none',
                    }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] px-1" style={{ color: 'rgba(148,163,184,0.7)' }}>
                <span>Feb</span>
                <span>Jun</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg border px-2.5 py-2 sm:px-3" style={{ borderColor: LANDING_COLORS.surfaceBorder, backgroundColor: 'rgba(15,23,42,0.58)' }}>
              <div style={{ color: LANDING_COLORS.textMuted }}>Risk score</div>
              <div className="mt-1 text-sm font-semibold" style={{ color: '#a5f3fc' }}>62 / 100</div>
            </div>
            <div className="rounded-lg border px-2.5 py-2 sm:px-3" style={{ borderColor: LANDING_COLORS.surfaceBorder, backgroundColor: 'rgba(15,23,42,0.58)' }}>
              <div style={{ color: LANDING_COLORS.textMuted }}>Updated</div>
              <div className="mt-1 text-sm font-semibold" style={{ color: LANDING_COLORS.textMain }}>2h ago</div>
            </div>
            <div className="rounded-lg border px-2.5 py-2 sm:px-3" style={{ borderColor: LANDING_COLORS.surfaceBorder, backgroundColor: 'rgba(15,23,42,0.58)' }}>
              <div style={{ color: LANDING_COLORS.textMuted }}>Priority</div>
              <div className="mt-1 text-sm font-semibold" style={{ color: '#67e8f9' }}>Medium</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[11px]">
            <span className="rounded-full border px-2.5 py-1" style={{ borderColor: 'rgba(34,211,238,0.3)', color: '#a5f3fc', backgroundColor: 'rgba(34,211,238,0.1)' }}>
              Preventive fix: seal grout
            </span>
            <span className="rounded-full border px-2.5 py-1" style={{ borderColor: LANDING_COLORS.surfaceBorder, color: LANDING_COLORS.textMuted, backgroundColor: 'rgba(15,23,42,0.55)' }}>
              Repair range: $220–$380
            </span>
            <span className="hidden sm:inline-flex rounded-full border px-2.5 py-1" style={{ borderColor: LANDING_COLORS.surfaceBorder, color: LANDING_COLORS.textMuted, backgroundColor: 'rgba(15,23,42,0.55)' }}>
              Service matches: 2 nearby
            </span>
          </div>

          <div className="mt-auto rounded-xl p-3 sm:p-4 transition-all duration-300 hover:-translate-y-0.5"
            style={{ backgroundColor: 'rgba(12,18,32,0.95)', border: '1px solid rgba(34,211,238,0.3)', boxShadow: '0 0 0 1px rgba(34,211,238,0.06), 0 8px 32px -8px rgba(34,211,238,0.25)' }}>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.25), rgba(34,211,238,0.1))' }}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#22d3ee', width: '1.1rem', height: '1.1rem' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-4m3 4V7m3 10v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm" style={{ color: LANDING_COLORS.textMain }}>Monthly report ready</span>
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ backgroundColor: 'rgba(34,211,238,0.15)', color: '#67e8f9' }}>NEW</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: LANDING_COLORS.textMuted }}>3 flagged changes · 1 recommended action</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
