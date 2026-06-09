'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getPublicReportSignedUrl } from '@/lib/api-reports';
import { Button } from '@/components/ui/button';
import { AssetMemBrandIcon } from '@/components/brand/asset-mem-brand-icon';
import { Loader2, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function isExpired(expiresAt: unknown): boolean {
  if (!expiresAt) return false;
  const ms =
    expiresAt && typeof expiresAt === 'object' && 'toMillis' in expiresAt
      ? (expiresAt as { toMillis: () => number }).toMillis()
      : new Date(String(expiresAt)).getTime();
  return Number.isFinite(ms) && Date.now() > ms;
}

export default function SharedReportPage() {
  const params = useParams();
  const shareId = params.shareId as string;
  const [title, setTitle] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const shareRef = doc(db, 'sharedReports', shareId);
        const shareSnap = await getDoc(shareRef);
        if (!shareSnap.exists()) {
          throw new Error('This shared report does not exist or was removed.');
        }
        const data = shareSnap.data();
        if (isExpired(data.expiresAt)) {
          throw new Error('This share link has expired. Ask the owner to create a new link.');
        }
        setTitle((data.title as string) || 'Property report');
        const url = await getPublicReportSignedUrl(shareId);
        setPdfUrl(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [shareId]);

  return (
    <div className="flex min-h-svh w-full min-w-0 flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
        <div className="flex min-w-0 items-center gap-2">
          <AssetMemBrandIcon size="sm" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground">AssetMem AI</h1>
            {title ? (
              <p className="truncate text-sm text-muted-foreground">{title}</p>
            ) : (
              <Skeleton className="mt-1 h-4 w-40" />
            )}
          </div>
        </div>
        {pdfUrl ? (
          <Button size="sm" variant="outline" asChild>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              View report
            </a>
          </Button>
        ) : null}
      </header>
      <main className="flex min-h-0 w-full flex-1 flex-col p-4 md:p-6">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading report…
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center px-4">
            <p className="max-w-lg text-center text-destructive">{error}</p>
          </div>
        ) : pdfUrl ? (
          <iframe
            title={title || 'Shared property report'}
            src={pdfUrl}
            className="min-h-0 w-full flex-1 rounded-lg border bg-card"
          />
        ) : null}
      </main>
    </div>
  );
}
