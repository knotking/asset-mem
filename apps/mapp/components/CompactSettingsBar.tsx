import React from 'react';
import { View, Pressable } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  Stethoscope,
  Clock,
  FileText,
  MapPin,
  Navigation,
  Settings,
} from 'lucide-react-native';
import type {
  PrimaryAgent,
  SearchLocationInput,
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
} from '@homeapp/common/types';
import { searchLocationLabel } from '@homeapp/common/lib/search-location';

interface CompactSettingsBarProps {
  primaryAgent: PrimaryAgent;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  searchLocation?: SearchLocationInput;
  propertyAddress?: string;
  onOpenSettings: () => void;
  onAgentPress?: () => void;
  onLocationPress?: () => void;
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
    <View className={className ?? 'mb-2 flex-row items-center gap-2'}>
      <Pressable
        onPress={onAgentPress || onOpenSettings}
        className="flex-row items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5"
        accessibilityRole="button"
        accessibilityLabel={`Current agent: ${primaryAgent === 'analysis' ? 'Analysis' : primaryAgent === 'checkpoint' ? 'Checkpoint' : 'Docs'}`}>
        <Icon
          as={primaryAgent === 'analysis' ? Stethoscope : primaryAgent === 'checkpoint' ? Clock : FileText}
          size={14}
          className="text-foreground"
        />
        <Text className="text-xs font-medium text-foreground">
          {primaryAgent === 'analysis' ? 'Analysis' : primaryAgent === 'checkpoint' ? 'Checkpoint' : 'Docs'}
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
        className="flex-row items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5"
        accessibilityRole="button"
        accessibilityLabel={`Location: ${getLocationLabel()}`}>
        <Icon
          as={searchLocation?.source === 'device_gps' ? Navigation : MapPin}
          size={14}
          className={hasLocation ? 'text-primary' : 'text-muted-foreground'}
        />
        <Text className={`text-xs font-medium ${hasLocation ? 'text-foreground' : 'text-muted-foreground'}`}>
          {getLocationLabel()}
        </Text>
      </Pressable>

      <Pressable
        onPress={onOpenSettings}
        className="h-8 w-8 items-center justify-center rounded-full border border-border bg-background"
        accessibilityRole="button"
        accessibilityLabel="Open chat settings">
        <Icon as={Settings} size={16} className="text-muted-foreground" />
      </Pressable>
    </View>
  );
}
