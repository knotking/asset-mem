import React from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Building2,
  FileUp,
  MessageSquare,
  CheckCircle2,
  Circle,
  Clock,
  X,
} from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Property } from '@homeapp/common/types';
import { usePreferences } from '@homeapp/common/contexts/preferences-context';
import {
  getOnboardingStepStates,
  shouldHideOnboardingChecklist,
  ONBOARDING_CHAT_OPEN_PARAM,
  type OnboardingStepId,
} from '@homeapp/common/lib/home-onboarding';

type HomeOnboardingChecklistProps = {
  properties: Property[];
  onAddProperty: () => void;
};

export function HomeOnboardingChecklist({
  properties,
  onAddProperty,
}: HomeOnboardingChecklistProps) {
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

  const openChatFromChecklist = () => {
    if (!propertyId) {
      return;
    }
    router.push({
      pathname: '/home/property-details',
      params: {
        id: propertyId,
        tab: 'chat',
        [ONBOARDING_CHAT_OPEN_PARAM]: '1',
      },
    });
  };

  const stepConfigs = [
    {
      id: 'add_property' as const,
      title: 'Add your first property',
      description: 'Create a property and set its address.',
      done: stepDone('add_property'),
      icon: Building2,
      onPress: onAddProperty,
      actionLabel: 'Add property',
    },
    {
      id: 'upload' as const,
      title: 'Upload a photo or document',
      description:
        'Warranties, manuals, or a photo of an issue help the AI give better answers.',
      done: stepDone('upload'),
      icon: FileUp,
      onPress: propertyId
        ? () =>
            router.push({
              pathname: '/home/property-details',
              params: { id: propertyId, tab: 'details' },
            })
        : undefined,
      actionLabel: 'Upload document',
    },
    {
      id: 'checkpoint' as const,
      title: 'Create a visual checkpoint',
      description: 'Capture condition over time on the Timeline tab.',
      done: stepDone('checkpoint'),
      icon: Clock,
      onPress: propertyId
        ? () =>
            router.push({
              pathname: '/home/property-details',
              params: { id: propertyId, tab: 'timeline' },
            })
        : undefined,
      actionLabel: 'Open Timeline',
    },
    {
      id: 'first_chat' as const,
      title: 'Ask your first question',
      description:
        'Try “Give me a complete analysis of my property’s issues” — or describe something you see.',
      done: stepDone('first_chat'),
      icon: MessageSquare,
      onPress: propertyId ? openChatFromChecklist : undefined,
      actionLabel: 'Open AI Chat',
    },
  ];

  const dismissChecklist = () => {
    void updatePreferences({ onboardingChecklistDismissed: true });
  };

  return (
    <Card className="mb-6 border-dashed">
      <CardHeader className="pb-2">
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            <CardTitle className="text-lg">
              {allDone ? 'All steps complete' : 'Get started in 4 steps'}
            </CardTitle>
            <CardDescription>
              {allDone
                ? 'Nice work — dismiss this checklist when you are ready.'
                : `${completedCount} of ${totalSteps} complete — follow this path to your first AI-powered home insight.`}
            </CardDescription>
          </View>
          <Pressable
            onPress={dismissChecklist}
            accessibilityRole="button"
            accessibilityLabel="Dismiss checklist"
            hitSlop={8}
            className="rounded-md p-1">
            <Icon as={X} size={18} className="text-muted-foreground" />
          </Pressable>
        </View>
      </CardHeader>
      <CardContent className="gap-4 pt-0">
        {stepConfigs.map((step, index) => {
          const StepIcon = step.icon;
          const isDone = step.done;
          const isLocked = index > 0 && !stepConfigs[index - 1].done && !isDone;

          return (
            <View
              key={step.id}
              className="gap-3 rounded-lg border border-border bg-muted/30 p-4">
              <View className="flex-row gap-3">
                <Icon
                  as={isDone ? CheckCircle2 : Circle}
                  size={20}
                  className={isDone ? 'text-green-600' : 'text-muted-foreground'}
                />
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Icon as={StepIcon} size={16} className="text-muted-foreground" />
                    <Text className="font-medium text-foreground">{step.title}</Text>
                  </View>
                  <Text className="mt-0.5 text-sm text-muted-foreground">{step.description}</Text>
                </View>
              </View>
              {!isDone && step.onPress ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isLocked}
                  onPress={step.onPress}
                  className="self-start">
                  <Text>{step.actionLabel}</Text>
                </Button>
              ) : null}
            </View>
          );
        })}
        {allDone ? (
          <Button variant="secondary" size="sm" onPress={dismissChecklist} className="self-start">
            <Text>Dismiss checklist</Text>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
