import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { SupportEmailLink } from '@/components/legal/legal-support-email';
import { buildPageMetadata } from '@/lib/metadata-shared';
import { SITE_HERO_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from '@/lib/site';

export const metadata: Metadata = buildPageMetadata({
  title: `About | ${SITE_NAME}`,
  description: `About ${SITE_NAME} — ${SITE_HERO_DESCRIPTION}`,
  path: '/about',
});

const LAST_UPDATED = 'June 17, 2026';

export default function AboutPage() {
  return (
    <LegalPageShell title={`About ${SITE_NAME}`} lastUpdated={LAST_UPDATED}>
      <p>
        {SITE_NAME} is {SITE_TAGLINE.toLowerCase()} for property evidence—built for one home
        or an entire portfolio. {SITE_HERO_DESCRIPTION}
      </p>
      <p>
        Property managers, insurers, field teams, and homeowners use AssetMem to capture
        evidence on site, compare condition over time on a property timeline, and turn that
        history into audit-ready reports.
      </p>
      <p>
        Our mission is to make property decisions defensible and faster by giving every team a
        trusted timeline of what changed, why it matters, and what to do next.
      </p>
      <p>With {SITE_NAME} you can:</p>
      <ul>
        <li>
          Capture structured photos and documents on site—per property or across a portfolio;
        </li>
        <li>
          See what changed with AI condition scoring and answers grounded in your evidence;
        </li>
        <li>
          Get repair guidance, cost outlook, and coverage context without tab-hopping;
        </li>
        <li>
          Generate formal reports and share links for owners, tenants, adjusters, or vendors.
        </li>
      </ul>
      <p>
        Photos, documents, and team questions feed one AI intelligence layer—from evidence in
        to prioritized next steps your team can act on.
      </p>
      <p>
        <Link href="/login" className="text-primary underline underline-offset-4">
          Get started
        </Link>{' '}
        or contact us at <SupportEmailLink className="text-primary underline underline-offset-4" />.
      </p>
    </LegalPageShell>
  );
}
