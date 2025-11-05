import React, { useEffect, useRef } from 'react';
import { View, Animated, Pressable, Dimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PushDrawerProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  mainContent: React.ReactNode;
  width?: number; // Width as percentage (default 80)
  direction?: 'left' | 'right'; // Direction to slide from (default 'right')
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PushDrawer({
  visible,
  onClose,
  children,
  mainContent,
  width = 80,
  direction = 'right',
}: PushDrawerProps) {
  const contentSlideAnim = useRef(new Animated.Value(0)).current;
  const drawerSlideAnim = useRef(
    new Animated.Value(direction === 'right' ? SCREEN_WIDTH : -SCREEN_WIDTH)
  ).current;

  useEffect(() => {
    const drawerWidth = (SCREEN_WIDTH * width) / 100;

    if (visible) {
      // Slide main content and drawer based on direction
      const contentSlideValue = direction === 'right' ? -drawerWidth : drawerWidth;

      Animated.parallel([
        Animated.timing(contentSlideAnim, {
          toValue: contentSlideValue,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(drawerSlideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide everything back
      const drawerHiddenValue = direction === 'right' ? SCREEN_WIDTH : -SCREEN_WIDTH;

      Animated.parallel([
        Animated.timing(contentSlideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(drawerSlideAnim, {
          toValue: drawerHiddenValue,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, contentSlideAnim, drawerSlideAnim, width, direction]);

  const drawerWidth = (SCREEN_WIDTH * width) / 100;

  const safeAreaEdges = direction === 'right' ? ['top', 'right', 'bottom'] : ['top', 'left', 'bottom'];
  const drawerPositionStyle = direction === 'right' ? styles.drawerRight : styles.drawerLeft;

  return (
    <View style={styles.container}>
      {/* Main Content - slides when drawer opens */}
      <Animated.View
        style={[
          styles.mainContent,
          {
            transform: [{ translateX: contentSlideAnim }],
          },
        ]}>
        {mainContent}
      </Animated.View>

      {/* Drawer - slides in from left or right */}
      <Animated.View
        style={[
          styles.drawer,
          drawerPositionStyle,
          {
            width: drawerWidth,
            transform: [{ translateX: drawerSlideAnim }],
          },
        ]}>
        <SafeAreaView style={styles.drawerContent} edges={safeAreaEdges as any}>
          {children}
        </SafeAreaView>
      </Animated.View>

      {/* Overlay on main content when drawer is open (for closing on tap) */}
      {visible && (
        <Animated.View
          style={[
            styles.overlay,
            {
              transform: [{ translateX: contentSlideAnim }],
            },
          ]}
          pointerEvents="auto">
          <Pressable style={styles.overlayPressable} onPress={onClose} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  drawerRight: {
    right: 0,
    borderLeftWidth: 1,
    borderLeftColor: '#e5e5e5',
    shadowOffset: {
      width: -2,
      height: 0,
    },
  },
  drawerLeft: {
    left: 0,
    borderRightWidth: 1,
    borderRightColor: '#e5e5e5',
    shadowOffset: {
      width: 2,
      height: 0,
    },
  },
  drawerContent: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  overlayPressable: {
    flex: 1,
  },
});
