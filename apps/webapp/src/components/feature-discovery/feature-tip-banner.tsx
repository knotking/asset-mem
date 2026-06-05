'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FeatureTipId } from '@/lib/feature-discovery';

type FeatureTipBannerProps = {
  tipId: FeatureTipId;
  title: string;
  description: string;
  onDismiss: (tipId: FeatureTipId) => void;
  actionLabel?: string;
  onAction?: () => void;
};

export function FeatureTipBanner({
  tipId,
  title,
  description,
  onDismiss,
  actionLabel,
  onAction,
}: FeatureTipBannerProps) {
  return (
    <div
      className="mb-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3"
      role="note"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          {actionLabel && onAction ? (
            <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onDismiss(tipId)}
          aria-label="Dismiss tip"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
