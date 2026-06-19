'use client';

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HELP_ARTICLES, hasDismissedFeatureTips, resolveDiscoveryProperty } from '@/lib/feature-discovery';
import { usePreferences } from '@/contexts/preferences-context';
import { usePropertiesDashboard } from '@/contexts/properties-dashboard-context';
import { useToast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { APP_SECTION_TITLE_CLASS } from '@/lib/app-typography';
import { cn } from '@/lib/utils';

export function HelpHubSettings() {
  const router = useRouter();
  const { toast } = useToast();
  const { properties } = usePropertiesDashboard();
  const { preferences, resetFeatureTipsDismissed } = usePreferences();
  const [resettingTips, setResettingTips] = useState(false);
  const canResetTips = hasDismissedFeatureTips(preferences);
  const property = resolveDiscoveryProperty(properties, preferences);
  const propertyId = property?.id;

  const openPropertyPath = (suffix: string) => {
    if (!propertyId) {
      router.push('/home');
      return;
    }
    router.push(`/home/properties/${propertyId}${suffix}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn(APP_SECTION_TITLE_CLASS, 'flex items-center gap-2')}>
          <BookOpen className="h-5 w-5" />
          How to use AssetMem AI
        </CardTitle>
        <CardDescription>
          Short guides to checkpoints, chat modes, comparisons, and usage limits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {HELP_ARTICLES.map((article) => (
          <div key={article.id} className="rounded-lg border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold text-foreground">{article.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{article.summary}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {article.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openPropertyPath('/checkpoints')}
          >
            Open Timeline
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openPropertyPath('/chat')}
          >
            Open AI Chat
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push('/home/settings?tab=usage')}
          >
            AI usage
          </Button>
        </div>
        <div className="rounded-lg border border-dashed p-4">
          <h3 className="text-sm font-semibold text-foreground">Contextual tips</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Dismissed tips in chat, timeline, and property views stay hidden until you turn them
            back on.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={!canResetTips || resettingTips}
            onClick={async () => {
              setResettingTips(true);
              try {
                await resetFeatureTipsDismissed();
                trackEvent('feature_tips_reset');
                toast({ title: 'Contextual tips will show again when relevant.' });
              } catch {
                toast({
                  variant: 'destructive',
                  title: 'Could not reset tips',
                  description: 'Try again in a moment.',
                });
              } finally {
                setResettingTips(false);
              }
            }}
          >
            {resettingTips ? 'Resetting…' : 'Show contextual tips again'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
