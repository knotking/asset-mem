import React from 'react';
import { View, Pressable } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  Stethoscope,
  Clock,
  FileSearch,
  MapPin,
  Navigation,
  Settings,
} from 'lucide-react-native';
import type { PrimaryAgent, LocationData, AnalysisOptionalAgent } from '@homeapp/common/types';

interface CompactSettingsBarProps {
  primaryAgent: PrimaryAgent;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  locationData?: LocationData;
  propertyAddress?: string;
  onOpenSettings: () => void;
  onAgentPress?: () => void;
  onLocationPress?: () => void;
}

export function CompactSettingsBar({
  primaryAgent,
  selectedOptionalAgents,
  locationData,
  propertyAddress,
  onOpenSettings,
  onAgentPress,
  onLocationPress,
}: CompactSettingsBarProps) {
  const hasLocation = !!(
    (locationData?.locationType === 'location' && locationData?.locationCoordinates) ||
    (locationData?.locationType === 'address' && propertyAddress)
  );

  const getLocationLabel = () => {
    if (!hasLocation) return 'No location';
    if (locationData?.locationType === 'location') {
      return `${locationData.locationRadius || 5}mi`;
    }
    return `${locationData?.locationRadius || 5}mi`;
  };

  return (
    <View className="mb-2 flex-row items-center gap-2">
      {/* Agent Selector */}
      <Pressable
        onPress={onAgentPress || onOpenSettings}
        className="flex-row items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5"
        accessibilityRole="button"
        accessibilityLabel={`Current agent: ${primaryAgent === 'analysis' ? 'Analysis' : primaryAgent === 'checkpoint' ? 'Checkpoint' : 'Inspection'}`}>
        <Icon
          as={primaryAgent === 'analysis' ? Stethoscope : primaryAgent === 'checkpoint' ? Clock : FileSearch}
          size={14}
          className="text-foreground"
        />
        <Text className="text-xs font-medium text-foreground">
          {primaryAgent === 'analysis' ? 'Analysis' : primaryAgent === 'checkpoint' ? 'Checkpoint' : 'Inspection'}
        </Text>
        {primaryAgent === 'analysis' && selectedOptionalAgents.length > 0 && (
          <View className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5">
            <Text className="text-[9px] font-bold text-primary-foreground">
              +{selectedOptionalAgents.length}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Location Indicator */}
      <Pressable
        onPress={onLocationPress || onOpenSettings}
        className="flex-row items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5"
        accessibilityRole="button"
        accessibilityLabel={`Location: ${getLocationLabel()}`}>
        <Icon
          as={locationData?.locationType === 'location' ? Navigation : MapPin}
          size={14}
          className={hasLocation ? 'text-primary' : 'text-muted-foreground'}
        />
        <Text className={`text-xs font-medium ${hasLocation ? 'text-foreground' : 'text-muted-foreground'}`}>
          {getLocationLabel()}
        </Text>
      </Pressable>

      {/* Settings Button */}
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

