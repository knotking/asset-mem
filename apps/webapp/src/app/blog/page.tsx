import type { Metadata } from 'next';
import Link from 'next/link';
import { buildPageMetadata } from '@/lib/metadata-shared';
import { SITE_NAME } from '@/lib/site';
import { BLOG_POSTS } from '@/lib/blog-posts';
import { LANDING_COLORS } from '@/lib/landing-theme';
import { AssetMemWordmark } from '@/components/brand/asset-mem-wordmark';
import { BlogPostCard } from './blog-post-card';

export const metadata: Metadata = buildPageMetadata({
  title: `Stories | ${SITE_NAME}`,
  description:
    'Real usage stories from property managers, landlords, and HOA teams using AssetMem AI to protect their assets.',
  path: '/blog',
});

export default function BlogPage() {
  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor: LANDING_COLORS.background, color: LANDING_COLORS.foreground }}
    >
      {/* Header */}
      <header
        className="w-full border-b px-6 py-4 flex items-center justify-between"
        style={{
          borderColor: LANDING_COLORS.border,
          backgroundColor: LANDING_COLORS.background95,
        }}
      >
        <Link href="/">
          <AssetMemWordmark size="header" />
        </Link>
        <Link
          href="/home"
          className="text-sm font-medium px-4 py-2 rounded-lg"
          style={{
            backgroundColor: LANDING_COLORS.primaryLight,
            color: LANDING_COLORS.primary,
            border: `1px solid ${LANDING_COLORS.primaryBorder}`,
          }}
        >
          Open App
        </Link>
      </header>

      <main className="container mx-auto px-4 py-16 sm:py-24" style={{ maxWidth: '900px' }}>
        {/* Page heading */}
        <div className="mb-14 space-y-4">
          <div
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border"
            style={{
              backgroundColor: LANDING_COLORS.primaryLight,
              borderColor: LANDING_COLORS.primaryBorder,
            }}
          >
            <span
              className="text-sm font-semibold tracking-wide"
              style={{ color: LANDING_COLORS.primary }}
            >
              FROM THE FIELD
            </span>
          </div>
          <h1
            className="text-4xl font-light tracking-tight lg:text-5xl"
            style={{ color: LANDING_COLORS.foreground }}
          >
            Stories from people who{' '}
            <span
              style={{
                fontWeight: 700,
                background: `linear-gradient(90deg, ${LANDING_COLORS.primary}, #38bdf8)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              use it every day
            </span>
          </h1>
          <p
            className="text-lg font-light max-w-xl"
            style={{ color: LANDING_COLORS.mutedForeground }}
          >
            Real accounts from property managers, landlords, and HOA teams — how they caught
            problems early, won insurance claims, and simplified compliance audits.
          </p>
        </div>

        {/* Post list */}
        <div className="space-y-6">
          {BLOG_POSTS.map((post) => (
            <BlogPostCard key={post.slug} post={post} />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="border-t py-8 text-center text-sm"
        style={{ borderColor: LANDING_COLORS.border, color: LANDING_COLORS.mutedForeground }}
      >
        <Link href="/" style={{ color: LANDING_COLORS.mutedForeground }}>
          ← Back to {SITE_NAME}
        </Link>
        <span className="mx-3">·</span>© {new Date().getFullYear()} {SITE_NAME}
      </footer>
    </div>
  );
}
