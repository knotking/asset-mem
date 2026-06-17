'use client';

import { HomeownerHeroGraphic } from './homeowner-hero-graphic';
import { PortfolioHeroGraphic } from './portfolio-hero-graphic';

export type HeroGraphicVariant = 'homeowner' | 'portfolio';

type AIGraphicProps = {
  variant?: HeroGraphicVariant;
};

/** Hero mockup — homeowner timeline (default) or B2B portfolio overview. */
export default function AIGraphic({ variant = 'homeowner' }: AIGraphicProps) {
  if (variant === 'portfolio') {
    return <PortfolioHeroGraphic />;
  }
  return <HomeownerHeroGraphic />;
}
