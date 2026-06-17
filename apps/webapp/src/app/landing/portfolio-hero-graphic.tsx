'use client';

const LANDING_COLORS = {
  primary: '#22d3ee',
  primarySoft: 'rgba(34, 211, 238, 0.2)',
  surface: 'rgba(15, 23, 42, 0.7)',
  surfaceBorder: 'rgba(148, 163, 184, 0.2)',
  textMain: '#e2e8f0',
  textMuted: 'rgba(203, 213, 225, 0.78)',
  warn: '#fca5a5',
  warnBg: 'rgba(239, 68, 68, 0.12)',
  ok: '#86efac',
  okBg: 'rgba(34, 197, 94, 0.12)',
};

const PORTFOLIO_PROPERTIES = [
  {
    name: 'Unit 4B — Maple Apts',
    score: 58,
    status: 'Attention',
    statusTone: 'warn' as const,
    detail: 'Moisture trend ↑',
  },
  {
    name: '1842 Oak Street',
    score: 74,
    status: 'Stable',
    statusTone: 'ok' as const,
    detail: 'Last walkthrough 3d ago',
  },
  {
    name: 'Claim #CC-9021',
    score: 52,
    status: 'Review',
    statusTone: 'warn' as const,
    detail: 'Roof damage flagged',
  },
];

function statusStyles(tone: 'warn' | 'ok') {
  if (tone === 'warn') {
    return {
      color: LANDING_COLORS.warn,
      backgroundColor: LANDING_COLORS.warnBg,
    };
  }
  return {
    color: LANDING_COLORS.ok,
    backgroundColor: LANDING_COLORS.okBg,
  };
}

export function PortfolioHeroGraphic() {
  return (
    <div className="relative h-[600px] sm:h-[640px] lg:h-[650px]">
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
          <div
            className="flex items-center justify-between rounded-xl border px-4 py-2 text-xs backdrop-blur-sm"
            style={{
              backgroundColor: LANDING_COLORS.surface,
              borderColor: LANDING_COLORS.surfaceBorder,
              color: LANDING_COLORS.textMuted,
            }}
          >
            <span style={{ color: 'rgba(226,232,240,0.92)' }}>
              Portfolio overview
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px]"
              style={{
                backgroundColor: 'rgba(34,211,238,0.15)',
                color: '#67e8f9',
              }}
            >
              24 properties
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div
              className="rounded-lg border px-2.5 py-2 sm:px-3"
              style={{
                borderColor: LANDING_COLORS.surfaceBorder,
                backgroundColor: 'rgba(15,23,42,0.58)',
              }}
            >
              <div style={{ color: LANDING_COLORS.textMuted }}>Need attention</div>
              <div
                className="mt-1 text-sm font-semibold"
                style={{ color: LANDING_COLORS.warn }}
              >
                3 units
              </div>
            </div>
            <div
              className="rounded-lg border px-2.5 py-2 sm:px-3"
              style={{
                borderColor: LANDING_COLORS.surfaceBorder,
                backgroundColor: 'rgba(15,23,42,0.58)',
              }}
            >
              <div style={{ color: LANDING_COLORS.textMuted }}>Avg score</div>
              <div
                className="mt-1 text-sm font-semibold"
                style={{ color: '#a5f3fc' }}
              >
                71 / 100
              </div>
            </div>
            <div
              className="rounded-lg border px-2.5 py-2 sm:px-3"
              style={{
                borderColor: LANDING_COLORS.surfaceBorder,
                backgroundColor: 'rgba(15,23,42,0.58)',
              }}
            >
              <div style={{ color: LANDING_COLORS.textMuted }}>Reports due</div>
              <div
                className="mt-1 text-sm font-semibold"
                style={{ color: LANDING_COLORS.textMain }}
              >
                2 ready
              </div>
            </div>
          </div>

          <div
            className="flex-1 min-h-0 rounded-xl border p-2.5 sm:p-3 backdrop-blur-sm space-y-2 overflow-hidden"
            style={{
              backgroundColor: LANDING_COLORS.surface,
              borderColor: LANDING_COLORS.surfaceBorder,
            }}
          >
            <div
              className="flex items-center justify-between text-[11px] px-0.5"
              style={{ color: 'rgba(226,232,240,0.84)' }}
            >
              <span>Flagged this week</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: LANDING_COLORS.warnBg,
                  color: LANDING_COLORS.warn,
                }}
              >
                ↑ 2 new
              </span>
            </div>

            {PORTFOLIO_PROPERTIES.map((property) => {
              const badge = statusStyles(property.statusTone);
              return (
                <div
                  key={property.name}
                  className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2 sm:px-3"
                  style={{
                    borderColor:
                      property.statusTone === 'warn'
                        ? 'rgba(239,68,68,0.25)'
                        : LANDING_COLORS.surfaceBorder,
                    backgroundColor: 'rgba(15,23,42,0.45)',
                  }}
                >
                  <div
                    className="h-9 w-9 shrink-0 rounded-md flex items-center justify-center text-xs font-bold tabular-nums"
                    style={{
                      backgroundColor:
                        property.statusTone === 'warn'
                          ? 'rgba(239,68,68,0.15)'
                          : 'rgba(34,211,238,0.12)',
                      color:
                        property.statusTone === 'warn' ? '#fca5a5' : '#67e8f9',
                    }}
                  >
                    {property.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[11px] font-medium truncate"
                      style={{ color: LANDING_COLORS.textMain }}
                    >
                      {property.name}
                    </div>
                    <div
                      className="text-[10px] truncate"
                      style={{ color: LANDING_COLORS.textMuted }}
                    >
                      {property.detail}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold"
                    style={badge}
                  >
                    {property.status}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            className="rounded-xl border p-3 backdrop-blur-sm"
            style={{
              backgroundColor: LANDING_COLORS.surface,
              borderColor: LANDING_COLORS.surfaceBorder,
            }}
          >
            <div
              className="mb-2 flex items-center justify-between text-[11px]"
              style={{ color: 'rgba(226,232,240,0.84)' }}
            >
              <span>Portfolio risk trend</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: LANDING_COLORS.warnBg,
                  color: LANDING_COLORS.warn,
                }}
              >
                4 sites worsening
              </span>
            </div>
            <div className="flex h-12 items-end gap-1 px-1">
              {[38, 42, 45, 49, 53, 58, 62, 68, 74].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${h}%`,
                    backgroundColor:
                      i >= 7
                        ? 'rgba(239,68,68,0.75)'
                        : `rgba(34,211,238,${0.2 + i * 0.06})`,
                    boxShadow:
                      i === 8 ? '0 0 8px rgba(239,68,68,0.35)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          <div
            className="mt-auto rounded-xl p-3 sm:p-4 transition-all duration-300 hover:-translate-y-0.5"
            style={{
              backgroundColor: 'rgba(12,18,32,0.95)',
              border: '1px solid rgba(34,211,238,0.3)',
              boxShadow:
                '0 0 0 1px rgba(34,211,238,0.06), 0 8px 32px -8px rgba(34,211,238,0.25)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-lg flex-shrink-0 flex items-center justify-center"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(34,211,238,0.25), rgba(34,211,238,0.1))',
                }}
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  style={{ color: '#22d3ee', width: '1.1rem', height: '1.1rem' }}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17v-4m3 4V7m3 10v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="font-semibold text-sm"
                    style={{ color: LANDING_COLORS.textMain }}
                  >
                    Portfolio report ready
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                    style={{
                      backgroundColor: 'rgba(34,211,238,0.15)',
                      color: '#67e8f9',
                    }}
                  >
                    PDF
                  </span>
                </div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: LANDING_COLORS.textMuted }}
                >
                  3 properties flagged · 2 claims docs attached
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
