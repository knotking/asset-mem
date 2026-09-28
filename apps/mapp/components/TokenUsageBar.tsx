import * as React from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { Sparkles } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Icon } from '@/components/ui/icon';
import { useAuth } from '@asset-mem/common/contexts/auth-context';
import { useLlmTokenUsage } from '@asset-mem/common/contexts/llm-token-usage-context';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type SettingsReturnContext,
  clearPendingSettingsHubReset,
  settingsReturnParams,
} from '@/lib/settings-navigation';

const DEFAULT_RING = 24;
const STROKE = 2;
/** Matches `Icon` size={20} in property-details header action buttons. */
const HEADER_ACTION_RING = 20;

/** Ring + Sparkles tint: green (healthy) → amber (warning) → red (critical). */
function ringColors(pct: number, colorScheme: 'light' | 'dark' | null | undefined) {
  const isDark = colorScheme === 'dark';
  const track = isDark ? 'hsl(0, 0%, 22%)' : 'hsl(0, 0%, 96.1%)';
  let progress: string;
  if (pct >= 100) progress = isDark ? 'hsl(0, 70.9%, 59.4%)' : 'hsl(0, 84.2%, 60.2%)';
  else if (pct >= 90) progress = isDark ? 'hsl(38, 92%, 50%)' : 'hsl(38, 92%, 45%)';
  else progress = isDark ? 'hsl(142, 71%, 48%)' : 'hsl(142, 71%, 40%)';
  return { track, progress };
}

function sparklesClass(pct: number) {
  if (pct >= 100) return 'text-destructive';
  if (pct >= 90) return 'text-amber-500 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

/** Tier-colored Sparkles + circular quota ring (no numeric label; see accessibility). */
function AiQuotaRing({ pct, size = DEFAULT_RING }: { pct: number; size?: number }) {
  const { colorScheme } = useColorScheme();
  const { track, progress } = ringColors(pct, colorScheme);
  const r = (size - STROKE) / 2 - 0.5;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  const cx = size / 2;
  const cy = size / 2;
  const sparklesSize = size <= HEADER_ACTION_RING ? 11 : 12;
  return (
    <View
      className="relative items-center justify-center"
      style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute' }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Circle cx={cx} cy={cy} r={r} stroke={track} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={progress}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <Icon as={Sparkles} className={sparklesClass(pct)} size={sparklesSize} />
    </View>
  );
}

export type TokenUsageBarProps = {
  /**
   * When true, ring matches ~20dp action icons (`Icon` size 20) e.g. property-details header.
   * Default is slightly larger (24) for the main app header.
   */
  matchActionIconSize?: boolean;
  /** When set, back from AI usage returns to the originating screen. */
  settingsReturnContext?: SettingsReturnContext;
};

/**
 * Header quota: AI icon + ring. Percent is spoken via accessibilityLabel only.
 */
export function TokenUsageBar({
  matchActionIconSize = false,
  settingsReturnContext,
}: TokenUsageBarProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { loading, error, periodTotalTokens, effectiveMonthlyLimit } = useLlmTokenUsage();

  const ringSize = matchActionIconSize ? HEADER_ACTION_RING : DEFAULT_RING;
  const boxClass = matchActionIconSize ? 'h-5 w-5' : 'h-6 w-6';
  const fallbackSparkles = matchActionIconSize ? 11 : 12;

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <View className={`${boxClass} shrink-0 items-center justify-center`}>
        <Skeleton className={`${boxClass} rounded-full`} />
      </View>
    );
  }

  if (error) {
    return null;
  }

  const goSettings = () => {
    if (settingsReturnContext) {
      clearPendingSettingsHubReset();
      router.navigate({
        pathname: '/(tabs)/settings/usage',
        params: settingsReturnParams(settingsReturnContext),
      });
      return;
    }
    router.navigate('/(tabs)/settings/usage');
  };

  if (effectiveMonthlyLimit == null) {
    return (
      <Pressable
        onPress={goSettings}
        className={`${boxClass} shrink-0 items-center justify-center rounded-md active:opacity-80`}
        accessibilityLabel="Token quota: no monthly cap, open settings">
        <Icon
          as={Sparkles}
          size={fallbackSparkles}
          className="text-muted-foreground opacity-60"
        />
      </Pressable>
    );
  }

  const pct = Math.min(100, Math.round((100 * periodTotalTokens) / effectiveMonthlyLimit));

  return (
    <Pressable
      onPress={goSettings}
      className="shrink-0 rounded-md py-0.5 active:opacity-80"
      accessibilityLabel={`AI token usage ${pct} percent, open settings`}>
      <AiQuotaRing pct={pct} size={ringSize} />
    </Pressable>
  );
}
