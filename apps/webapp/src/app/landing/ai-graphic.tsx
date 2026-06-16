'use client';

const LANDING_COLORS = {
  primary: '#22d3ee',
  primarySoft: 'rgba(34, 211, 238, 0.2)',
  surface: 'rgba(15, 23, 42, 0.7)',
  surfaceBorder: 'rgba(148, 163, 184, 0.2)',
  textMain: '#e2e8f0',
  textMuted: 'rgba(203, 213, 225, 0.78)',
};

export default function AIGraphic() {
  return (
    <div className="relative h-[600px] sm:h-[620px] lg:h-[650px]">
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

        <div className="relative z-10 flex h-full flex-col gap-3 p-4 sm:gap-4 sm:p-6">
          <div className="flex items-center justify-between rounded-xl border px-4 py-2 text-xs backdrop-blur-sm"
            style={{ backgroundColor: LANDING_COLORS.surface, borderColor: LANDING_COLORS.surfaceBorder, color: LANDING_COLORS.textMuted }}>
            <span style={{ color: 'rgba(226,232,240,0.92)' }}>Property Timeline</span>
            <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: 'rgba(34,211,238,0.15)', color: '#67e8f9' }}>
              Live
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="rounded-xl border p-2.5 sm:p-3 backdrop-blur-sm" style={{ backgroundColor: LANDING_COLORS.surface, borderColor: LANDING_COLORS.surfaceBorder }}>
              <div className="mb-2 text-[11px]" style={{ color: LANDING_COLORS.textMuted }}>Kitchen • Feb 2026</div>
              <div className="h-14 sm:h-16 rounded-md bg-gradient-to-br from-slate-600/75 to-slate-900/78" />
              <div className="mt-2 text-[11px] font-medium" style={{ color: LANDING_COLORS.textMain }}>Minor wear detected</div>
            </div>
            <div className="rounded-xl border p-2.5 sm:p-3 backdrop-blur-sm" style={{ backgroundColor: LANDING_COLORS.surface, borderColor: 'rgba(34,211,238,0.35)' }}>
              <div className="mb-2 text-[11px]" style={{ color: LANDING_COLORS.textMuted }}>Kitchen • Jun 2026</div>
              <div className="h-14 sm:h-16 rounded-md bg-gradient-to-br from-cyan-900/70 to-slate-900/80" />
              <div className="mt-2 text-[11px] font-medium" style={{ color: '#a5f3fc' }}>Moisture risk increased</div>
            </div>
          </div>

          <div className="rounded-xl border p-3 backdrop-blur-sm"
            style={{ backgroundColor: LANDING_COLORS.surface, borderColor: LANDING_COLORS.surfaceBorder }}>
            <div className="mb-2 flex items-center justify-between text-[11px]" style={{ color: 'rgba(226,232,240,0.84)' }}>
              <span>Condition trend score</span>
              <span style={{ color: '#a5f3fc' }}>+18% risk</span>
            </div>
            <div className="flex h-14 sm:h-16 items-end justify-center gap-1.5">
              <div className="w-3 rounded-sm bg-cyan-400/35" style={{ height: '24%' }} />
              <div className="w-3 rounded-sm bg-cyan-400/40" style={{ height: '30%' }} />
              <div className="w-3 rounded-sm bg-cyan-400/45" style={{ height: '36%' }} />
              <div className="w-3 rounded-sm bg-cyan-400/50" style={{ height: '41%' }} />
              <div className="w-3 rounded-sm bg-cyan-400/55" style={{ height: '47%' }} />
              <div className="w-3 rounded-sm bg-cyan-400/60" style={{ height: '54%' }} />
              <div className="w-3 rounded-sm bg-cyan-400/70" style={{ height: '61%' }} />
              <div className="w-3 rounded-sm bg-cyan-400/80" style={{ height: '72%' }} />
              <div className="w-3 rounded-sm bg-cyan-300/90 ai-node-float" style={{ height: '82%' }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'rgba(148,163,184,0.85)' }}>
              <span>Feb</span>
              <span>Jun</span>
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
              Seal grout in 30 days
            </span>
            <span className="rounded-full border px-2.5 py-1" style={{ borderColor: LANDING_COLORS.surfaceBorder, color: LANDING_COLORS.textMuted, backgroundColor: 'rgba(15,23,42,0.55)' }}>
              Estimated cost: $220-$380
            </span>
            <span className="rounded-full border px-2.5 py-1" style={{ borderColor: LANDING_COLORS.surfaceBorder, color: LANDING_COLORS.textMuted, backgroundColor: 'rgba(15,23,42,0.55)' }}>
              2 local pros matched
            </span>
          </div>

          <div className="mt-auto rounded-2xl p-3 sm:p-4 shadow-2xl transition-all duration-300 hover:-translate-y-1"
            style={{ backgroundColor: 'rgba(12,18,32,0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(34,211,238,0.25)', boxShadow: '0 25px 50px -12px rgba(34,211,238,0.15)' }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(34,211,238,0.15)' }}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: LANDING_COLORS.primary }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-4m3 4V7m3 10v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-base" style={{ color: LANDING_COLORS.textMain }}>Monthly report ready</div>
                <div className="text-sm" style={{ color: LANDING_COLORS.textMuted }}>3 changes flagged, 1 preventive action recommended</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
