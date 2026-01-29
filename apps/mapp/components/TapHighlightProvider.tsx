import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

type TapPosition = {
  x: number;
  y: number;
  id: string;
};

interface TapHighlightContextType {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  showTap: (x: number, y: number) => void;
}

export const TapHighlightContext = createContext<TapHighlightContextType | undefined>(undefined);

export function useTapHighlight() {
  const context = useContext(TapHighlightContext);
  if (!context) {
    throw new Error('useTapHighlight must be used within TapHighlightProvider');
  }
  return context;
}

interface TapHighlightProviderProps {
  children: ReactNode;
  defaultEnabled?: boolean;
}

export function TapHighlightProvider({ children, defaultEnabled = false }: TapHighlightProviderProps) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [taps, setTaps] = useState<TapPosition[]>([]);

  const showTap = useCallback((x: number, y: number) => {
    if (!enabled) return;
    
    const id = `${Date.now()}-${Math.random()}`;
    const newTap: TapPosition = { x, y, id };

    setTaps((prev) => [...prev, newTap]);

    // Remove tap after animation completes
    setTimeout(() => {
      setTaps((prev) => prev.filter((tap) => tap.id !== id));
    }, 600);
  }, [enabled]);

  return (
    <TapHighlightContext.Provider value={{ enabled, setEnabled, showTap }}>
      <View style={StyleSheet.absoluteFill} collapsable={false}>
        {children}
      </View>
      {enabled && <TapHighlightOverlay taps={taps} />}
    </TapHighlightContext.Provider>
  );
}

interface TapHighlightOverlayProps {
  taps: TapPosition[];
}

function TapHighlightOverlay({ taps }: TapHighlightOverlayProps) {
  return (
    <View
      style={[StyleSheet.absoluteFill, { pointerEvents: 'none', zIndex: 9999 }]}
      collapsable={false}>
      {taps.map((tap) => (
        <TapIndicator key={tap.id} x={tap.x} y={tap.y} />
      ))}
    </View>
  );
}

interface TapIndicatorProps {
  x: number;
  y: number;
}

function TapIndicator({ x, y }: TapIndicatorProps) {
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    // Scale up animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x - 30,
          top: y - 30,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: 'rgba(34, 211, 238, 0.4)', // cyan-400 with opacity
          borderWidth: 3,
          borderColor: 'rgba(34, 211, 238, 0.8)', // cyan-400
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    />
  );
}
