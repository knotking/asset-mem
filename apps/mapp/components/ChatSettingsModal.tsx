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
  ClipboardList,
  ShieldCheck,
  Hammer,
  Wrench,
  BadgeDollarSign,
  MapPin,
  Navigation,
  Paperclip,
  ChevronRight,
} from 'lucide-react-native';
import type {
  PrimaryAgent,
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
  SearchLocationInput,
  SearchLocationSource,
} from '@asset-mem/common/types';
import * as Location from 'expo-location';
import { createLogger } from '@/lib/logger';
import {
  getSettingsAttachmentActionLabel,
  getSettingsAttachmentCountLabel,
  getSettingsAttachmentHint,
} from '@asset-mem/common/lib/chat-context-labels';

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
  onOpenAddContext?: () => void;
  readyContextCount?: number;
  pendingContextCount?: number;
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
  onOpenAddContext,
  readyContextCount = 0,
  pendingContextCount = 0,
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

  const attachmentCountLabel = getSettingsAttachmentCountLabel(
    readyContextCount,
    pendingContextCount,
  );

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
                      className={`min-w-0 flex-1 basis-0 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3 ${
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
                      className={`min-w-0 flex-1 basis-0 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3 ${
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
                    <Pressable
                      onPress={() => onPrimaryAgentChange('report')}
                      className={`min-w-0 flex-1 basis-0 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3 ${
                        primaryAgent === 'report'
                          ? 'border-primary bg-primary'
                          : 'border-border bg-secondary'
                      }`}>
                      <Icon
                        as={ClipboardList}
                        size={18}
                        className={
                          primaryAgent === 'report'
                            ? 'text-primary-foreground'
                            : 'text-foreground'
                        }
                      />
                      <Text
                        className={`text-xs font-semibold ${
                          primaryAgent === 'report'
                            ? 'text-primary-foreground'
                            : 'text-foreground'
                        }`}>
                        Reports
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {onOpenAddContext ? (
                  <View>
                    <Text className="mb-3 text-sm font-semibold text-foreground">Attachments</Text>
                    <Pressable
                      onPress={onOpenAddContext}
                      className="flex-row items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-3">
                      <View className="min-w-0 flex-1 flex-row items-center gap-2">
                        <Icon as={Paperclip} size={16} className="text-muted-foreground" />
                        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                          {getSettingsAttachmentActionLabel(primaryAgent)}
                        </Text>
                      </View>
                      <View className="shrink-0 flex-row items-center gap-2">
                        {attachmentCountLabel ? (
                          <Text className="text-xs text-muted-foreground">{attachmentCountLabel}</Text>
                        ) : null}
                        <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
                      </View>
                    </Pressable>
                    <Text className="mt-2 text-xs text-muted-foreground">
                      {getSettingsAttachmentHint(primaryAgent)}
                    </Text>
                  </View>
                ) : null}

                {/* Optional Agents — fixed footprint so switching to Docs does not collapse the modal */}
                <View className="min-h-[140px]">
                  <Text className="mb-3 text-sm font-semibold text-foreground">
                    Optional Agents
                  </Text>
                  {primaryAgent === 'docs' ? (
                    <>
                      <View className="min-h-[72px] justify-center rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3">
                        <Text className="text-xs leading-relaxed text-muted-foreground">
                          Not available for Docs. The Docs agent answers from your uploaded property
                          documents. Switch to Checkpoint to add coverage, DIY, service, or cost
                          recommendations.
                        </Text>
                      </View>
                      <View className="mt-2 min-h-[40px]" />
                    </>
                  ) : primaryAgent === 'report' ? (
                    <>
                      <View className="min-h-[72px] justify-center rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3">
                        <Text className="text-xs leading-relaxed text-muted-foreground">
                          Reports mode answers from saved PDF snapshots you attach in chat —
                          not live checkpoints. Optional analysis branches are not available.
                        </Text>
                      </View>
                      <View className="mt-2 min-h-[40px]" />
                    </>
                  ) : (
                    <>
                      <View className="min-h-[72px] flex-row flex-wrap content-start gap-2">
                        {(primaryAgent === 'checkpoint'
                          ? CHECKPOINT_OPTIONAL_AGENT_OPTIONS
                          : OPTIONAL_AGENT_OPTIONS
                        ).map((option) => {
                          const isSelected =
                            primaryAgent === 'checkpoint'
                              ? selectedCheckpointOptionalAgents.includes(option.id)
                              : selectedOptionalAgents.includes(option.id);
                          return (
                            <Pressable
                              key={option.id}
                              onPress={() =>
                                primaryAgent === 'checkpoint'
                                  ? onToggleCheckpointOptionalAgent(option.id)
                                  : onToggleOptionalAgent(option.id)
                              }
                              className={`flex-row items-center gap-1.5 rounded-full border px-3 py-2 ${
                                isSelected
                                  ? 'border-primary bg-primary'
                                  : 'border-border bg-transparent'
                              }`}>
                              <Icon
                                as={option.icon}
                                size={14}
                                className={
                                  isSelected
                                    ? 'text-primary-foreground'
                                    : 'text-muted-foreground'
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
                      <Text className="mt-2 min-h-[40px] text-xs text-muted-foreground">
                        {primaryAgent === 'checkpoint'
                          ? selectedCheckpointOptionalAgents.length === 0
                            ? 'Basic checkpoint query will run by default'
                            : `Checkpoint Agent will analyze checkpoints and provide ${selectedCheckpointOptionalAgents.join(', ')} recommendations`
                          : selectedOptionalAgents.length === 0
                            ? 'Triage agent will run by default'
                            : ''}
                      </Text>
                    </>
                  )}
                </View>
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

