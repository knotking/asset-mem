import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { buildPageMetadata } from '@/lib/metadata-shared';
import { getSupportEmail, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = buildPageMetadata({
  title: `Terms of Service | ${SITE_NAME}`,
  description: `Terms governing use of ${SITE_NAME}.`,
  path: '/terms',
});

const LAST_UPDATED = 'May 19, 2026';

export default function TermsPage() {
  const supportEmail = getSupportEmail();

  return (
    <LegalPageShell title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of {SITE_NAME} and
        related services (the &quot;Service&quot;). By using the Service, you agree to these Terms.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be at least 18 years old (or the age of majority in your jurisdiction) and able to
        form a binding contract to use the Service.
      </p>

      <h2>Account</h2>
      <p>
        You are responsible for safeguarding your login credentials and for activity under your
        account. Notify us promptly of unauthorized use.
      </p>

      <h2>Your content</h2>
      <p>
        You retain ownership of content you upload. You grant us a license to host, process, and
        display your content solely to operate and improve the Service, including AI analysis of
        documents and media you submit.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for unlawful purposes or to infringe others&apos; rights;</li>
        <li>Upload malware, spam, or content you lack rights to use;</li>
        <li>Attempt to bypass security, quotas, or rate limits;</li>
        <li>Reverse engineer or scrape the Service except as permitted by law.</li>
      </ul>

      <h2>AI outputs</h2>
      <p>
        AI-generated guidance (diagnostics, cost estimates, DIY steps, coverage notes) is for
        informational purposes only and is not professional engineering, legal, insurance, or
        contractor advice. Verify critical decisions with qualified professionals.
      </p>

      <h2>Usage limits</h2>
      <p>
        We may apply fair-use limits, including monthly AI token quotas. We may modify limits with
        reasonable notice where practicable.
      </p>

      <h2>Disclaimer</h2>
      <p>
        THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
        INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL,
        SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL,
        ARISING FROM YOUR USE OF THE SERVICE.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate access for violation
        of these Terms or to protect the Service and other users.
      </p>

      <h2>Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, USA, without regard to
        conflict-of-law rules, except where mandatory consumer protections apply in your country.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
      </p>
    </LegalPageShell>
  );
}
