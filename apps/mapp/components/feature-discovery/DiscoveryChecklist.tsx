import React from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowRightLeft,
  CheckCircle2,
  Circle,
  MessageSquare,
  Sparkles,
  X,
  Activity,
} from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Property } from '@homeapp/common/types';
import { usePreferences } from '@homeapp/common/contexts/preferences-context';
import {
  getDiscoveryStepStates,
  resolveDiscoveryProperty,
  shouldShowDiscoveryChecklist,
  type DiscoveryStepId,
} from '@homeapp/common/lib/feature-discovery';

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

  const dismiss = () => {
    void updatePreferences({ discoveryChecklistDismissed: true });
  };

  const stepsConfig = [
    {
      id: 'compare_checkpoints' as const,
      title: 'Compare two checkpoints',
      description: 'Long-press to select two checkpoints and review AI-detected changes.',
      done: stepDone('compare_checkpoints'),
      actionLabel: 'Open Timeline',
      onPress: propertyId
        ? () =>
            router.push({
              pathname: '/home/property-details',
              params: { id: propertyId, tab: 'timeline' },
            })
        : undefined,
    },
    {
      id: 'use_optional_agent' as const,
      title: 'Try an optional agent',
      description: 'Enable coverage, DIY, service, or cost in Checkpoint chat settings.',
      done: stepDone('use_optional_agent'),
      actionLabel: 'Open AI Chat',
      onPress: propertyId
        ? () =>
            router.push({
              pathname: '/home/property-details',
              params: { id: propertyId, tab: 'chat' },
            })
        : undefined,
    },
    {
      id: 'multi_checkpoint_chat' as const,
      title: 'Chat with multiple checkpoints',
      description: 'Select two or more checkpoints in chat, then ask for a combined analysis.',
      done: stepDone('multi_checkpoint_chat'),
      actionLabel: 'Open AI Chat',
      onPress: propertyId
        ? () =>
            router.push({
              pathname: '/home/property-details',
              params: { id: propertyId, tab: 'chat' },
            })
        : undefined,
    },
    {
      id: 'review_ai_usage' as const,
      title: 'Review AI usage',
      description: 'See monthly tokens, document extractions, and checkpoint analyses.',
      done: stepDone('review_ai_usage'),
      actionLabel: 'AI usage settings',
      onPress: () => {
        void updatePreferences({ discoveryAiUsageViewed: true });
        router.push('/(tabs)/settings/usage');
      },
    },
  ];

  return (
    <Card className="mb-6 border-dashed border-border">
      <CardHeader className="pb-2">
        <View className="flex-row items-start justify-between">
          <View className="min-w-0 flex-1 pr-2">
            <CardTitle className="text-lg">
              {allDone ? 'Explore more features' : 'Discover what you can do next'}
            </CardTitle>
            <CardDescription>
              {allDone
                ? 'You have tried the main workflows — dismiss when ready.'
                : `${completedCount} of ${totalSteps} — go beyond the basics.`}
            </CardDescription>
          </View>
          <Pressable onPress={dismiss} accessibilityLabel="Dismiss discovery checklist">
            <Icon as={X} size={18} className="text-muted-foreground" />
          </Pressable>
        </View>
      </CardHeader>
      <CardContent className="gap-4">
        {stepsConfig.map((step) => (
          <View key={step.id} className="flex-row gap-3">
            <Icon
              as={step.done ? CheckCircle2 : Circle}
              size={18}
              className={step.done ? 'text-primary' : 'text-muted-foreground'}
            />
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-medium text-foreground">{step.title}</Text>
              <Text className="text-xs text-muted-foreground">{step.description}</Text>
              {!step.done && step.onPress && step.actionLabel ? (
                <Pressable onPress={step.onPress} className="mt-1">
                  <Text className="text-xs font-medium text-primary">{step.actionLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </CardContent>
    </Card>
  );
}
