import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { buildPageMetadata } from '@/lib/metadata-shared';
import { getSupportEmail, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = buildPageMetadata({
  title: `About | ${SITE_NAME}`,
  description: `About ${SITE_NAME} — intelligent home care and property diagnostics.`,
  path: '/about',
});

const LAST_UPDATED = 'May 19, 2026';

export default function AboutPage() {
  const supportEmail = getSupportEmail();

  return (
    <LegalPageShell title={`About ${SITE_NAME}`} lastUpdated={LAST_UPDATED}>
      <p>
        {SITE_NAME} is an AI-powered home care platform that helps homeowners and property managers
        understand, document, and maintain their properties.
      </p>
      <p>With {SITE_NAME} you can:</p>
      <ul>
        <li>Chat with specialized AI agents about maintenance, repairs, and documents;</li>
        <li>Track property checkpoints over time with photo-based analysis;</li>
        <li>Upload warranties, manuals, and receipts for retrieval-augmented answers.</li>
      </ul>
      <p>
        We combine multimodal AI (Google Vertex AI and Gemini) with secure cloud storage so your
        property context stays in one place.
      </p>
      <p>
        <Link href="/login" className="text-primary underline underline-offset-4">
          Get started
        </Link>{' '}
        or contact us at <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
      </p>
    </LegalPageShell>
  );
}
