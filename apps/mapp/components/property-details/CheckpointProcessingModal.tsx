import * as React from 'react';
import { Modal, View, Animated, Easing } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { CheckCircle, Loader2, Eye } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CheckpointProcessingModalProps {
  visible: boolean;
  checkpointId: string;
  checkpointName: string;
  onViewCheckpoint: (checkpointId: string) => void;
  onContinue: () => void;
}

export function CheckpointProcessingModal({
  visible,
  checkpointId,
  checkpointName,
  onViewCheckpoint,
  onContinue,
}: CheckpointProcessingModalProps) {
  const insets = useSafeAreaInsets();
  const [countdown, setCountdown] = React.useState(4);
  
  // Animation values
  const checkmarkScale = React.useRef(new Animated.Value(0)).current;
  const spinnerRotation = React.useRef(new Animated.Value(0)).current;

  // Reset and start animations when modal becomes visible
  React.useEffect(() => {
    if (visible) {
      setCountdown(4);
      
      // Checkmark pop-in animation
      checkmarkScale.setValue(0);
      Animated.spring(checkmarkScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();

      // Spinner rotation animation
      spinnerRotation.setValue(0);
      Animated.loop(
        Animated.timing(spinnerRotation, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [visible, checkmarkScale, spinnerRotation]);

  // Auto-dismiss countdown
  React.useEffect(() => {
    if (!visible || countdown <= 0) return;

    const timer = setTimeout(() => {
      const newCountdown = countdown - 1;
      setCountdown(newCountdown);
      
      if (newCountdown === 0) {
        onContinue();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [visible, countdown, onContinue]);

  const spinnerRotate = spinnerRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onContinue}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-lg">
          {/* Success Icon with Animation */}
          <View className="mb-4 items-center">
            <Animated.View
              style={{
                transform: [{ scale: checkmarkScale }],
              }}>
              <View className="h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <Icon as={CheckCircle} size={40} className="text-green-500" />
              </View>
            </Animated.View>
          </View>

          {/* Title */}
          <Text className="mb-2 text-center text-xl font-bold text-foreground">
            Checkpoint Created!
          </Text>

          {/* Checkpoint Name */}
          <Text className="mb-4 text-center text-sm font-medium text-foreground">
            {checkpointName}
          </Text>

          {/* Processing Info */}
          <View className="mb-6 rounded-lg bg-primary/5 p-4">
            <View className="mb-2 flex-row items-center justify-center gap-2">
              <Animated.View
                style={{
                  transform: [{ rotate: spinnerRotate }],
                }}>
                <Icon as={Loader2} size={16} className="text-primary" />
              </Animated.View>
              <Text className="text-sm font-semibold text-primary">AI Analysis in Progress</Text>
            </View>
            <Text className="text-center text-xs text-muted-foreground">
              Your checkpoint is being analyzed. This usually takes 10-30 seconds. You can view
              progress in the checkpoint details.
            </Text>
          </View>

          {/* Action Buttons */}
          <View className="gap-3">
            <Button
              onPress={() => onViewCheckpoint(checkpointId)}
              className="w-full">
              <View className="flex-row items-center gap-2">
                <Icon as={Eye} size={18} className="text-primary-foreground" />
                <Text className="text-primary-foreground font-semibold">View Checkpoint</Text>
              </View>
            </Button>

            <Button
              onPress={onContinue}
              variant="outline"
              className="w-full">
              <Text className="text-foreground font-medium">
                Continue {countdown > 0 && `(${countdown}s)`}
              </Text>
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

