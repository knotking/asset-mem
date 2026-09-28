import React from 'react';
import { View, Pressable } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  Stethoscope,
  Clock,
  FileText,
  ClipboardList,
  MapPin,
  Navigation,
  Settings,
} from 'lucide-react-native';
import type {
  PrimaryAgent,
  SearchLocationInput,
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
} from '@asset-mem/common/types';
import { searchLocationLabel } from '@asset-mem/common/lib/search-location';

interface CompactSettingsBarProps {
  primaryAgent: PrimaryAgent;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  searchLocation?: SearchLocationInput;
  propertyAddress?: string;
  onOpenSettings: () => void;
  onAgentPress?: () => void;
  onLocationPress?: () => void;
  /** When false, omit the trailing settings icon (e.g. toolbar renders it beside collapse). */
  showSettingsButton?: boolean;
  className?: string;
}

export function CompactSettingsBar({
  primaryAgent,
  selectedOptionalAgents,
  selectedCheckpointOptionalAgents,
  searchLocation,
  propertyAddress,
  onOpenSettings,
  onAgentPress,
  onLocationPress,
  showSettingsButton = true,
  className,
}: CompactSettingsBarProps) {
  const hasLocation = !!(
    (searchLocation?.source === 'device_gps' && searchLocation?.coordinates) ||
    (searchLocation?.source === 'property_address' && propertyAddress)
  );

  const getLocationLabel = () => {
    if (!hasLocation) return 'No location';
    return searchLocationLabel(searchLocation, propertyAddress);
  };

  return (
    <View className={className ?? 'mb-2 min-w-0 flex-row items-center gap-2'}>
      <Pressable
        onPress={onAgentPress || onOpenSettings}
        className="shrink-0 flex-row items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5"
        accessibilityRole="button"
        accessibilityLabel={`Current agent: ${
          primaryAgent === 'analysis'
            ? 'Analysis'
            : primaryAgent === 'checkpoint'
              ? 'Checkpoint'
              : primaryAgent === 'report'
                ? 'Reports'
                : 'Docs'
        }`}>
        <Icon
          as={
            primaryAgent === 'analysis'
              ? Stethoscope
              : primaryAgent === 'checkpoint'
                ? Clock
                : primaryAgent === 'report'
                  ? ClipboardList
                  : FileText
          }
          size={14}
          className="text-foreground"
        />
        <Text className="text-xs font-medium text-foreground">
          {primaryAgent === 'analysis'
            ? 'Analysis'
            : primaryAgent === 'checkpoint'
              ? 'Checkpoint'
              : primaryAgent === 'report'
                ? 'Reports'
                : 'Docs'}
        </Text>
        {primaryAgent === 'analysis' && selectedOptionalAgents.length > 0 && (
          <View className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5">
            <Text className="text-[9px] font-bold text-primary-foreground">
              +{selectedOptionalAgents.length}
            </Text>
          </View>
        )}
        {primaryAgent === 'checkpoint' && selectedCheckpointOptionalAgents.length > 0 && (
          <View className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5">
            <Text className="text-[9px] font-bold text-primary-foreground">
              +{selectedCheckpointOptionalAgents.length}
            </Text>
          </View>
        )}
      </Pressable>

      <Pressable
        onPress={onLocationPress || onOpenSettings}
        className="min-w-0 max-w-[48%] shrink flex-row items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5"
        accessibilityRole="button"
        accessibilityLabel={`Location: ${getLocationLabel()}`}>
        <Icon
          as={searchLocation?.source === 'device_gps' ? Navigation : MapPin}
          size={14}
          className={hasLocation ? 'text-primary' : 'text-muted-foreground'}
        />
        <Text
          className={`min-w-0 shrink text-xs font-medium ${hasLocation ? 'text-foreground' : 'text-muted-foreground'}`}
          numberOfLines={1}>
          {getLocationLabel()}
        </Text>
      </Pressable>

      {showSettingsButton ? (
        <Pressable
          onPress={onOpenSettings}
          className="h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background"
          accessibilityRole="button"
          accessibilityLabel="Open chat settings">
          <Icon as={Settings} size={16} className="text-muted-foreground" />
        </Pressable>
      ) : null}
    </View>
  );
}
