'use client';

import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Circle,
  MessageSquare,
  Sparkles,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Property } from '@/lib/types';
import { trackEvent } from '@/lib/analytics';
import { usePreferences } from '@/contexts/preferences-context';
import {
  getDiscoveryStepStates,
  resolveDiscoveryProperty,
  shouldShowDiscoveryChecklist,
  type DiscoveryStepId,
} from '@/lib/feature-discovery';

type DiscoveryChecklistProps = {
  properties: Property[];
};

export function DiscoveryChecklist({ properties }: DiscoveryChecklistProps) {
  const router = useRouter();
  const { preferences, updatePreferences } = usePreferences();

  if (!shouldShowDiscoveryChecklist(properties, preferences)) {
    return null;
  }

  const property = resolveDiscoveryProperty(properties, preferences);
  const propertyId = property?.id;
  const { steps, completedCount, totalSteps, allDone } = getDiscoveryStepStates(preferences);
  const stepDone = (id: DiscoveryStepId) => steps.find((s) => s.id === id)?.done ?? false;

  const trackStep = (step: string) => {
    trackEvent('discovery_step_click', { step });
  };

  const dismiss = () => {
    void updatePreferences({ discoveryChecklistDismissed: true });
  };

  const stepsConfig = [
    {
      id: 'compare_checkpoints' as const,
      title: 'Compare two checkpoints',
      description: 'See visual and AI-described changes between two points in time.',
      icon: ArrowRightLeft,
      done: stepDone('compare_checkpoints'),
      actionLabel: 'Open Timeline',
      action: propertyId
        ? () => {
            trackStep('compare_checkpoints');
            router.push(`/home/properties/${propertyId}/checkpoints`);
          }
        : undefined,
    },
    {
      id: 'use_optional_agent' as const,
      title: 'Try an optional agent',
      description: 'Enable coverage, DIY, service, or cost in Checkpoint chat settings.',
      icon: Sparkles,
      done: stepDone('use_optional_agent'),
      actionLabel: 'Open AI Chat',
      action: propertyId
        ? () => {
            trackStep('use_optional_agent');
            router.push(`/home/properties/${propertyId}/chat`);
          }
        : undefined,
    },
    {
      id: 'multi_checkpoint_chat' as const,
      title: 'Chat with multiple checkpoints',
      description: 'Select two or more checkpoints in chat, then ask for a combined analysis.',
      icon: MessageSquare,
      done: stepDone('multi_checkpoint_chat'),
      actionLabel: 'Open AI Chat',
      action: propertyId
        ? () => {
            trackStep('multi_checkpoint_chat');
            router.push(`/home/properties/${propertyId}/chat`);
          }
        : undefined,
    },
    {
      id: 'review_ai_usage' as const,
      title: 'Review AI usage',
      description: 'See monthly tokens, document extractions, and checkpoint analysis counts.',
      icon: Building2,
      done: stepDone('review_ai_usage'),
      actionLabel: 'AI usage settings',
      action: () => {
        trackStep('review_ai_usage');
        void updatePreferences({ discoveryAiUsageViewed: true });
        router.push('/home/settings?tab=usage');
      },
    },
  ];

  return (
    <Card className="mb-8 border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg">
              {allDone ? 'Explore more features' : 'Discover what you can do next'}
            </CardTitle>
            <CardDescription>
              {allDone
                ? 'You have tried the main workflows — dismiss when ready.'
                : `${completedCount} of ${totalSteps} — go beyond the basics.`}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={dismiss}
            aria-label="Dismiss discovery checklist"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {stepsConfig.map((step) => {
          const StepIcon = step.icon;
          return (
            <div key={step.id} className="flex gap-3">
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
                {!step.done && step.action && step.actionLabel ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 text-xs"
                    onClick={step.action}
                  >
                    {step.actionLabel}
                  </Button>
                ) : null}
              </div>
              <StepIcon className="h-4 w-4 shrink-0 text-muted-foreground opacity-60" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
