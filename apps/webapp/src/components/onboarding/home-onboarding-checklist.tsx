'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, FileUp, MessageSquare, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Property } from '@/lib/types';
import { trackEvent } from '@/lib/analytics';

type HomeOnboardingChecklistProps = {
  properties: Property[];
};

export function HomeOnboardingChecklist({ properties }: HomeOnboardingChecklistProps) {
  const router = useRouter();
  const hasProperty = properties.length > 0;
  const firstProperty = properties[0];
  const hasDocuments =
    hasProperty &&
    (firstProperty.documents?.length ?? 0) > 0;

  if (hasProperty && hasDocuments) {
    return null;
  }

  const trackStep = (step: string) => {
    trackEvent('onboarding_step_click', { step });
  };

  const steps = [
    {
      id: 'add_property',
      title: 'Add your first property',
      description: 'Create a property and set its address.',
      done: hasProperty,
      icon: Building2,
      action: () => {
        trackStep('add_property');
        router.push('/home/properties/new-property/details');
      },
      actionLabel: 'Add property',
    },
    {
      id: 'upload',
      title: 'Upload a photo or document',
      description: 'Warranties, manuals, or a photo of an issue help the AI give better answers.',
      done: hasDocuments,
      icon: FileUp,
      href: hasProperty
        ? `/home/properties/${firstProperty.id}/details`
        : undefined,
      actionLabel: 'Open property details',
    },
    {
      id: 'first_chat',
      title: 'Ask your first question',
      description: 'Try “What maintenance should I plan this season?” or describe something you see.',
      done: false,
      icon: MessageSquare,
      href: hasProperty ? `/home/properties/${firstProperty.id}/chat` : undefined,
      actionLabel: 'Open AI Chat',
    },
  ];

  return (
    <Card className="mb-8 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Get started in 3 steps</CardTitle>
        <CardDescription>
          New here? Follow this quick path to your first AI-powered home insight.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isDone = step.done;
          const isLocked = index > 0 && !steps[index - 1].done && !isDone;

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
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {step.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
                </div>
              </div>
              {!isDone && (
                step.href ? (
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
                ) : null
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
