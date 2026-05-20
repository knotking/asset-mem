import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { buildPageMetadata } from '@/lib/metadata-shared';
import { getSupportEmail, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = buildPageMetadata({
  title: `Privacy Policy | ${SITE_NAME}`,
  description: `How ${SITE_NAME} collects, uses, and protects your personal and property data.`,
  path: '/privacy',
});

const LAST_UPDATED = 'May 19, 2026';

export default function PrivacyPage() {
  const supportEmail = getSupportEmail();

  return (
    <LegalPageShell title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        This Privacy Policy describes how {SITE_NAME} (&quot;we,&quot; &quot;us,&quot; or
        &quot;our&quot;) collects, uses, and shares information when you use our website and
        related services (the &quot;Service&quot;).
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information:</strong> email address and authentication identifiers
          when you create an account.
        </li>
        <li>
          <strong>Property data:</strong> property names, addresses, photos, videos, documents,
          and maintenance records you upload or create.
        </li>
        <li>
          <strong>Usage data:</strong> chat messages, session metadata, feature interactions, and
          technical logs (including request identifiers for support and security).
        </li>
        <li>
          <strong>Device and analytics data:</strong> browser type, approximate location (if you
          enable location-based features), and analytics events when you consent via our analytics
          tools.
        </li>
      </ul>

      <h2>How we use information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>Provide AI-assisted property diagnostics, document analysis, and chat features;</li>
        <li>Store and sync your properties, checkpoints, and documents;</li>
        <li>Enforce usage limits, prevent abuse, and improve reliability;</li>
        <li>Communicate with you about the Service and respond to support requests.</li>
      </ul>

      <h2>AI processing</h2>
      <p>
        Content you submit (including images, documents, and messages) may be processed by
        third-party AI and cloud providers (e.g., Google Cloud / Vertex AI, Gemini) to generate
        responses. Do not submit information you are not authorized to share.
      </p>

      <h2>Sharing</h2>
      <p>
        We do not sell your personal information. We share data with service providers that help us
        operate the Service (hosting, authentication, storage, AI inference) under contractual
        obligations. If you use shared chat links, content you choose to share may be readable by
        anyone with the link.
      </p>

      <h2>Retention</h2>
      <p>
        We retain your data while your account is active and as needed to provide the Service,
        comply with law, and resolve disputes. You may request deletion of your account and
        associated data by contacting us (self-service deletion may be added in a future release).
      </p>

      <h2>Security</h2>
      <p>
        We use industry-standard measures including encryption in transit, access controls, and
        Firebase security rules. No method of transmission or storage is 100% secure.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, delete, or export your
        personal data. Contact us at{' '}
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a> to exercise these rights.
      </p>

      <h2>Children</h2>
      <p>The Service is not directed to children under 13, and we do not knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>We may update this policy from time to time. We will post the revised date at the top of this page.</p>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
      </p>
    </LegalPageShell>
  );
}
