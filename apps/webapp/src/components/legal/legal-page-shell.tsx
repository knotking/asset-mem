import Link from 'next/link';
import { LegalSupportEmailProvider } from '@/components/legal/legal-support-email';

export function LegalPageShell({
  title,
  lastUpdated,
  sectionLabel = 'Legal',
  children,
}: {
  title: string;
  lastUpdated: string;
  sectionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <LegalSupportEmailProvider>
    <div className="relative min-h-svh w-full min-w-0 overflow-hidden bg-[#0a0a0f] text-slate-100">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom right, #0a0a0f, #0f172a, #0a0a0f)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(34,211,238,0.12), transparent 50%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 70% 80%, rgba(249,115,22,0.08), transparent 50%)',
        }}
      />

      <header className="relative border-b border-white/10">
        <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">
            AssetMem <span className="text-cyan-300">AI</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-slate-300 transition-colors hover:text-white"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="relative container mx-auto max-w-5xl px-4 py-12 lg:py-16">
        <div className="rounded-3xl border border-white/10 bg-slate-950/65 p-6 shadow-2xl backdrop-blur-sm sm:p-8 lg:p-10">
          <div className="mb-8 space-y-4">
            <span className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-200">
              {sectionLabel}
            </span>
            <h1 className="text-3xl font-light tracking-tight text-white sm:text-4xl">{title}</h1>
            <p className="text-sm text-slate-400">Last updated: {lastUpdated}</p>
          </div>

          <article className="prose prose-invert max-w-none prose-headings:font-semibold prose-headings:text-white prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-slate-100 prose-a:text-cyan-200 hover:prose-a:text-cyan-100">
            {children}
          </article>
        </div>
      </main>
    </div>
    </LegalSupportEmailProvider>
  );
}
