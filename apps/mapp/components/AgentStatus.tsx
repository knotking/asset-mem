import React, { useEffect, useRef, useState } from 'react';
import { View, Animated } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react-native';
import type { AgentStep } from '@homeapp/common/types';
import {
  prettifyAgentName,
  pickActiveAgentStep,
  formatAgentStepDuration,
} from '@homeapp/common/lib/agent-display';
import { Text } from '@/components/ui/text';

type Props = {
  steps: AgentStep[];
};

function SparkleAnimation() {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <Icon as={Sparkles} size={16} className="text-primary" />
    </Animated.View>
  );
}

function AnimatedThinkingText({ text }: { text: string }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerAnim]);

  const opacity1 = shimmerAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.5, 1, 0.5, 0.3, 0.5],
  });

  const opacity2 = shimmerAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.3, 0.5, 1, 0.5, 0.3],
  });

  const opacity3 = shimmerAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.5, 0.3, 0.5, 1, 0.5],
  });

  const safeText = text || ' ';
  const third = Math.max(1, Math.ceil(safeText.length / 3));
  return (
    <View className="flex-row flex-shrink min-w-0">
      <Animated.Text style={{ opacity: opacity1 }} className="font-medium text-primary">
        {safeText.slice(0, third)}
      </Animated.Text>
      <Animated.Text style={{ opacity: opacity2 }} className="font-medium text-primary">
        {safeText.slice(third, third * 2)}
      </Animated.Text>
      <Animated.Text style={{ opacity: opacity3 }} className="font-medium text-primary">
        {safeText.slice(third * 2)}
      </Animated.Text>
    </View>
  );
}

function StepStatusIcon({ status }: { status: AgentStep['status'] }) {
  if (status === 'completed') {
    return <Icon as={CheckCircle} size={14} className="text-success" />;
  }
  if (status === 'failed') {
    return <Icon as={AlertCircle} size={14} className="text-destructive" />;
  }
  if (status === 'transferredto') {
    return <Icon as={Sparkles} size={14} className="text-primary" />;
  }
  return <Icon as={Loader2} size={14} className="text-primary" />;
}

function stepLabel(step: AgentStep): string {
  return step.displayName ?? prettifyAgentName(step.name);
}

/** Re-render once a second while an active step is running so durations tick. */
function useTick(active: boolean): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

export function AgentStatus({ steps }: Props) {
  const activeStep = pickActiveAgentStep(steps);
  useTick(!!activeStep);

  if (!steps || steps.length === 0) return null;

  const listSteps = steps.filter((step) => step.status !== 'transferredto');
  const headerText = activeStep ? stepLabel(activeStep) : 'Thinking...';
  const headerPreview = activeStep?.preview;

  return (
    <View
      className="w-full rounded-xl border border-border bg-background p-4 shadow-sm"
      style={{ minWidth: 180 }}>
      <View className="flex-row items-start gap-2">
        <View className="mt-0.5">
          <SparkleAnimation />
        </View>
        <View className="flex-1 min-w-0">
          <AnimatedThinkingText text={headerText} />
          {headerPreview ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={2}>
              {headerPreview}
            </Text>
          ) : null}
        </View>
      </View>

      {listSteps.length > 0 ? (
        <View className="mt-3 gap-2">
          {listSteps.map((step) => {
            const duration = formatAgentStepDuration(step);
            return (
              <View key={step.name} className="flex-row items-start justify-between gap-2">
                <View className="flex-row items-start gap-2 flex-1 min-w-0">
                  <View className="mt-0.5">
                    <StepStatusIcon status={step.status} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm text-foreground" numberOfLines={1}>
                      {stepLabel(step)}
                    </Text>
                    {step.preview ? (
                      <Text className="text-xs text-muted-foreground" numberOfLines={2}>
                        {step.preview}
                      </Text>
                    ) : step.detail ? (
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                        {step.detail}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {duration ? (
                  <Text className="text-xs text-muted-foreground tabular-nums">
                    {duration}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
