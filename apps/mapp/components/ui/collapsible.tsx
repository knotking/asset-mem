import * as CollapsiblePrimitive from '@rn-primitives/collapsible';
import { cn } from '@/lib/utils';
import { Platform, View } from 'react-native';

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

function CollapsibleContent({
  className,
  children,
  ...props
}: CollapsiblePrimitive.ContentProps & React.RefAttributes<CollapsiblePrimitive.ContentRef>) {
  return (
    <CollapsiblePrimitive.Content
      className={cn(
        'overflow-hidden',
        Platform.select({
          web: 'data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
        }),
        className
      )}
      {...props}>
      <View className="pt-2">{children}</View>
    </CollapsiblePrimitive.Content>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
