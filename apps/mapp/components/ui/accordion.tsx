import { Icon } from '@/components/ui/icon';
import { AccordionMountContext } from '@/lib/accordion-mount-context';
import { useChatListScrollAnchorLayout } from '@/lib/chat-list-scroll-anchor-context';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as AccordionPrimitive from '@rn-primitives/accordion';
import { ChevronDown } from 'lucide-react-native';
import React, { createContext, useContext } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, {
  LayoutAnimationConfig,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

const AccordionScrollAnchorContext = createContext(true);

function Accordion({
  children,
  enableScrollAnchor = true,
  ...props
}: Omit<AccordionPrimitive.RootProps, 'asChild'> & {
  enableScrollAnchor?: boolean;
} & React.RefAttributes<AccordionPrimitive.RootRef>) {
  const onRootLayout = useChatListScrollAnchorLayout(enableScrollAnchor);

  return (
    <AccordionScrollAnchorContext.Provider value={enableScrollAnchor}>
      <LayoutAnimationConfig skipEntering>
        <AccordionPrimitive.Root
          {...(props as AccordionPrimitive.RootProps)}
          asChild={Platform.OS !== 'web'}>
          <Animated.View onLayout={onRootLayout} className="w-full">
            {children}
          </Animated.View>
        </AccordionPrimitive.Root>
      </LayoutAnimationConfig>
    </AccordionScrollAnchorContext.Provider>
  );
}

function AccordionItem({
  children,
  className,
  value,
  ...props
}: AccordionPrimitive.ItemProps & React.RefAttributes<AccordionPrimitive.ItemRef>) {
  return (
    <AccordionPrimitive.Item
      className={cn(
        'border-border border-b',
        Platform.select({ web: 'last:border-b-0' }),
        className
      )}
      value={value}
      asChild
      {...props}>
      <View className="native:overflow-hidden w-full">{children}</View>
    </AccordionPrimitive.Item>
  );
}

const Trigger = Platform.OS === 'web' ? View : Pressable;

function AccordionTrigger({
  className,
  children,
  headerAction,
  ...props
}: AccordionPrimitive.TriggerProps & {
  children?: React.ReactNode;
  headerAction?: React.ReactNode;
} & React.RefAttributes<AccordionPrimitive.TriggerRef>) {
  const { isExpanded } = AccordionPrimitive.useItemContext();

  const progress = useDerivedValue(
    () => (isExpanded ? withTiming(1, { duration: 250 }) : withTiming(0, { duration: 200 })),
    [isExpanded]
  );
  const chevronStyle = useAnimatedStyle(
    () => ({
      transform: [{ rotate: `${progress.value * 180}deg` }],
    }),
    [progress]
  );

  return (
    <TextClassContext.Provider
      value={cn(
        'text-left text-sm font-medium',
        Platform.select({ web: 'group-hover:underline' })
      )}>
      <AccordionPrimitive.Header asChild>
        <View className="w-full flex-row items-start gap-1">
          <AccordionPrimitive.Trigger {...props} asChild>
            <Trigger
              className={cn(
                'min-w-0 flex-1 flex-row items-start justify-between gap-4 rounded-md py-4 disabled:opacity-50',
                Platform.select({
                  web: 'focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 outline-none transition-all hover:underline focus-visible:ring-[3px] disabled:pointer-events-none [&[data-state=open]>svg]:rotate-180',
                }),
                className
              )}>
              <>{children}</>
              <Animated.View style={chevronStyle}>
                <Icon
                  as={ChevronDown}
                  size={16}
                  className={cn(
                    'text-muted-foreground shrink-0',
                    Platform.select({
                      web: 'pointer-events-none translate-y-0.5 transition-transform duration-200',
                    })
                  )}
                />
              </Animated.View>
            </Trigger>
          </AccordionPrimitive.Trigger>
          {headerAction ? <View className="shrink-0 pt-3 pr-1">{headerAction}</View> : null}
        </View>
      </AccordionPrimitive.Header>
    </TextClassContext.Provider>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.ContentProps & React.RefAttributes<AccordionPrimitive.ContentRef>) {
  const { isExpanded } = AccordionPrimitive.useItemContext();
  return (
    <TextClassContext.Provider value="text-sm">
      <AccordionPrimitive.Content
        className={cn(
          'overflow-hidden',
          Platform.select({
            web: isExpanded ? 'animate-accordion-down' : 'animate-accordion-up',
          })
        )}
        {...props}>
        <AccordionMountContext.Provider value={isExpanded}>
          <View className={cn('pb-4', className)}>{children}</View>
        </AccordionMountContext.Provider>
      </AccordionPrimitive.Content>
    </TextClassContext.Provider>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
