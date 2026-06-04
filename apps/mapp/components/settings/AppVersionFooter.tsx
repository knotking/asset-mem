import * as React from 'react';
import { View, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Updates from 'expo-updates';
import { Text } from '@/components/ui/text';
import { useAppUpdateDevControls } from '@/components/AppUpdateGate';
import { getNativeAppVersion, getNativeBuildVersion } from '@/lib/native-app-version';
import { otaUpdateShortId } from '@/lib/ota-update-display';
import { isOtaDevMockAvailable, showOtaUpdateReadyPrompt } from '@/lib/ota-update-prompt';
import { useSecretTapReveal } from '@/lib/use-secret-tap';

const MOCK_OTA_UPDATE_ID = '00000000-0000-4000-8000-000000000001';
const VERSION_DETAIL_TAPS = 5;

export function AppVersionFooter() {
  const appVersion = getNativeAppVersion();
  const buildVersion = getNativeBuildVersion();
  const devMock = isOtaDevMockAvailable();
  const devControls = useAppUpdateDevControls();
  const { revealed: detailsOpen, onSecretTap } = useSecretTapReveal({
    requiredTaps: VERSION_DETAIL_TAPS,
    resetOnBackground: true,
  });

  const updateId = devMock && !Updates.updateId ? MOCK_OTA_UPDATE_ID : Updates.updateId;
  const shortId = otaUpdateShortId(updateId);
  const isMockOtaId = devMock && !Updates.updateId && Boolean(shortId);
  const [copied, setCopied] = React.useState(false);

  const handleVersionPress = React.useCallback(() => {
    onSecretTap();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onSecretTap]);

  const handleCopyUpdateId = React.useCallback(async () => {
    if (!updateId) return;
    try {
      await Clipboard.setStringAsync(updateId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [updateId]);

  const otaLabel = shortId
    ? copied
      ? 'OTA ID copied'
      : `OTA ${shortId}${isMockOtaId ? ' (dev)' : ''} · tap to copy`
    : 'OTA —';

  return (
    <View className="mt-8 items-center gap-1">
      <Pressable
        onPress={handleVersionPress}
        accessibilityRole="button"
        accessibilityLabel={`App version ${appVersion}`}
        accessibilityHint={`Tap ${VERSION_DETAIL_TAPS} times quickly to show build and OTA details`}>
        <Text className="text-xs text-muted-foreground">Version {appVersion}</Text>
      </Pressable>

      {detailsOpen ? (
        <>
          <Text className="text-xs text-muted-foreground">
            {buildVersion ? `Build ${buildVersion}` : 'Build —'}
          </Text>

          <Pressable
            onPress={handleCopyUpdateId}
            disabled={!updateId}
            accessibilityRole="button"
            accessibilityLabel="OTA update ID"
            accessibilityHint={updateId ? 'Copies the full update ID to the clipboard' : undefined}>
            <Text className="text-xs text-muted-foreground">{otaLabel}</Text>
          </Pressable>

          {devMock && devControls ? (
            <View className="mt-3 items-center gap-2 border-t border-border pt-3">
              <Text className="text-xs text-muted-foreground">Developer update tools</Text>
              <Pressable onPress={() => showOtaUpdateReadyPrompt({ mock: true })}>
                <Text className="text-xs text-primary">Simulate OTA prompt</Text>
              </Pressable>
              <Pressable onPress={() => devControls.setDevOverride('forceOta')}>
                <Text className="text-xs text-primary">Simulate force OTA</Text>
              </Pressable>
              <Pressable onPress={() => devControls.setDevOverride('forceOtaDownloading')}>
                <Text className="text-xs text-primary">Simulate force OTA (downloading)</Text>
              </Pressable>
              <Pressable onPress={() => devControls.setDevOverride('forceNative')}>
                <Text className="text-xs text-primary">Simulate force native</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
