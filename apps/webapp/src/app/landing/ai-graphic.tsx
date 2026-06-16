'use client';

// Dark theme - landing page only
const LANDING_COLORS = {
  primary: '#22d3ee',
  primary20: 'rgba(34, 211, 238, 0.2)',
  primary10: 'rgba(34, 211, 238, 0.1)',
  accent10: 'rgba(249, 115, 22, 0.1)',
  background: '#0a0a0f',
  background80: 'rgba(10, 10, 15, 0.8)',
  background95: 'rgba(20, 20, 28, 0.95)',
  border: 'rgba(255, 255, 255, 0.08)',
  border50: 'rgba(255, 255, 255, 0.12)',
  foreground: '#fafafa',
  mutedForeground: 'rgba(255, 255, 255, 0.65)',
  white: 'rgb(255, 255, 255)',
};

export default function AIGraphic() {
  return (
    <div className="relative lg:h-[700px] h-[420px] sm:h-[500px]">
      {/* Decorative Elements - matching source */}
      <div 
        className="absolute -top-4 -right-4 w-72 h-72 rounded-full blur-3xl animate-pulse"
        style={{ backgroundColor: LANDING_COLORS.primary20 }}
      />
      <div 
        className="absolute -bottom-4 -left-4 w-72 h-72 rounded-full blur-3xl animate-pulse"
        style={{ backgroundColor: LANDING_COLORS.accent10, animationDelay: '1s' }}
      />
      
      {/* Main Visual Container - lightweight gradient + abstract network */}
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
              'radial-gradient(circle at 70% 55%, rgba(34,211,238,0.28), rgba(34,211,238,0.06) 32%, rgba(10,10,15,0) 58%), linear-gradient(145deg, rgba(7,17,40,1) 0%, rgba(5,10,28,1) 38%, rgba(4,8,24,1) 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              'linear-gradient(rgba(34,211,238,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.09) 1px, transparent 1px)',
            backgroundSize: '42px 42px',
            maskImage: 'radial-gradient(circle at 70% 55%, black 24%, transparent 72%)',
          }}
        />
        <div className="absolute left-[54%] top-[48%] h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/25 blur-3xl animate-pulse" />
        <div className="ai-node-float absolute left-[56%] top-[46%] h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_26px_rgba(34,211,238,0.9)]" />
        <svg
          className="absolute inset-0 h-full w-full opacity-85"
          viewBox="0 0 1000 700"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="flowLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(34,211,238,0)" />
              <stop offset="38%" stopColor="rgba(34,211,238,0.5)" />
              <stop offset="58%" stopColor="rgba(125,211,252,0.85)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0.05)" />
            </linearGradient>
          </defs>
          <path d="M0 520 C170 500, 290 455, 420 470 C545 485, 640 540, 1000 455" stroke="url(#flowLine)" strokeWidth="2" fill="none" />
          <path d="M0 560 C180 545, 320 515, 455 520 C610 525, 710 568, 1000 500" stroke="url(#flowLine)" strokeWidth="1.6" fill="none" opacity="0.75" />
          <path d="M0 610 C190 585, 330 565, 470 565 C635 565, 740 600, 1000 545" stroke="url(#flowLine)" strokeWidth="1.3" fill="none" opacity="0.55" />
          <path d="M470 365 L560 322 L640 360 L600 440 L500 445 Z" stroke="rgba(125,211,252,0.45)" strokeWidth="1.4" fill="rgba(56,189,248,0.08)" />
          <circle className="ai-node ai-node-a" cx="560" cy="322" r="4" fill="rgba(103,232,249,0.95)" />
          <circle className="ai-node ai-node-b" cx="640" cy="360" r="3" fill="rgba(125,211,252,0.9)" />
          <circle className="ai-node ai-node-c" cx="600" cy="440" r="3" fill="rgba(103,232,249,0.9)" />
          <circle className="ai-node ai-node-d" cx="500" cy="445" r="3" fill="rgba(125,211,252,0.9)" />
        </svg>
        <div 
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(10,10,15,0.8), rgba(10,10,15,0.28), rgba(10,10,15,0.04)), linear-gradient(120deg, rgba(6,26,44,0.14), rgba(6,26,44,0.03))',
          }}
        />
        
        {/* Floating Card - dark glass, cyan border */}
        <div 
          className="absolute bottom-8 left-8 right-8 rounded-2xl p-6 shadow-2xl transition-all duration-300 hover:-translate-y-1"
          style={{ 
            backgroundColor: 'rgba(20,20,28,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(34,211,238,0.25)',
            boxShadow: '0 25px 50px -12px rgba(34,211,238,0.15)',
          }}
        >
          <div className="flex items-center gap-4">
            <div 
              className="h-14 w-14 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(to right bottom, ${LANDING_COLORS.primary20}, ${LANDING_COLORS.primary10})` }}
            >
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: LANDING_COLORS.primary }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-lg" style={{ color: LANDING_COLORS.foreground }}>AI Analysis Complete</div>
              <div className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.78)' }}>3 issues detected, 2 recommendations ready</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
