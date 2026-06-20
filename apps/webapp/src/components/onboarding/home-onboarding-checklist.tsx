'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  FileUp,
  MessageSquare,
  CheckCircle2,
  Circle,
  Clock,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Property } from '@/lib/types';
import { trackEvent } from '@/lib/analytics';
import { usePreferences } from '@/contexts/preferences-context';
import {
  getOnboardingStepStates,
  shouldHideOnboardingChecklist,
  ONBOARDING_CHAT_OPEN_PARAM,
  type OnboardingStepId,
} from '@/lib/home-onboarding';
import { APP_SECTION_TITLE_CLASS } from '@/lib/app-typography';

type HomeOnboardingChecklistProps = {
  properties: Property[];
};

export function HomeOnboardingChecklist({ properties }: HomeOnboardingChecklistProps) {
  const router = useRouter();
  const { preferences, updatePreferences } = usePreferences();

  if (shouldHideOnboardingChecklist(properties, preferences)) {
    return null;
  }

  const { propertyId, steps, completedCount, totalSteps, allDone } = getOnboardingStepStates(
    properties,
    preferences
  );
  const stepDone = (id: OnboardingStepId) => steps.find((step) => step.id === id)?.done ?? false;

  const trackStep = (step: string) => {
    trackEvent('onboarding_step_click', { step });
  };

  const openChatFromChecklist = () => {
    if (!propertyId) {
      return;
    }
    trackStep('first_chat');
    router.push(
      `/home/properties/${propertyId}/chat?${ONBOARDING_CHAT_OPEN_PARAM}=1`
    );
  };

  const dismissChecklist = () => {
    void updatePreferences({ onboardingChecklistDismissed: true });
  };

  const stepsConfig = [
    {
      id: 'add_property' as const,
      title: 'Add your first property',
      description: 'Create a property and set its address.',
      done: stepDone('add_property'),
      icon: Building2,
      action: () => {
        trackStep('add_property');
        router.push('/home/properties/new-property/details');
      },
      actionLabel: 'Add property',
    },
    {
      id: 'upload' as const,
      title: 'Upload a photo or document',
      description: 'Warranties, manuals, or a photo of an issue help the AI give better answers.',
      done: stepDone('upload'),
      icon: FileUp,
      href: propertyId ? `/home/properties/${propertyId}/details` : undefined,
      actionLabel: 'Upload document',
    },
    {
      id: 'checkpoint' as const,
      title: 'Create a visual checkpoint',
      description: 'Capture condition over time on the Timeline tab.',
      done: stepDone('checkpoint'),
      icon: Clock,
      href: propertyId ? `/home/properties/${propertyId}/checkpoints` : undefined,
      actionLabel: 'Open Timeline',
    },
    {
      id: 'first_chat' as const,
      title: 'Ask your first question',
      description:
        'Try “Give me a complete analysis of my issues” — or describe something you see.',
      done: stepDone('first_chat'),
      icon: MessageSquare,
      action: propertyId ? openChatFromChecklist : undefined,
      actionLabel: 'Open AI Chat',
    },
  ];

  return (
    <Card className="mb-8 border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className={APP_SECTION_TITLE_CLASS}>
              {allDone ? 'All steps complete' : 'Get started in 4 steps'}
            </CardTitle>
            <CardDescription>
              {allDone
                ? 'Nice work — dismiss this checklist when you are ready.'
                : `${completedCount} of ${totalSteps} complete — follow this path to your first AI-powered home insight.`}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={dismissChecklist}
            aria-label="Dismiss checklist"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {stepsConfig.map((step, index) => {
          const StepIcon = step.icon;
          const isDone = step.done;
          const isLocked = index > 0 && !stepsConfig[index - 1].done && !isDone;

          return (
            <div
              key={step.id}
              className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex gap-3">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-foreground flex items-center gap-2">
                    <StepIcon className="h-4 w-4 text-muted-foreground" />
                    {step.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
                </div>
              </div>
              {!isDone &&
                (step.href ? (
                  <Button variant="secondary" size="sm" asChild className="shrink-0">
                    <Link
                      href={step.href}
                      onClick={() => trackStep(step.id)}
                      aria-disabled={isLocked}
                      className={isLocked ? 'pointer-events-none opacity-50' : undefined}
                    >
                      {step.actionLabel}
                    </Link>
                  </Button>
                ) : step.action ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={step.action}
                    disabled={isLocked}
                  >
                    {step.actionLabel}
                  </Button>
                ) : null)}
            </div>
          );
        })}
        {allDone ? (
          <Button variant="secondary" size="sm" className="self-start" onClick={dismissChecklist}>
            Dismiss checklist
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
