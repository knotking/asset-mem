import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { buildPageMetadata } from '@/lib/metadata-shared';
import { getSiteUrl, getSupportEmail, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = buildPageMetadata({
  title: `Delete Your Account | ${SITE_NAME}`,
  description: `How to delete your ${SITE_NAME} account in the mobile app or on the web.`,
  path: '/account-deletion',
});

const LAST_UPDATED = 'May 25, 2026';

export default function AccountDeletionPage() {
  const supportEmail = getSupportEmail();
  const siteUrl = getSiteUrl();

  return (
    <LegalPageShell title="Delete your account" lastUpdated={LAST_UPDATED}>
      <p>
        {SITE_NAME} lets you <strong>start account deletion in the app</strong>, as required by the
        Apple App Store and Google Play. This page describes what happens and how to request removal
        of stored property data.
      </p>

      <h2>Delete in the mobile app (iOS or Android)</h2>
      <ol>
        <li>Sign in to the AssetMem AI app.</li>
        <li>Open <strong>Settings</strong>.</li>
        <li>Scroll to <strong>Delete account</strong> and confirm.</li>
      </ol>
      <p>
        If you use Google or Apple sign-in and see a security error, sign out, sign in again, then
        retry deletion.
      </p>

      <h2>Delete on the web</h2>
      <ol>
        <li>
          Sign in at{' '}
          <a href={`${siteUrl}/login`}>{siteUrl}/login</a>.
        </li>
        <li>
          Go to <strong>Settings</strong> → <strong>Account</strong> → <strong>Delete account</strong>.
        </li>
      </ol>

      <h2>What is removed immediately</h2>
      <ul>
        <li>Your Firebase authentication account (you can no longer sign in).</li>
        <li>Access to the app and web dashboard with that login.</li>
      </ul>

      <h2>What may be retained</h2>
      <p>
        Property photos, documents, chat history, usage logs, and related records may remain for a
        limited period for security, fraud prevention, legal compliance, dispute resolution, and
        backup integrity. We do not sell your personal information.
      </p>
      <p>
        To request <strong>complete erasure</strong> of stored property data, email{' '}
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a> from the address on your account.
      </p>

      <h2>Subscriptions and billing</h2>
      <p>
        Paid plans are managed through Stripe on the web. Deleting your account does{' '}
        <strong>not</strong> automatically cancel a subscription. Before deleting, open{' '}
        <strong>Plan &amp; billing</strong> in Settings (web or mobile billing handoff) and cancel
        if needed.
      </p>

      <h2>More information</h2>
      <p>
        See our <Link href="/privacy">Privacy Policy</Link> for retention and your rights. Questions:{' '}
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
      </p>
    </LegalPageShell>
  );
}
