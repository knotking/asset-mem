import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Sparkles } from 'lucide-react-native';
import type { CheckpointBranchProgress } from '@homeapp/common/lib/checkpoint-branch-progress';

type Props = {
  progress: CheckpointBranchProgress;
};

export function CheckpointAnalysisProgressFooter({ progress }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [progress.header, progress.detail, opacity]);

  return (
    <View className="border-t border-border bg-background px-4 py-2.5">
      <View className="flex-row items-start gap-2">
        <Icon as={Sparkles} size={16} className="mt-0.5 shrink-0 text-primary" />
        <Animated.View className="min-w-0 flex-1" style={{ opacity }}>
          <Text className="text-sm font-medium text-primary">{progress.header}</Text>
          {progress.detail ? (
            <Text className="mt-0.5 text-xs text-muted-foreground">{progress.detail}</Text>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}
