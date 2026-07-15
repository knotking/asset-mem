'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LANDING_COLORS } from '@/lib/landing-theme';
import type { BlogPost } from '@/lib/blog-posts';

const CATEGORY_COLORS: Record<string, string> = {
  primary: LANDING_COLORS.primary,
  accent: LANDING_COLORS.accent,
  green: '#4ade80',
};

export function BlogPostCard({ post }: { post: BlogPost }) {
  const color = CATEGORY_COLORS[post.categoryColor] ?? LANDING_COLORS.primary;
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col rounded-2xl border p-7 transition-all duration-200"
      style={{ backgroundColor: LANDING_COLORS.card, borderColor: LANDING_COLORS.border }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = color + '44';
        (e.currentTarget as HTMLElement).style.backgroundColor = LANDING_COLORS.muted;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = LANDING_COLORS.border;
        (e.currentTarget as HTMLElement).style.backgroundColor = LANDING_COLORS.card;
      }}
    >
      <div className="space-y-3 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
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
        <h3 className="text-base font-medium leading-snug" style={{ color: LANDING_COLORS.foreground }}>
          {post.title}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: LANDING_COLORS.mutedForeground }}>
          {post.excerpt}
        </p>
      </div>
      <div className="mt-5 flex items-center gap-1">
        <span
          className="text-sm font-medium transition-all duration-200 group-hover:underline"
          style={{ color }}
        >
          Read story
        </span>
        <ArrowRight
          className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
          style={{ color }}
        />
      </div>
    </Link>
  );
}

export function RelatedPostCard({ post }: { post: BlogPost }) {
  const color = CATEGORY_COLORS[post.categoryColor] ?? LANDING_COLORS.primary;
  return (
    <Link
      key={post.slug}
      href={`/blog/${post.slug}`}
      className="group flex items-start gap-4 rounded-xl border p-5 transition-colors"
      style={{ borderColor: LANDING_COLORS.border, backgroundColor: LANDING_COLORS.card }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = color + '44';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = LANDING_COLORS.border;
      }}
    >
      <div className="flex-1 space-y-1">
        <span className="text-xs font-semibold tracking-wider" style={{ color }}>
          {post.category.toUpperCase()}
        </span>
        <p className="text-sm font-medium leading-snug" style={{ color: LANDING_COLORS.foreground }}>
          {post.title}
        </p>
      </div>
      <ArrowRight
        className="shrink-0 mt-0.5 transition-transform group-hover:translate-x-1"
        size={16}
        style={{ color: LANDING_COLORS.mutedForeground }}
      />
    </Link>
  );
}
