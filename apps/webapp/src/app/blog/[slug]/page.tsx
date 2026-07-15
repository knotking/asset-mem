import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { buildPageMetadata } from '@/lib/metadata-shared';
import { SITE_NAME } from '@/lib/site';
import { BLOG_POSTS, getBlogPost, type BlogSection } from '@/lib/blog-posts';
import { LANDING_COLORS } from '@/lib/landing-theme';
import { AssetMemWordmark } from '@/components/brand/asset-mem-wordmark';
import { RelatedPostCard } from '../blog-post-card';

const CATEGORY_COLORS: Record<string, string> = {
  primary: LANDING_COLORS.primary,
  accent: LANDING_COLORS.accent,
  green: '#4ade80',
};

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return buildPageMetadata({
    title: `${post.title} | ${SITE_NAME}`,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
  });
}

function renderSection(section: BlogSection, index: number) {
  switch (section.type) {
    case 'paragraph':
      return (
        <p
          key={index}
          className="text-base sm:text-lg leading-relaxed font-light"
          style={{ color: LANDING_COLORS.foreground90 }}
        >
          {section.text}
        </p>
      );

    case 'heading':
      return (
        <h2
          key={index}
          className="text-xl sm:text-2xl font-semibold mt-2"
          style={{ color: LANDING_COLORS.foreground }}
        >
          {section.text}
        </h2>
      );

    case 'quote':
      return (
        <blockquote
          key={index}
          className="border-l-4 pl-6 py-1 space-y-2"
          style={{ borderColor: LANDING_COLORS.primary }}
        >
          <p
            className="text-base sm:text-lg italic font-light leading-relaxed"
            style={{ color: LANDING_COLORS.foreground }}
          >
            {section.text}
          </p>
          {section.attribution && (
            <cite className="text-sm not-italic" style={{ color: LANDING_COLORS.mutedForeground }}>
              — {section.attribution}
            </cite>
          )}
        </blockquote>
      );

    case 'list':
      return (
        <ul key={index} className="space-y-2 pl-1">
          {section.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: LANDING_COLORS.primary }}
              />
              <span
                className="text-base sm:text-lg leading-relaxed font-light"
                style={{ color: LANDING_COLORS.foreground90 }}
              >
                {item}
              </span>
            </li>
          ))}
        </ul>
      );

    case 'divider':
      return (
        <hr
          key={index}
          className="border-0 h-px my-2"
          style={{ backgroundColor: LANDING_COLORS.border }}
        />
      );
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const color = CATEGORY_COLORS[post.categoryColor] ?? LANDING_COLORS.primary;
  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug);

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

      <main className="container mx-auto px-4 py-12 sm:py-20" style={{ maxWidth: '720px' }}>
        {/* Back link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm mb-10 opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: LANDING_COLORS.mutedForeground }}
        >
          <ArrowLeft size={16} />
          All stories
        </Link>

        {/* Post header */}
        <div className="space-y-4 mb-12">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="text-xs font-semibold tracking-wider px-3 py-1 rounded-full"
              style={{ backgroundColor: color + '18', color }}
            >
              {post.category.toUpperCase()}
            </span>
            <span className="text-xs" style={{ color: LANDING_COLORS.mutedForeground }}>
              {post.date} · {post.readTime}
            </span>
          </div>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-light leading-tight tracking-tight"
            style={{ color: LANDING_COLORS.foreground }}
          >
            {post.title}
          </h1>
          <p
            className="text-lg sm:text-xl font-light leading-relaxed"
            style={{ color: LANDING_COLORS.mutedForeground }}
          >
            {post.subtitle}
          </p>
        </div>

        {/* Post content */}
        <div className="space-y-7">
          {post.content.map((section, i) => renderSection(section, i))}
        </div>

        {/* CTA */}
        <div
          className="mt-16 rounded-2xl border p-8 text-center space-y-4"
          style={{
            borderColor: LANDING_COLORS.primaryBorder,
            backgroundColor: LANDING_COLORS.primaryLight,
          }}
        >
          <p className="text-lg font-medium" style={{ color: LANDING_COLORS.foreground }}>
            Start documenting your properties
          </p>
          <p className="text-sm" style={{ color: LANDING_COLORS.mutedForeground }}>
            Free to try. No credit card required.
          </p>
          <Link
            href="/home"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: LANDING_COLORS.primary, color: '#0a0a0f' }}
          >
            Get started free
          </Link>
        </div>

        {/* More stories */}
        {related.length > 0 && (
          <div className="mt-16">
            <h3
              className="text-lg font-semibold mb-6"
              style={{ color: LANDING_COLORS.foreground }}
            >
              More stories
            </h3>
            <div className="space-y-4">
              {related.map((p) => (
                <RelatedPostCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        )}
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
