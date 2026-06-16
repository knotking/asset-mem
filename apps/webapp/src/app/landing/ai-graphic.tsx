'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import heroImage from '../../../hero-image.webp';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      
      {/* Main Image Container - dark border, cyan glow on hover */}
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
        <Image
          src={heroImage}
          alt="AI neural network technology"
          fill
          className="object-cover object-center lg:object-[65%_50%] scale-100 lg:scale-105 hover:scale-100 transition-transform duration-700 brightness-[0.97] saturate-[0.98]"
          sizes="(max-width: 640px) 92vw, (max-width: 1024px) 86vw, 48vw"
          quality={82}
          priority
        />
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
