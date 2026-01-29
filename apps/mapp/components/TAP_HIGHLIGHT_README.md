# Global Tap Highlight Interceptor

This feature provides a global touch interceptor that captures all touch events across the app and displays visual tap indicators. Unlike the previous component-based approach, this uses a global interceptor at the root level, so no individual components need to be modified.

## How It Works

The `TapHighlightProvider` wraps the entire app and uses React Native's `PanResponder` with capture phase handlers to intercept all touch events without blocking them. When enabled, it displays cyan-colored circular indicators at tap locations.

## Usage

### Basic Setup

The provider is already integrated into the root layout (`app/_layout.tsx`). By default, tap highlighting is disabled.

### Enable Tap Highlighting

#### Option 1: Using the Floating Button (Recommended for Demos)

Add the floating button to any screen:

```tsx
import { TapHighlightFloatingButton } from '@/components/TapHighlightToggle';

export default function YourScreen() {
  return (
    <View>
      {/* Your content */}
      <TapHighlightFloatingButton />
    </View>
  );
}
```

#### Option 2: Using the Toggle Component

Add to settings or any screen:

```tsx
import { TapHighlightToggle } from '@/components/TapHighlightToggle';

export default function SettingsScreen() {
  return (
    <View>
      <TapHighlightToggle />
    </View>
  );
}
```

#### Option 3: Programmatically

```tsx
import { useTapHighlight } from '@/components/TapHighlightProvider';

function YourComponent() {
  const { enabled, setEnabled } = useTapHighlight();
  
  // Enable tap highlighting
  useEffect(() => {
    setEnabled(true);
  }, []);
}
```

## Visual Appearance

When enabled, taps show:
- A cyan-colored circular indicator (60x60px)
- Smooth scale-up animation
- Fade-out animation over 600ms
- Positioned at the exact tap location

## Enabling by Default for Demo Mode

To enable tap highlighting by default, modify `app/_layout.tsx`:

```tsx
<TapHighlightProvider defaultEnabled={true}>
  {/* ... */}
</TapHighlightProvider>
```

Or use an environment variable:

```tsx
<TapHighlightProvider defaultEnabled={process.env.EXPO_PUBLIC_DEMO_MODE === 'true'}>
  {/* ... */}
</TapHighlightProvider>
```

## Technical Details

- Uses React Native's `PanResponder` with capture phase handlers
- Intercepts touches in `onStartShouldSetResponderCapture` without blocking them
- Returns `false` from all responder methods to allow touches to pass through
- Overlay uses `pointerEvents: 'none'` so it doesn't interfere with touch interactions
- Tap indicators automatically clean up after animation completes

## Notes

- Tap highlighting only works when explicitly enabled
- The interceptor captures all touches globally - no component modifications needed
- All touch events pass through normally - the interceptor only reads coordinates
- The overlay is positioned above all content with `zIndex: 9999`
