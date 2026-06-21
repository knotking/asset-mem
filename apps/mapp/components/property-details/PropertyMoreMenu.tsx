import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { BookOpen, Heart, MoreHorizontal } from 'lucide-react-native';
import * as React from 'react';
import { Dimensions, Modal, Pressable, View, type View as ViewType } from 'react-native';

type PropertyMoreMenuProps = {
  onFaqPress: () => void;
  onMyProsPress: () => void;
  savedProsCount?: number;
};

type MenuPosition = {
  top: number;
  right: number;
};

export function PropertyMoreMenu({
  onFaqPress,
  onMyProsPress,
  savedProsCount = 0,
}: PropertyMoreMenuProps) {
  const triggerRef = React.useRef<ViewType>(null);
  const [open, setOpen] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState<MenuPosition | null>(null);

  const close = React.useCallback(() => {
    setOpen(false);
    setMenuPosition(null);
  }, []);

  const openMenu = React.useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const windowWidth = Dimensions.get('window').width;
      setMenuPosition({
        top: y + height + 4,
        right: Math.max(16, windowWidth - (x + width)),
      });
      setOpen(true);
    });
  }, []);

  const handleFaqPress = React.useCallback(() => {
    close();
    onFaqPress();
  }, [close, onFaqPress]);

  const handleMyProsPress = React.useCallback(() => {
    close();
    onMyProsPress();
  }, [close, onMyProsPress]);

  const myProsLabel =
    savedProsCount > 0
      ? `My pros (${savedProsCount > 99 ? '99+' : savedProsCount})`
      : 'My pros';

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Button
          variant="ghost"
          size="icon"
          accessibilityLabel="More property options"
          onPress={openMenu}>
          <Icon as={MoreHorizontal} size={20} className="text-foreground" />
        </Button>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View className="flex-1">
          <Pressable
            className="absolute inset-0"
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />
          {menuPosition ? (
            <View
              className={cn(
                'absolute min-w-[11rem] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg shadow-black/5'
              )}
              style={{ top: menuPosition.top, right: menuPosition.right }}
              accessibilityViewIsModal
              importantForAccessibility="yes">
              <Pressable
                testID="property-menu-faq"
                accessibilityRole="button"
                accessibilityLabel="FAQ & guides"
                onPress={handleFaqPress}
                className="flex-row items-center gap-2 rounded-sm px-3 py-2.5 active:bg-accent">
                <Icon
                  as={BookOpen}
                  size={16}
                  className="text-foreground"
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                />
                <Text className="text-sm" accessible={false}>
                  FAQ & guides
                </Text>
              </Pressable>
              <Pressable
                testID="property-menu-my-pros"
                accessibilityRole="button"
                accessibilityLabel="My pros"
                onPress={handleMyProsPress}
                className="flex-row items-center gap-2 rounded-sm px-3 py-2.5 active:bg-accent">
                <Icon
                  as={Heart}
                  size={16}
                  className="text-foreground"
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                />
                <Text className="text-sm" accessible={false}>
                  {myProsLabel}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
