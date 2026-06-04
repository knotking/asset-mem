'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { AssetMemBrandIcon } from '@/components/brand/asset-mem-brand-icon';

// Dark theme - landing page only
const LANDING_COLORS = {
  primary: '#22d3ee',
  primaryHover: 'rgba(34, 211, 238, 0.9)',
  foreground: '#fafafa',
  foreground70: 'rgba(250, 250, 250, 0.7)',
  backgroundOverlay: 'rgba(10, 10, 15, 0.85)',
  borderOverlay: 'rgba(255, 255, 255, 0.1)',
  white: 'rgb(255, 255, 255)',
};

interface LandingHeaderProps {
  activeSection: string;
  onNavClick: (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => void;
  onButtonClick: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
}

export function LandingHeader({ activeSection, onNavClick, onButtonClick }: LandingHeaderProps) {
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md border-b w-full" style={{ backgroundColor: LANDING_COLORS.backgroundOverlay, borderColor: LANDING_COLORS.borderOverlay }}>
      <div className="container mx-auto px-4" style={{ maxWidth: '1400px' }}>
        <div className="flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group" onClick={(e) => onNavClick(e, '#')}>
            <AssetMemBrandIcon
              variant="mark"
              size="md"
              markTheme="landing"
              className="group-hover:scale-105 transition-transform"
            />
            <span className="text-2xl font-light tracking-tight" style={{ color: LANDING_COLORS.foreground }}>
              AssetMem <span className="font-bold">AI</span>
            </span>
          </Link>

          <nav className="hidden md:flex gap-10">
            <a
              href="#"
              onClick={(e) => onNavClick(e, '#')}
              className="text-sm font-medium transition-all duration-300 relative group"
              style={{
                color: activeSection === '' ? LANDING_COLORS.primary : LANDING_COLORS.foreground70,
                transform: 'translateY(0)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = LANDING_COLORS.primary;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = activeSection === '' ? LANDING_COLORS.primary : LANDING_COLORS.foreground70;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Home
              <span
                className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300"
                style={{
                  backgroundColor: LANDING_COLORS.primary,
                  width: activeSection === '' ? '100%' : '0%',
                }}
              ></span>
              <span
                className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"
                style={{ backgroundColor: LANDING_COLORS.primary }}
              ></span>
            </a>
            <a
              href="#use-cases"
              onClick={(e) => onNavClick(e, '#use-cases')}
              className="text-sm font-medium transition-all duration-300 relative group"
              style={{
                color: activeSection === 'use-cases' ? LANDING_COLORS.primary : LANDING_COLORS.foreground70,
                transform: 'translateY(0)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = LANDING_COLORS.primary;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = activeSection === 'use-cases' ? LANDING_COLORS.primary : LANDING_COLORS.foreground70;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Use Cases
              <span
                className="absolute bottom-0 left-0 h-0.5 transition-all duration-300"
                style={{
                  backgroundColor: LANDING_COLORS.primary,
                  width: activeSection === 'use-cases' ? '100%' : '0%',
                }}
              ></span>
              <span
                className="absolute bottom-0 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full"
                style={{ backgroundColor: LANDING_COLORS.primary }}
              ></span>
            </a>
            <a
              href="#features"
              onClick={(e) => onNavClick(e, '#features')}
              className="text-sm font-medium transition-all duration-300 relative group"
              style={{
                color: activeSection === 'features' ? LANDING_COLORS.primary : LANDING_COLORS.foreground70,
                transform: 'translateY(0)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = LANDING_COLORS.primary;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = activeSection === 'features' ? LANDING_COLORS.primary : LANDING_COLORS.foreground70;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Features
              <span
                className="absolute bottom-0 left-0 h-0.5 transition-all duration-300"
                style={{
                  backgroundColor: LANDING_COLORS.primary,
                  width: activeSection === 'features' ? '100%' : '0%',
                }}
              ></span>
              <span
                className="absolute bottom-0 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full"
                style={{ backgroundColor: LANDING_COLORS.primary }}
              ></span>
            </a>
            <a
              href="#ai-agents"
              onClick={(e) => onNavClick(e, '#ai-agents')}
              className="text-sm font-medium transition-all duration-300 relative group"
              style={{
                color: activeSection === 'ai-agents' ? LANDING_COLORS.primary : LANDING_COLORS.foreground70,
                transform: 'translateY(0)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = LANDING_COLORS.primary;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = activeSection === 'ai-agents' ? LANDING_COLORS.primary : LANDING_COLORS.foreground70;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              AI Agents
              <span
                className="absolute bottom-0 left-0 h-0.5 transition-all duration-300"
                style={{
                  backgroundColor: LANDING_COLORS.primary,
                  width: activeSection === 'ai-agents' ? '100%' : '0%',
                }}
              ></span>
              <span
                className="absolute bottom-0 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full"
                style={{ backgroundColor: LANDING_COLORS.primary }}
              ></span>
            </a>
            <a
              href="#timeline-feature"
              onClick={(e) => onNavClick(e, '#timeline-feature')}
              className="text-sm font-medium transition-all duration-300 relative group"
              style={{
                color: activeSection === 'timeline-feature' ? LANDING_COLORS.primary : LANDING_COLORS.foreground70,
                transform: 'translateY(0)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = LANDING_COLORS.primary;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = activeSection === 'timeline-feature' ? LANDING_COLORS.primary : LANDING_COLORS.foreground70;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Timeline
              <span
                className="absolute bottom-0 left-0 h-0.5 transition-all duration-300"
                style={{
                  backgroundColor: LANDING_COLORS.primary,
                  width: activeSection === 'timeline-feature' ? '100%' : '0%',
                }}
              ></span>
              <span
                className="absolute bottom-0 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full"
                style={{ backgroundColor: LANDING_COLORS.primary }}
              ></span>
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => onNavClick(e, '#how-it-works')}
              className="text-sm font-medium transition-all duration-300 relative group"
              style={{
                color: activeSection === 'how-it-works' ? LANDING_COLORS.primary : LANDING_COLORS.foreground70,
                transform: 'translateY(0)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = LANDING_COLORS.primary;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = activeSection === 'how-it-works' ? LANDING_COLORS.primary : LANDING_COLORS.foreground70;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              How It Works
              <span
                className="absolute bottom-0 left-0 h-0.5 transition-all duration-300"
                style={{
                  backgroundColor: LANDING_COLORS.primary,
                  width: activeSection === 'how-it-works' ? '100%' : '0%',
                }}
              ></span>
              <span
                className="absolute bottom-0 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full"
                style={{ backgroundColor: LANDING_COLORS.primary }}
              ></span>
            </a>
            <a
              href="#pricing"
              onClick={(e) => onNavClick(e, '#pricing')}
              className="text-sm font-medium transition-all duration-300 relative group"
              style={{
                color: activeSection === 'pricing' ? LANDING_COLORS.primary : LANDING_COLORS.foreground70,
                transform: 'translateY(0)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = LANDING_COLORS.primary;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = activeSection === 'pricing' ? LANDING_COLORS.primary : LANDING_COLORS.foreground70;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Pricing
              <span
                className="absolute bottom-0 left-0 h-0.5 transition-all duration-300"
                style={{
                  backgroundColor: LANDING_COLORS.primary,
                  width: activeSection === 'pricing' ? '100%' : '0%',
                }}
              ></span>
              <span
                className="absolute bottom-0 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full"
                style={{ backgroundColor: LANDING_COLORS.primary }}
              ></span>
            </a>
          </nav>

          <div className="flex items-center gap-4" style={{ minWidth: '120px', justifyContent: 'flex-end' }}>
            {loading ? (
              // Reserve space while loading to prevent flicker
              <div className="px-6 py-2.5 text-sm font-medium rounded-lg" style={{ visibility: 'hidden' }}>
                Dashboard
              </div>
            ) : user ? (
              // User is logged in - show "Dashboard"
              <Link
                href="/home"
                onClick={onButtonClick}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = LANDING_COLORS.primaryHover;
                }}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = LANDING_COLORS.primary}
                className="px-6 py-2.5 text-sm font-medium rounded-lg transition-all shadow-lg hover:shadow-xl whitespace-nowrap inline-flex items-center justify-center"
                style={{ backgroundColor: LANDING_COLORS.primary, color: "#0a0a0f" }}
              >
                Dashboard
              </Link>
            ) : (
              // User is not logged in - show "Sign In"
              <Link
                href="/login"
                className="px-6 py-2.5 text-sm font-medium rounded-lg transition-all shadow-lg hover:shadow-xl whitespace-nowrap inline-flex items-center justify-center"
                style={{
                  backgroundColor: LANDING_COLORS.primary,
                  color: "#0a0a0f",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = LANDING_COLORS.primaryHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = LANDING_COLORS.primary;
                }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

