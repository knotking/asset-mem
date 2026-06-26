'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { AssetMemWordmark } from '@/components/brand/asset-mem-wordmark';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { LANDING_COLORS } from '@/lib/landing-theme';

const NAV_LINKS = [
  { href: '#', targetId: '#', label: 'Home', sectionId: '' },
  { href: '#how-it-works', targetId: '#how-it-works', label: 'How It Works', sectionId: 'how-it-works' },
  { href: '#use-cases', targetId: '#use-cases', label: 'Use Cases', sectionId: 'use-cases' },
  { href: '#enterprise', targetId: '#enterprise', label: 'Enterprise', sectionId: 'enterprise' },
  { href: '#pricing', targetId: '#pricing', label: 'Pricing', sectionId: 'pricing' },
] as const;

interface LandingHeaderProps {
  isAuthenticated: boolean;
  activeSection: string;
  onNavClick: (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => void;
  onButtonClick: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  onEnterpriseNavClick?: (e: React.MouseEvent<HTMLAnchorElement>, label: string) => void;
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
  isAuthenticated,
  onButtonClick,
  className = '',
}: {
  isAuthenticated: boolean;
  onButtonClick: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  className?: string;
}) {
  const href = isAuthenticated ? '/home' : '/login';
  const label = isAuthenticated ? 'Dashboard' : 'Sign In';

  return (
    <Link
      href={href}
      onClick={isAuthenticated ? onButtonClick : undefined}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = LANDING_COLORS.primaryHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = LANDING_COLORS.primary;
      }}
      className={`px-4 sm:px-6 py-2.5 text-sm font-medium rounded-lg transition-all shadow-lg hover:shadow-xl whitespace-nowrap inline-flex items-center justify-center ${className}`}
      style={{ backgroundColor: LANDING_COLORS.primary, color: LANDING_COLORS.background }}
    >
      {label}
    </Link>
  );
}

export function LandingHeader({
  isAuthenticated,
  activeSection,
  onNavClick,
  onButtonClick,
  onEnterpriseNavClick,
}: LandingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMobileNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    onNavClick(e, targetId);
    setMobileMenuOpen(false);
  };

  const handleMobileEnterpriseClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onEnterpriseNavClick?.(e, 'team_cta_nav');
    setMobileMenuOpen(false);
  };

  return (
    <header
      className="sticky top-0 z-50 landing-sticky-header border-b w-full"
      style={{
        borderColor: LANDING_COLORS.borderOverlay,
      }}
    >
      <div className="container mx-auto px-4" style={{ maxWidth: '1400px' }}>
        <div className="flex h-20 items-center justify-between gap-3">
          <Link
            href="/"
            className="flex min-w-0 shrink items-center"
            onClick={(e) => onNavClick(e, '#')}
          >
            <AssetMemWordmark size="header" className="truncate" />
          </Link>

          <nav className="hidden xl:flex items-center gap-5 2xl:gap-6">
            {NAV_LINKS.map((link) => (
              <DesktopNavLink
                key={link.sectionId || 'home'}
                {...link}
                activeSection={activeSection}
                onNavClick={onNavClick}
              />
            ))}
            <Link
              href="/solutions"
              className="text-sm font-medium whitespace-nowrap transition-all duration-300"
              style={{ color: LANDING_COLORS.foreground70 }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = LANDING_COLORS.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = LANDING_COLORS.foreground70;
              }}
            >
              Solutions
            </Link>
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
                  <Link
                    href="/solutions"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg px-3 py-3 text-base font-medium transition-colors"
                    style={{ color: LANDING_COLORS.foreground70 }}
                  >
                    Solutions
                  </Link>
                </nav>
                <div className="mt-8 border-t pt-6 space-y-3" style={{ borderColor: LANDING_COLORS.borderOverlay }}>
                  <LandingCta
                    isAuthenticated={isAuthenticated}
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
              <LandingCta
                isAuthenticated={isAuthenticated}
                onButtonClick={onButtonClick}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
