import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Loader, CheckCircle, AlertCircle, Sparkles } from 'lucide-react-native';
import type { AgentStep } from '@homeapp/common/types';

type Props = {
  steps: AgentStep[];
};

const statusIcons = {
  transferredto: Sparkles,
  executing: Loader,
  completed: CheckCircle,
  failed: AlertCircle,
};

const statusColors = {
  transferredto: 'text-blue-500',
  executing: 'text-primary',
  completed: 'text-green-500',
  failed: 'text-red-500',
};

function LoaderIcon() {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  }, [rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
      <Icon as={Loader} size={16} className="text-primary" />
    </Animated.View>
  );
}

function AnimatedStep({ step, index }: { step: AgentStep; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateY, index]);

  useEffect(() => {
    if (step.status === 'transferredto') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [step.status, pulseAnim]);

  const IconComponent = statusIcons[step.status];
  const isExecuting = step.status === 'executing';
  const isTransferred = step.status === 'transferredto';

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY }],
      }}
      className="flex-row items-center gap-2 py-1">
      {isExecuting ? (
        <LoaderIcon />
      ) : (
        <Icon as={IconComponent} size={16} className={statusColors[step.status]} />
      )}
      <Animated.Text
        style={{
          transform: [{ scale: isTransferred ? pulseAnim : 1 }],
        }}
        className="flex-1 text-sm text-foreground">
        {step.name}
      </Animated.Text>
    </Animated.View>
  );
}

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

  return (
    <View className="flex-row">
      <Animated.Text style={{ opacity: opacity1 }} className="font-medium text-primary">
        {text.slice(0, Math.ceil(text.length / 3))}
      </Animated.Text>
      <Animated.Text style={{ opacity: opacity2 }} className="font-medium text-primary">
        {text.slice(Math.ceil(text.length / 3), Math.ceil((text.length * 2) / 3))}
      </Animated.Text>
      <Animated.Text style={{ opacity: opacity3 }} className="font-medium text-primary">
        {text.slice(Math.ceil((text.length * 2) / 3))}
      </Animated.Text>
    </View>
  );
}

export function AgentStatus({ steps }: Props) {
  if (!steps || steps.length === 0) return null;

  const transferredStep = steps.find((step) => step.status === 'transferredto');
  const otherSteps = steps.filter((step) => step.status !== 'transferredto');

  const thinkingText = 'Thinking...';

  return (
    <View
      className="w-full rounded-xl border border-border bg-background p-4 shadow-sm"
      style={{ minWidth: 180 }}>
      {/* Header */}
      <View className="mb-2 flex-row items-center gap-2">
        <SparkleAnimation />
        <AnimatedThinkingText text={thinkingText} />
      </View>

      {/* Steps List */}
      {otherSteps.length > 0 && (
        <View className="gap-1 border-t border-border pt-2">
          {otherSteps.map((step, index) => (
            <AnimatedStep key={`${step.name}-${index}`} step={step} index={index} />
          ))}
        </View>
      )}
    </View>
  );
}
