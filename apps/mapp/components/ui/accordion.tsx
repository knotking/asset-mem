import * as React from 'react';
import * as AccordionPrimitive from '@rn-primitives/accordion';
import { View } from 'react-native';
import { Icon } from './icon';
import { ChevronDown } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn('border-b border-border', className)} {...props} />
));
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & {
    children?: React.ReactNode;
  }
>(({ className, children, ...props }, ref) => {
  const { value } = AccordionPrimitive.useRootContext();
  const { value: itemValue } = AccordionPrimitive.useItemContext();
  const isOpen = value?.includes(itemValue);

  const rotation = useSharedValue(isOpen ? 180 : 0);

  React.useEffect(() => {
    rotation.value = withTiming(isOpen ? 180 : 0, { duration: 200 });
  }, [isOpen, rotation]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  }, []);

  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          'flex flex-1 flex-row items-center justify-between py-4 font-medium transition-all active:opacity-70',
          className
        )}
        {...props}>
        {children}
        <Animated.View style={animatedStyle}>
          <Icon as={ChevronDown} size={16} className="shrink-0 text-muted-foreground transition-transform duration-200" />
        </Animated.View>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn('overflow-hidden', className)}
    {...props}>
    <View className="pb-4 pt-0">{children}</View>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
