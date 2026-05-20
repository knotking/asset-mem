'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStoredUtmParams } from '@/lib/analytics';

const DISMISS_KEY = 'homeapp_ph_welcome_dismissed';

export function ProductHuntWelcomeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    const utm = getStoredUtmParams();
    if (utm.utm_source?.toLowerCase() === 'producthunt') {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 shrink-0 text-primary mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">Welcome from Product Hunt</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try AssetMem AI in three steps: add a property, upload a photo or document, then ask
            your first question in AI Chat.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 h-8 w-8"
          onClick={dismiss}
          aria-label="Dismiss welcome message"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
