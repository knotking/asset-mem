import React from 'react';
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  X,
  Clock,
  FileText,
  ShieldCheck,
  Hammer,
  Wrench,
  BadgeDollarSign,
  MapPin,
  Navigation,
} from 'lucide-react-native';
import type {
  PrimaryAgent,
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
  SearchLocationInput,
  SearchLocationSource,
} from '@homeapp/common/types';
import * as Location from 'expo-location';
import { createLogger } from '@/lib/logger';

const chatLog = createLogger('chat');
// Note: Using button-based radius selector instead of slider for better cross-platform compatibility

interface ChatSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  primaryAgent: PrimaryAgent;
  onPrimaryAgentChange: (agent: PrimaryAgent) => void;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  onToggleOptionalAgent: (agent: AnalysisOptionalAgent) => void;
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  onToggleCheckpointOptionalAgent: (agent: CheckpointOptionalAgent) => void;
  searchLocation?: SearchLocationInput;
  onSearchLocationChange?: (searchLocation: SearchLocationInput | undefined) => void;
  propertyAddress?: string;
  initialTab?: 'agent' | 'location';
}

const OPTIONAL_AGENT_OPTIONS: {
  id: AnalysisOptionalAgent;
  label: string;
  icon: typeof ShieldCheck;
}[] = [
  { id: 'coverage', label: 'Coverage', icon: ShieldCheck },
  { id: 'diy', label: 'DIY', icon: Hammer },
  { id: 'service', label: 'Service', icon: Wrench },
  { id: 'cost', label: 'Cost', icon: BadgeDollarSign },
];

const CHECKPOINT_OPTIONAL_AGENT_OPTIONS: {
  id: CheckpointOptionalAgent;
  label: string;
  icon: typeof ShieldCheck;
}[] = [
  { id: 'coverage', label: 'Coverage', icon: ShieldCheck },
  { id: 'diy', label: 'DIY', icon: Hammer },
  { id: 'service', label: 'Service', icon: Wrench },
  { id: 'cost', label: 'Cost', icon: BadgeDollarSign },
];

export function ChatSettingsModal({
  visible,
  onClose,
  primaryAgent,
  onPrimaryAgentChange,
  selectedOptionalAgents,
  onToggleOptionalAgent,
  selectedCheckpointOptionalAgents,
  onToggleCheckpointOptionalAgent,
  searchLocation,
  onSearchLocationChange,
  propertyAddress,
  initialTab = 'agent',
}: ChatSettingsModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [activeTab, setActiveTab] = React.useState<'agent' | 'location'>(initialTab);
  const [locationSource, setLocationSource] = React.useState<SearchLocationSource>(
    searchLocation?.source || 'property_address'
  );
  const [locationRadius, setLocationRadius] = React.useState<number>(
    searchLocation?.radiusMiles || 5
  );
  const [isGettingLocation, setIsGettingLocation] = React.useState(false);

  // Color scheme values
  const colors = {
    background: isDark ? '#09090b' : '#ffffff',
    card: isDark ? '#18181b' : '#f4f4f5',
    border: isDark ? '#27272a' : '#e4e4e7',
    foreground: isDark ? '#fafafa' : '#09090b',
    mutedForeground: isDark ? '#a1a1aa' : '#71717a',
    primary: isDark ? '#3b82f6' : '#2563eb',
    primaryForeground: '#ffffff',
    secondary: isDark ? '#27272a' : '#f4f4f5',
  };

  React.useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
    }
  }, [visible, initialTab]);

  React.useEffect(() => {
    if (searchLocation) {
      setLocationSource(searchLocation.source);
      if (searchLocation.radiusMiles !== undefined) {
        setLocationRadius(searchLocation.radiusMiles);
      }
    }
  }, [searchLocation]);

  const handleGetCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        setIsGettingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const next: SearchLocationInput = {
        source: 'device_gps',
        coordinates: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        },
        radiusMiles: locationRadius,
      };
      setLocationSource('device_gps');
      onSearchLocationChange?.(next);
    } catch (error) {
      chatLog.error('location.failed', undefined, error);
      alert('Failed to get current location');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleLocationSourceChange = (source: SearchLocationSource) => {
    setLocationSource(source);
    if (source === 'property_address') {
      if (propertyAddress) {
        onSearchLocationChange?.({ source: 'property_address', radiusMiles: locationRadius });
      } else {
        onSearchLocationChange?.(undefined);
      }
    } else if (source === 'device_gps' && searchLocation?.coordinates) {
      onSearchLocationChange?.({
        source: 'device_gps',
        coordinates: searchLocation.coordinates,
        radiusMiles: locationRadius,
      });
    }
  };

  const handleRadiusChange = (radius: number) => {
    setLocationRadius(radius);
    if (!onSearchLocationChange) return;
    if (locationSource === 'property_address' && propertyAddress) {
      onSearchLocationChange({ source: 'property_address', radiusMiles: radius });
    } else if (locationSource === 'device_gps' && searchLocation?.coordinates) {
      onSearchLocationChange({
        source: 'device_gps',
        coordinates: searchLocation.coordinates,
        radiusMiles: radius,
      });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View
          style={{ backgroundColor: colors.background, height: '85%' }}
          className="rounded-t-3xl border-t border-border flex flex-col">
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-border px-4 py-4">
            <Text className="text-lg font-semibold text-foreground">Chat Settings</Text>
            <Pressable
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-secondary"
              accessibilityRole="button"
              accessibilityLabel="Close settings">
              <Icon as={X} size={20} className="text-foreground" />
            </Pressable>
          </View>

          {/* Tabs */}
          <View className="flex-row border-b border-border px-4">
            <Pressable
              onPress={() => setActiveTab('agent')}
              className={`flex-1 border-b-2 py-3 ${
                activeTab === 'agent' ? 'border-primary' : 'border-transparent'
              }`}>
              <Text
                className={`text-center text-sm font-medium ${
                  activeTab === 'agent' ? 'text-primary' : 'text-muted-foreground'
                }`}>
                Agent
              </Text>
            </Pressable>
            {onSearchLocationChange && (
              <Pressable
                onPress={() => setActiveTab('location')}
                className={`flex-1 border-b-2 py-3 ${
                  activeTab === 'location' ? 'border-primary' : 'border-transparent'
                }`}>
                <Text
                  className={`text-center text-sm font-medium ${
                    activeTab === 'location' ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                  Location
                </Text>
              </Pressable>
            )}
          </View>

          {/* Content */}
          <ScrollView className="px-4 py-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            {activeTab === 'agent' && (
              <View className="gap-4">
                {/* Primary Agent Selection */}
                <View>
                  <Text className="mb-3 text-sm font-semibold text-foreground">Primary Agent</Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => onPrimaryAgentChange('checkpoint')}
                      className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3 ${
                        primaryAgent === 'checkpoint'
                          ? 'border-primary bg-primary'
                          : 'border-border bg-secondary'
                      }`}>
                      <Icon
                        as={Clock}
                        size={18}
                        className={
                          primaryAgent === 'checkpoint'
                            ? 'text-primary-foreground'
                            : 'text-foreground'
                        }
                      />
                      <Text
                        className={`text-xs font-semibold ${
                          primaryAgent === 'checkpoint'
                            ? 'text-primary-foreground'
                            : 'text-foreground'
                        }`}>
                        Checkpoint
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onPrimaryAgentChange('docs')}
                      className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3 ${
                        primaryAgent === 'docs'
                          ? 'border-primary bg-primary'
                          : 'border-border bg-secondary'
                      }`}>
                      <Icon
                        as={FileText}
                        size={18}
                        className={
                          primaryAgent === 'docs'
                            ? 'text-primary-foreground'
                            : 'text-foreground'
                        }
                      />
                      <Text
                        className={`text-xs font-semibold ${
                          primaryAgent === 'docs'
                            ? 'text-primary-foreground'
                            : 'text-foreground'
                        }`}>
                        Docs
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Optional Agents (Analysis Mode) */}
                {primaryAgent === 'analysis' && (
                  <View>
                    <Text className="mb-3 text-sm font-semibold text-foreground">
                      Optional Agents
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {OPTIONAL_AGENT_OPTIONS.map((option) => {
                        const isSelected = selectedOptionalAgents.includes(option.id);
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() => onToggleOptionalAgent(option.id)}
                            className={`flex-row items-center gap-1.5 rounded-full border px-3 py-2 ${
                              isSelected
                                ? 'border-primary bg-primary'
                                : 'border-border bg-transparent'
                            }`}>
                            <Icon
                              as={option.icon}
                              size={14}
                              className={
                                isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                              }
                            />
                            <Text
                              className={`text-xs font-medium ${
                                isSelected ? 'text-primary-foreground' : 'text-foreground'
                              }`}>
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {selectedOptionalAgents.length === 0 && (
                      <Text className="mt-2 text-xs text-muted-foreground">
                        Triage agent will run by default
                      </Text>
                    )}
                  </View>
                )}

                {/* Optional Agents (Checkpoint Mode) */}
                {primaryAgent === 'checkpoint' && (
                  <View>
                    <Text className="mb-3 text-sm font-semibold text-foreground">
                      Optional Agents
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {CHECKPOINT_OPTIONAL_AGENT_OPTIONS.map((option) => {
                        const isSelected = selectedCheckpointOptionalAgents.includes(option.id);
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() => onToggleCheckpointOptionalAgent(option.id)}
                            className={`flex-row items-center gap-1.5 rounded-full border px-3 py-2 ${
                              isSelected
                                ? 'border-primary bg-primary'
                                : 'border-border bg-transparent'
                            }`}>
                            <Icon
                              as={option.icon}
                              size={14}
                              className={
                                isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                              }
                            />
                            <Text
                              className={`text-xs font-medium ${
                                isSelected ? 'text-primary-foreground' : 'text-foreground'
                              }`}>
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {selectedCheckpointOptionalAgents.length === 0 && (
                      <Text className="mt-2 text-xs text-muted-foreground">
                        Basic checkpoint query will run by default
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {activeTab === 'location' && onSearchLocationChange && (
              <View className="gap-4">
                {/* Location Type */}
                <View>
                  <Text className="mb-3 text-sm font-semibold text-foreground">Location Type</Text>
                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={() => handleLocationSourceChange('property_address')}
                      className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3 ${
                        locationSource === 'property_address'
                          ? 'border-primary bg-primary'
                          : 'border-border bg-secondary'
                      }`}>
                      <Icon
                        as={MapPin}
                        size={18}
                        className={
                          locationSource === 'property_address' ? 'text-primary-foreground' : 'text-foreground'
                        }
                      />
                      <Text
                        className={`text-sm font-semibold ${
                          locationSource === 'property_address' ? 'text-primary-foreground' : 'text-foreground'
                        }`}>
                        Address
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleLocationSourceChange('device_gps')}
                      className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3 ${
                        locationSource === 'device_gps'
                          ? 'border-primary bg-primary'
                          : 'border-border bg-secondary'
                      }`}>
                      <Icon
                        as={Navigation}
                        size={18}
                        className={
                          locationSource === 'device_gps' ? 'text-primary-foreground' : 'text-foreground'
                        }
                      />
                      <Text
                        className={`text-sm font-semibold ${
                          locationSource === 'device_gps' ? 'text-primary-foreground' : 'text-foreground'
                        }`}>
                        Current
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Address Mode Info */}
                {locationSource === 'property_address' && propertyAddress && (
                  <View className="rounded-lg bg-muted/50 p-3">
                    <Text className="text-xs leading-5 text-muted-foreground">
                      Using property address: {propertyAddress.substring(0, 50)}
                      {propertyAddress.length > 50 ? '...' : ''}
                    </Text>
                  </View>
                )}

                {locationSource === 'property_address' && !propertyAddress && (
                  <View className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                    <Text className="text-xs leading-5 text-yellow-700 dark:text-yellow-400">
                      No property address available. Please select a property or use Current
                      Location.
                    </Text>
                  </View>
                )}

                {/* Current Location Button */}
                {locationSource === 'device_gps' && (
                  <View>
                    <Pressable
                      onPress={handleGetCurrentLocation}
                      disabled={isGettingLocation}
                      className="flex-row items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3">
                      {isGettingLocation ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Icon as={Navigation} size={18} className="text-foreground" />
                      )}
                      <Text className="text-sm font-medium text-foreground">
                        {isGettingLocation ? 'Getting location...' : 'Get Current Location'}
                      </Text>
                    </Pressable>
                    {searchLocation?.coordinates && (
                      <View className="mt-3 rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                        <Text className="text-xs text-green-700 dark:text-green-400">
                          ✓ Location set: {searchLocation.coordinates.lat.toFixed(4)},{' '}
                          {searchLocation.coordinates.lng.toFixed(4)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Radius Selector */}
                {(locationSource === 'device_gps' || locationSource === 'property_address') && (
                  <View>
                    <View className="mb-2 flex-row items-center justify-between">
                      <Text className="text-sm font-semibold text-foreground">Search Radius</Text>
                      <Text className="text-sm font-bold text-primary">{locationRadius} miles</Text>
                    </View>
                    <View className="flex-row justify-between">
                      {[5, 10, 25, 50, 100].map((radius) => (
                        <Pressable
                          key={radius}
                          onPress={() => handleRadiusChange(radius)}
                          className={`rounded-lg border px-3 py-1.5 ${
                            locationRadius === radius
                              ? 'border-primary bg-primary'
                              : 'border-border bg-transparent'
                          }`}>
                          <Text
                            className={`text-xs font-medium ${
                              locationRadius === radius
                                ? 'text-primary-foreground'
                                : 'text-muted-foreground'
                            }`}>
                            {radius}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

