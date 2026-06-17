'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { AssetMemBrandIcon } from '@/components/brand/asset-mem-brand-icon';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

// Dark theme - landing page only
const LANDING_COLORS = {
  primary: '#22d3ee',
  primaryHover: 'rgba(34, 211, 238, 0.9)',
  foreground: '#fafafa',
  foreground70: 'rgba(250, 250, 250, 0.7)',
  background: '#0a0a0f',
  backgroundOverlay: 'rgba(10, 10, 15, 0.85)',
  borderOverlay: 'rgba(255, 255, 255, 0.1)',
};

const NAV_LINKS = [
  { href: '#', targetId: '#', label: 'Home', sectionId: '' },
  { href: '#use-cases', targetId: '#use-cases', label: 'Use Cases', sectionId: 'use-cases' },
  { href: '#features', targetId: '#features', label: 'Features', sectionId: 'features' },
  { href: '#reports', targetId: '#reports', label: 'Reports', sectionId: 'reports' },
  { href: '#ai-agents', targetId: '#ai-agents', label: 'AI Agents', sectionId: 'ai-agents' },
  { href: '#timeline-feature', targetId: '#timeline-feature', label: 'Timeline', sectionId: 'timeline-feature' },
  { href: '#how-it-works', targetId: '#how-it-works', label: 'How It Works', sectionId: 'how-it-works' },
  { href: '#pilot', targetId: '#pilot', label: 'Pilot', sectionId: 'pilot' },
  { href: '#pricing', targetId: '#pricing', label: 'Pricing', sectionId: 'pricing' },
] as const;

interface LandingHeaderProps {
  activeSection: string;
  onNavClick: (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => void;
  onButtonClick: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
}

function DesktopNavLink({
  href,
  targetId,
  label,
  sectionId,
  activeSection,
  onNavClick,
}: {
  href: string;
  targetId: string;
  label: string;
  sectionId: string;
  activeSection: string;
  onNavClick: (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => void;
}) {
  const isActive = activeSection === sectionId;

  return (
    <a
      href={href}
      onClick={(e) => onNavClick(e, targetId)}
      className="text-sm font-medium whitespace-nowrap transition-all duration-300 relative group"
      style={{
        color: isActive ? LANDING_COLORS.primary : LANDING_COLORS.foreground70,
        transform: 'translateY(0)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = LANDING_COLORS.primary;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = isActive ? LANDING_COLORS.primary : LANDING_COLORS.foreground70;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {label}
      <span
        className="absolute bottom-0 left-0 h-0.5 transition-all duration-300"
        style={{
          backgroundColor: LANDING_COLORS.primary,
          width: isActive ? '100%' : '0%',
        }}
      />
      <span
        className="absolute bottom-0 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full"
        style={{ backgroundColor: LANDING_COLORS.primary }}
      />
    </a>
  );
}

function LandingCta({
  user,
  loading,
  onButtonClick,
  className = '',
}: {
  user: ReturnType<typeof useAuth>['user'];
  loading: boolean;
  onButtonClick: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  className?: string;
}) {
  if (loading) {
    return (
      <div
        className={`px-4 sm:px-6 py-2.5 text-sm font-medium rounded-lg ${className}`}
        style={{ visibility: 'hidden' }}
      >
        Dashboard
      </div>
    );
  }

  if (user) {
    return (
      <Link
        href="/home"
        onClick={onButtonClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = LANDING_COLORS.primaryHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = LANDING_COLORS.primary;
        }}
        className={`px-4 sm:px-6 py-2.5 text-sm font-medium rounded-lg transition-all shadow-lg hover:shadow-xl whitespace-nowrap inline-flex items-center justify-center ${className}`}
        style={{ backgroundColor: LANDING_COLORS.primary, color: LANDING_COLORS.background }}
      >
        Dashboard
      </Link>
    );
  }

  return (
    <Link
      href="/login"
      className={`px-4 sm:px-6 py-2.5 text-sm font-medium rounded-lg transition-all shadow-lg hover:shadow-xl whitespace-nowrap inline-flex items-center justify-center ${className}`}
      style={{
        backgroundColor: LANDING_COLORS.primary,
        color: LANDING_COLORS.background,
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
  );
}

export function LandingHeader({ activeSection, onNavClick, onButtonClick }: LandingHeaderProps) {
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMobileNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    onNavClick(e, targetId);
    setMobileMenuOpen(false);
  };

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md border-b w-full"
      style={{
        backgroundColor: LANDING_COLORS.backgroundOverlay,
        borderColor: LANDING_COLORS.borderOverlay,
      }}
    >
      <div className="container mx-auto px-4" style={{ maxWidth: '1400px' }}>
        <div className="flex h-20 items-center justify-between gap-3">
          <Link
            href="/"
            className="flex min-w-0 shrink items-center gap-2 sm:gap-3 group"
            onClick={(e) => onNavClick(e, '#')}
          >
            <AssetMemBrandIcon
              variant="mark"
              size="md"
              markTheme="landing"
              className="shrink-0 group-hover:scale-105 transition-transform"
            />
            <span
              className="truncate text-xl lg:text-2xl font-light tracking-tight"
              style={{ color: LANDING_COLORS.foreground }}
            >
              AssetMem <span className="font-bold">AI</span>
            </span>
          </Link>

          <nav className="hidden xl:flex items-center gap-6 2xl:gap-8">
            {NAV_LINKS.map((link) => (
              <DesktopNavLink
                key={link.sectionId || 'home'}
                {...link}
                activeSection={activeSection}
                onNavClick={onNavClick}
              />
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="xl:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-white/5"
                  style={{
                    borderColor: LANDING_COLORS.borderOverlay,
                    color: LANDING_COLORS.foreground,
                  }}
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="border-white/10 w-[min(100vw-2rem,20rem)] [&>button]:text-white [&>button]:hover:text-white/80"
                style={{
                  backgroundColor: LANDING_COLORS.background,
                  color: LANDING_COLORS.foreground,
                }}
              >
                <SheetHeader className="text-left">
                  <SheetTitle style={{ color: LANDING_COLORS.foreground }}>Menu</SheetTitle>
                </SheetHeader>
                <nav className="mt-8 flex flex-col gap-1">
                  {NAV_LINKS.map((link) => {
                    const isActive = activeSection === link.sectionId;

                    return (
                      <a
                        key={link.sectionId || 'home'}
                        href={link.href}
                        onClick={(e) => handleMobileNavClick(e, link.targetId)}
                        className="rounded-lg px-3 py-3 text-base font-medium transition-colors"
                        style={{
                          color: isActive ? LANDING_COLORS.primary : LANDING_COLORS.foreground70,
                          backgroundColor: isActive ? 'rgba(34, 211, 238, 0.1)' : 'transparent',
                        }}
                      >
                        {link.label}
                      </a>
                    );
                  })}
                </nav>
                <div className="mt-8 border-t pt-6" style={{ borderColor: LANDING_COLORS.borderOverlay }}>
                  <LandingCta
                    user={user}
                    loading={loading}
                    onButtonClick={(e) => {
                      onButtonClick(e);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full"
                  />
                </div>
              </SheetContent>
            </Sheet>

            <div className="hidden sm:block">
              <LandingCta user={user} loading={loading} onButtonClick={onButtonClick} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
