import React from 'react';
import {
  View,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  useColorScheme,
  Keyboard,
  Animated,
  LayoutAnimation,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { InputToolbar, InputToolbarProps, Composer, Send } from 'react-native-gifted-chat';
import type { IMessage } from 'react-native-gifted-chat';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  Paperclip,
  Send as SendIcon,
  X,
  Square,
  AlertCircle,
  Camera,
  Images,
  Video,
  ShieldCheck,
  Hammer,
  Wrench,
  BadgeDollarSign,
  FileText,
  MapPin,
  Navigation,
  Stethoscope,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import type {
  FileAttachment,
  AnalysisOptionalAgent,
  LocationData,
  LocationType,
  PrimaryAgent,
} from '@homeapp/common/types';
import { ANALYSIS_OPTIONAL_AGENTS } from '@homeapp/common/types';
import * as Location from 'expo-location';
import { suggestPrimaryAgent } from '@/lib/query-suggestions';

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

const MAX_MESSAGE_LENGTH = 2000;

interface GiftedChatInputToolbarProps extends InputToolbarProps<IMessage> {
  fileAttachment: FileAttachment | null;
  onAttachmentPress: () => void;
  onRemoveAttachment: () => void;
  primaryAgent: PrimaryAgent;
  onPrimaryAgentChange: (agent: PrimaryAgent) => void;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  onToggleOptionalAgent: (agent: AnalysisOptionalAgent) => void;
  isSending: boolean;
  onStop: () => void;
  attachmentOptionsVisible: boolean;
  onCloseAttachmentOptions: () => void;
  onTakePhoto: () => void;
  onRecordVideo: () => void;
  onSelectFromLibrary: () => void;
  onSelectFiles: () => void;
  locationData?: LocationData;
  onLocationDataChange?: (locationData: LocationData | undefined) => void;
  propertyAddress?: string;
}

export function GiftedChatInputToolbar(props: GiftedChatInputToolbarProps) {
  const {
    fileAttachment,
    onAttachmentPress,
    onRemoveAttachment,
    primaryAgent,
    onPrimaryAgentChange,
    selectedOptionalAgents,
    onToggleOptionalAgent,
    isSending,
    onStop,
    attachmentOptionsVisible,
    onCloseAttachmentOptions,
    onTakePhoto,
    onRecordVideo,
    onSelectFromLibrary,
    onSelectFiles,
    locationData,
    onLocationDataChange,
    propertyAddress,
    ...inputToolbarProps
  } = props;

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [showMenu, setShowMenu] = React.useState(false);
  const [showLocationOptions, setShowLocationOptions] = React.useState(false);
  // Default to 'location' (current location) if no locationData provided
  const [locationType, setLocationType] = React.useState<LocationType | undefined>(locationData?.locationType || 'location');
  const [locationRadius, setLocationRadius] = React.useState<number>(locationData?.locationRadius || 50);
  const [isAgentSectionExpanded, setIsAgentSectionExpanded] = React.useState(false);
  const [suggestedAgent, setSuggestedAgent] = React.useState<PrimaryAgent | null>(null);
  const [currentText, setCurrentText] = React.useState<string>('');
  const slideAnim = React.useRef(new Animated.Value(500)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;
  
  // Animation values for opacity (height uses LayoutAnimation)
  const agentSectionOpacity = React.useRef(new Animated.Value(0)).current;
  const locationSectionOpacity = React.useRef(new Animated.Value(0)).current;

  // Convert HSL to hex for TextInput (which doesn't support CSS variables)
  // Light mode: --background: 0 0% 100% (white), --foreground: 0 0% 3.9% (near black)
  // Dark mode: --background: 0 0% 8% (dark gray), --foreground: 0 0% 98% (near white)
  // Light mode: --border: 0 0% 89.8%, --muted-foreground: 0 0% 45.1%
  // Dark mode: --border: 0 0% 28%, --muted-foreground: 0 0% 70%

  const colors = React.useMemo(
    () => ({
      background: isDark ? 'hsl(0, 0%, 8%)' : 'hsl(0, 0%, 100%)',
      foreground: isDark ? 'hsl(0, 0%, 98%)' : 'hsl(0, 0%, 3.9%)',
      border: isDark ? 'hsl(0, 0%, 28%)' : 'hsl(0, 0%, 89.8%)',
      mutedForeground: isDark ? 'hsl(0, 0%, 70%)' : 'hsl(0, 0%, 45.1%)',
    }),
    [isDark]
  );

  // Animate menu open/close
  React.useEffect(() => {
    if (showMenu) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 500,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showMenu, slideAnim, opacityAnim]);

  // Configure LayoutAnimation for smooth height transitions
  const configureLayoutAnimation = React.useCallback(() => {
    LayoutAnimation.configureNext({
      duration: 300,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.spring,
        springDamping: 0.7,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  }, []);

  // Handle agent section expand/collapse with animation
  const handleAgentSectionToggle = React.useCallback(() => {
    configureLayoutAnimation();
    const newValue = !isAgentSectionExpanded;
    setIsAgentSectionExpanded(newValue);
    Animated.timing(agentSectionOpacity, {
      toValue: newValue ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isAgentSectionExpanded, configureLayoutAnimation, agentSectionOpacity]);

  // Handle location section expand/collapse with animation
  const handleLocationSectionToggle = React.useCallback(() => {
    configureLayoutAnimation();
    const newValue = !showLocationOptions;
    setShowLocationOptions(newValue);
    Animated.timing(locationSectionOpacity, {
      toValue: newValue ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showLocationOptions, configureLayoutAnimation, locationSectionOpacity]);

  // Memoize attachment press handler to prevent recreation
  const handleAttachmentPressWithHaptic = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setShowMenu(true);
  }, []);

  const handleMenuClose = React.useCallback(() => {
    setShowMenu(false);
  }, []);

  const handleMenuOption = React.useCallback((action: () => void) => {
    setShowMenu(false);
    // Small delay to let menu close before opening camera/picker
    setTimeout(action, 100);
  }, []);

  // Location handling
  const handleLocationTypeChange = React.useCallback((type: LocationType) => {
    setLocationType(type);
    if (type === 'address') {
      // Use property address if available
      if (propertyAddress) {
        const newLocationData: LocationData = {
          locationType: 'address',
          locationRadius: locationRadius,
        };
        onLocationDataChange?.(newLocationData);
      } else {
        // Clear location data if no address available
        onLocationDataChange?.(undefined);
      }
    } else if (type === 'location') {
      // Keep existing coordinates if available, otherwise prompt for location
      if (locationData?.locationCoordinates) {
        const newLocationData: LocationData = {
          locationType: 'location',
          locationCoordinates: locationData.locationCoordinates,
          locationRadius: locationRadius,
        };
        onLocationDataChange?.(newLocationData);
      }
    }
  }, [propertyAddress, locationRadius, locationData, onLocationDataChange]);

  const handleRadiusChange = React.useCallback((radius: number) => {
    setLocationRadius(radius);
    if (locationType && onLocationDataChange) {
      const newLocationData: LocationData = {
        locationType,
        locationCoordinates: locationData?.locationCoordinates,
        locationRadius: radius,
      };
      onLocationDataChange(newLocationData);
    }
  }, [locationType, locationData, onLocationDataChange]);

  // Sync locationData changes and set default to 'location'
  React.useEffect(() => {
    if (locationData) {
      setLocationType(locationData.locationType);
      if (locationData.locationRadius !== undefined) {
        setLocationRadius(locationData.locationRadius);
      }
    } else {
      // Default to 'location' (current location) when no locationData
      setLocationType('location');
    }
  }, [locationData]);

  // Query-based agent suggestion with debouncing
  React.useEffect(() => {
    if (!currentText.trim()) {
      setSuggestedAgent(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      const suggestion = suggestPrimaryAgent(currentText, primaryAgent);
      setSuggestedAgent(suggestion);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [currentText, primaryAgent]);

  // Clear suggestion when agent changes manually
  React.useEffect(() => {
    setSuggestedAgent(null);
  }, [primaryAgent]);

  // Memoize renderComposer to prevent recreation on every render
  const renderComposer = React.useCallback(
    (composerProps: any) => {
      const textLength = composerProps.text?.length || 0;
      const isNearLimit = textLength > MAX_MESSAGE_LENGTH * 0.9;
      const isOverLimit = textLength > MAX_MESSAGE_LENGTH;

      return (
        <>
          <Composer
            {...composerProps}
            textInputStyle={{
              marginLeft: 0,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: isOverLimit ? 'hsl(0, 84.2%, 60.2%)' : colors.border,
              borderRadius: 32,
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 9,
              paddingBottom: 12,
              fontSize: 14,
              minHeight: 40,
              maxHeight: 120,
              lineHeight: 20,
              color: colors.foreground,
              textAlignVertical: 'center',
            }}
            textInputProps={{
              maxLength: MAX_MESSAGE_LENGTH,
              onChangeText: (text: string) => {
                setCurrentText(text);
                composerProps.onTextChanged?.(text);
              },
            }}
            textInputAutoFocus={false}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            multiline
          />
          {isNearLimit && (
            <Text
              style={{
                position: 'absolute',
                bottom: -20,
                right: 35,
                fontSize: 12,
                color: isOverLimit ? 'hsl(0, 84.2%, 60.2%)' : colors.mutedForeground,
              }}>
              {textLength}/{MAX_MESSAGE_LENGTH}
            </Text>
          )}
        </>
      );
    },
    [colors]
  );

  // Memoize renderSend to prevent recreation on every render
  const renderSend = React.useCallback(
    (sendProps: any) => {
      const canSend = sendProps.text?.trim() || fileAttachment;

      // Override onSend to handle attachment-only messages
      const handleSend = () => {
        console.log('[SendButton] handleSend called', {
          canSend,
          hasText: !!sendProps.text,
          hasAttachment: !!fileAttachment,
          text: sendProps.text,
        });

        if (canSend && sendProps.onSend) {
          // Haptic feedback on send
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          // Create message with text (empty string if no text)
          const messageText = sendProps.text || '';
          console.log('[SendButton] Calling onSend with text:', messageText);
          sendProps.onSend([{ text: messageText }], true);

          // Clear suggestion and text state after sending
          setCurrentText('');
          setSuggestedAgent(null);

          // Delay keyboard dismissal to ensure send completes first
          requestAnimationFrame(() => {
            Keyboard.dismiss();
          });
        }
      };

      return (
        <Send
          {...sendProps}
          disabled={!canSend}
          containerStyle={{
            position: 'absolute',
            right: 3,
            marginBottom: 2,
            marginLeft: 4,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onSend={handleSend}>
          <Pressable
            onPress={isSending ? onStop : handleSend}
            disabled={isSending ? false : !canSend}
            style={{
              opacity: isSending || canSend ? 1 : 0.5,
            }}>
            {isSending ? (
              <View className="h-8 w-8 items-center justify-center rounded-full bg-destructive">
                <Icon as={Square} size={16} className="text-primary-foreground" />
              </View>
            ) : (
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  canSend ? 'bg-primary' : 'bg-secondary'
                }`}>
                <Icon
                  as={SendIcon}
                  size={16}
                  className={canSend ? 'text-primary-foreground' : 'text-muted-foreground'}
                />
              </View>
            )}
          </Pressable>
        </Send>
      );
    },
    [isSending, onStop, fileAttachment]
  );

  return (
    <View className="border-t border-border bg-light-background-alt px-4 pb-2 pt-3">
      {/* Agent Suggestion Banner */}
      {suggestedAgent && suggestedAgent !== primaryAgent && (
        <View className="mb-2 flex-row items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
          <View className="flex-row items-center gap-2 flex-1">
            <Icon
              as={suggestedAgent === 'checkpoint' ? Clock : Stethoscope}
              size={14}
              className="text-primary"
            />
            <Text className="flex-1 text-xs text-foreground">
              Your query suggests using the{' '}
              <Text className="font-semibold">
                {suggestedAgent === 'checkpoint' ? 'Checkpoint' : 'Analysis'} Agent
              </Text>
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                setSuggestedAgent(null);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="px-2 py-1">
              <Text className="text-xs text-muted-foreground">Dismiss</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onPrimaryAgentChange(suggestedAgent);
                setSuggestedAgent(null);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              className="rounded-md bg-primary px-3 py-1">
              <Text className="text-xs font-semibold text-primary-foreground">Switch</Text>
            </Pressable>
          </View>
        </View>
      )}
      
      {/* File Attachment Preview */}
      {fileAttachment && (
        <View className="mb-3">
          <View className="relative h-20 w-20 overflow-hidden rounded-xl border border-border bg-secondary">
            {/* Image Preview */}
            {fileAttachment.fileType.startsWith('image/') && (
              <Image
                source={{ uri: fileAttachment.uri }}
                className="h-full w-full"
                resizeMode="cover"
              />
            )}

            {/* Video Preview */}
            {fileAttachment.fileType.startsWith('video/') && (
              <>
                {fileAttachment.thumbnailUri ? (
                  <Image
                    source={{ uri: fileAttachment.thumbnailUri }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <Icon as={Video} size={24} className="text-muted-foreground" />
                  </View>
                )}
              </>
            )}

            {/* Document/File Preview */}
            {!fileAttachment.fileType.startsWith('image/') &&
              !fileAttachment.fileType.startsWith('video/') && (
                <View className="h-full w-full items-center justify-center">
                  <Icon as={FileText} size={24} className="text-muted-foreground" />
                </View>
              )}

            {/* Loading Indicator */}
            {fileAttachment.progress < 100 && !fileAttachment.error && (
              <View className="absolute inset-0 items-center justify-center bg-black/40">
                <ActivityIndicator size="large" color="#ffffff" />
              </View>
            )}

            {/* Delete Button Overlay */}
            <Pressable
              onPress={onRemoveAttachment}
              className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-gray-500/80"
              accessibilityRole="button"
              accessibilityLabel="Remove attachment">
              <Icon as={X} size={14} className="text-white" />
            </Pressable>

            {/* Error Indicator */}
            {fileAttachment.error && (
              <View className="absolute inset-0 items-center justify-center bg-destructive/20">
                <Icon as={AlertCircle} size={24} className="text-destructive" />
              </View>
            )}
          </View>
        </View>
      )}

      {/* Primary Agent Selector - Collapsible */}
      <View className="mb-3">
        {/* Collapsed Header - Only show when collapsed */}
        {!isAgentSectionExpanded && (
          <Pressable
            onPress={handleAgentSectionToggle}
            className="flex-row items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
            <View className="flex-row items-center gap-2">
              <Icon
                as={primaryAgent === 'analysis' ? Stethoscope : Clock}
                size={16}
                className="text-foreground"
              />
              <Text className="text-sm font-medium text-foreground">
                {primaryAgent === 'analysis' ? 'Analysis Agent' : 'Checkpoint Agent'}
              </Text>
              {primaryAgent === 'analysis' && selectedOptionalAgents.length > 0 && (
                <View className="rounded-full bg-primary px-2 py-0.5">
                  <Text className="text-[10px] font-semibold text-primary-foreground">
                    {selectedOptionalAgents.length} optional
                  </Text>
                </View>
              )}
            </View>
            <Icon as={ChevronDown} size={16} className="text-muted-foreground" />
          </Pressable>
        )}
        
        {/* Expanded content */}
        <Animated.View
          style={{
            opacity: agentSectionOpacity,
            overflow: 'hidden',
          }}
          pointerEvents={isAgentSectionExpanded ? 'auto' : 'none'}>
          {isAgentSectionExpanded && (
            <View className="pt-2">
              {/* Primary Agent Selector */}
              <View>
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-xs font-semibold text-muted-foreground">Primary Agent</Text>
                  <Pressable
                    onPress={handleAgentSectionToggle}
                    className="rounded-full p-1">
                    <Icon as={ChevronUp} size={16} className="text-muted-foreground" />
                  </Pressable>
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => onPrimaryAgentChange('analysis')}
                    accessibilityRole="button"
                    accessibilityState={{ selected: primaryAgent === 'analysis' }}
                    className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full border px-3 py-2 ${
                      primaryAgent === 'analysis'
                        ? 'border-primary bg-primary'
                        : 'border-border bg-background'
                    }`}>
                    <Icon
                      as={Stethoscope}
                      size={15}
                      className={
                        primaryAgent === 'analysis' ? 'text-primary-foreground' : 'text-muted-foreground'
                      }
                    />
                    <Text
                      className={`text-xs font-semibold ${
                        primaryAgent === 'analysis' ? 'text-primary-foreground' : 'text-foreground'
                      }`}>
                      Analysis
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onPrimaryAgentChange('checkpoint')}
                    accessibilityRole="button"
                    accessibilityState={{ selected: primaryAgent === 'checkpoint' }}
                    className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full border px-3 py-2 ${
                      primaryAgent === 'checkpoint'
                        ? 'border-primary bg-primary'
                        : 'border-border bg-background'
                    }`}>
                    <Icon
                      as={Clock}
                      size={15}
                      className={
                        primaryAgent === 'checkpoint' ? 'text-primary-foreground' : 'text-muted-foreground'
                      }
                    />
                    <Text
                      className={`text-xs font-semibold ${
                        primaryAgent === 'checkpoint' ? 'text-primary-foreground' : 'text-foreground'
                      }`}>
                      Checkpoint
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Analysis Mode: Optional Agent Toggles */}
              {primaryAgent === 'analysis' && (
                <View className="mt-3">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <View className="rounded-full border border-border bg-background px-3 py-1">
                      <Text className="text-[10px] font-semibold uppercase text-muted-foreground">
                        Triage required
                      </Text>
                    </View>
                    {OPTIONAL_AGENT_OPTIONS.map((option) => {
                      const isSelected = selectedOptionalAgents.includes(option.id);
                      return (
                        <Pressable
                          key={option.id}
                          onPress={() => onToggleOptionalAgent(option.id)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          className={`flex-row items-center gap-1 rounded-full border px-3 py-1 ${
                            isSelected ? 'border-primary bg-primary' : 'border-border bg-transparent'
                          }`}>
                          <Icon
                            as={option.icon}
                            size={14}
                            className={isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}
                          />
                          <Text
                            className={`text-xs font-medium ${
                              isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                            }`}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {selectedOptionalAgents.length === 0 && (
                    <Text className="mt-1 text-xs text-muted-foreground">Only triage will run.</Text>
                  )}
                </View>
              )}

              {/* Checkpoint Mode: Info Message */}
              {primaryAgent === 'checkpoint' && (
                <View className="mt-3 rounded-lg border border-border bg-secondary/50 px-3 py-1.5">
                  <Text className="text-xs leading-4 text-muted-foreground">
                    Checkpoint Agent will analyze your property's checkpoint history to answer
                    questions about changes, trends, and condition over time.
                  </Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </View>

      {/* Location Selection */}
      {onLocationDataChange && (
        <View className="mb-3">
          <Pressable
            onPress={handleLocationSectionToggle}
            className="flex-row items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
            <View className="flex-row items-center gap-2">
              <Icon 
                as={locationType === 'location' ? Navigation : MapPin} 
                size={16} 
                className="text-muted-foreground" 
              />
              <Text className="text-sm font-medium text-foreground">
                {locationType === 'address'
                  ? propertyAddress 
                    ? `Address: ${propertyAddress.substring(0, 30)}${propertyAddress.length > 30 ? '...' : ''}`
                    : 'Address (not set)'
                  : locationType === 'location'
                    ? locationData?.locationCoordinates
                      ? `Current Location (${locationData.locationCoordinates.lat.toFixed(4)}, ${locationData.locationCoordinates.lng.toFixed(4)})`
                      : 'Current Location'
                    : 'Location'}
                {locationData?.locationRadius && (locationType === 'address' || locationType === 'location') 
                  ? ` • ${locationData.locationRadius} mi radius` 
                  : locationType === 'location' && !locationData?.locationCoordinates
                    ? ` • ${locationRadius} mi radius`
                    : ''}
              </Text>
            </View>
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: locationSectionOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '45deg'],
                    }),
                  },
                ],
              }}>
              <Icon as={X} size={16} className="text-muted-foreground" />
            </Animated.View>
          </Pressable>

          {/* Expanded content */}
          <Animated.View
            style={{
              opacity: locationSectionOpacity,
              overflow: 'hidden',
            }}
            pointerEvents={showLocationOptions ? 'auto' : 'none'}>
            {showLocationOptions && (
              <View className="mt-2 rounded-lg border border-border bg-background p-3">
              {/* Location Type Selector */}
              <View className="mb-3">
                <Text className="mb-2 text-xs font-semibold text-foreground">Location Type</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => handleLocationTypeChange('address')}
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg border px-3 py-2 ${
                      locationType === 'address' ? 'border-primary bg-primary' : 'border-border bg-transparent'
                    }`}>
                    <Icon
                      as={MapPin}
                      size={14}
                      className={locationType === 'address' ? 'text-primary-foreground' : 'text-muted-foreground'}
                    />
                    <Text
                      className={`text-xs font-medium ${
                        locationType === 'address' ? 'text-primary-foreground' : 'text-muted-foreground'
                      }`}>
                      Address
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleLocationTypeChange('location')}
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg border px-3 py-2 ${
                      locationType === 'location' ? 'border-primary bg-primary' : 'border-border bg-transparent'
                    }`}>
                    <Icon
                      as={Navigation}
                      size={14}
                      className={locationType === 'location' ? 'text-primary-foreground' : 'text-muted-foreground'}
                    />
                    <Text
                      className={`text-xs font-medium ${
                        locationType === 'location' ? 'text-primary-foreground' : 'text-muted-foreground'
                      }`}>
                      Location
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Location Type Descriptions */}
              {locationType === 'address' && propertyAddress && (
                <View className="mb-3 rounded-md bg-muted/50 p-2">
                  <Text className="text-xs text-muted-foreground">
                    Using property address for location-based search. The address will be geocoded to coordinates for precise radius filtering.
                  </Text>
                </View>
              )}
              
              {locationType === 'address' && !propertyAddress && (
                <View className="mb-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 p-2">
                  <Text className="text-xs text-yellow-700 dark:text-yellow-400">
                    No property address available. Please select a property or switch to Location type.
                  </Text>
                </View>
              )}

              {/* Current Location Status Display */}
              {locationType === 'location' && locationData?.locationCoordinates && (
                <View className="mb-3 rounded-md bg-green-500/10 border border-green-500/20 p-2">
                  <Text className="text-xs text-green-700 dark:text-green-400">
                    ✓ Location set: {locationData.locationCoordinates.lat.toFixed(6)}, {locationData.locationCoordinates.lng.toFixed(6)}
                  </Text>
                </View>
              )}

              {/* Radius Slider - Show for both address and location types */}
              {(locationType === 'location' || locationType === 'address') && (
                <View>
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-xs font-semibold text-foreground">Search Radius</Text>
                    <Text className="text-xs font-medium text-muted-foreground">{locationRadius} miles</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs text-muted-foreground">10</Text>
                    <View style={{ flex: 1 }}>
                      <View className="h-2 rounded-full bg-secondary relative">
                        <View
                          style={{
                            width: `${((locationRadius - 10) / 90) * 100}%`,
                            height: '100%',
                            backgroundColor: colors.foreground,
                            borderRadius: 4,
                          }}
                        />
                      </View>
                    </View>
                    <Text className="text-xs text-muted-foreground">100</Text>
                  </View>
                  <View className="mt-2 flex-row gap-2">
                    {[10, 25, 50, 75, 100].map((radius) => (
                      <Pressable
                        key={radius}
                        onPress={() => handleRadiusChange(radius)}
                        className={`flex-1 rounded-lg border px-2 py-1 ${
                          locationRadius === radius
                            ? 'border-primary bg-primary'
                            : 'border-border bg-transparent'
                        }`}>
                        <Text
                          className={`text-center text-xs font-medium ${
                            locationRadius === radius ? 'text-primary-foreground' : 'text-muted-foreground'
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
          </Animated.View>
        </View>
      )}

      {/* Input Row */}
      <View className="flex-row items-end gap-2">
        {/* Attachment Button */}
        <Pressable
          onPress={handleAttachmentPressWithHaptic}
          disabled={isSending || !!fileAttachment}
          className={`mb-[8px] h-8 w-8 items-center justify-center rounded-full ${
            fileAttachment ? 'bg-secondary' : 'bg-primary'
          }`}
          style={{
            opacity: fileAttachment ? 0.5 : 1,
          }}>
          <Icon
            as={Paperclip}
            size={16}
            className={fileAttachment ? 'text-muted-foreground' : 'text-primary-foreground'}
          />
        </Pressable>

        {/* Input Field */}
        <View style={{ flex: 1 }}>
          <InputToolbar
            {...inputToolbarProps}
            containerStyle={{
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              paddingHorizontal: 0,
              paddingVertical: 0,
              marginTop: 0,
              marginBottom: 0,
            }}
            primaryStyle={{
              alignItems: 'flex-end',
            }}
            renderComposer={renderComposer}
            renderSend={renderSend}
          />
        </View>
      </View>

      {/* Animated Slide-up Menu */}
      <Animated.View
        style={{
          position: 'absolute',
          top: -1000,
          bottom: -1000,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          opacity: opacityAnim,
          zIndex: 50,
        }}
        pointerEvents={showMenu ? 'auto' : 'none'}>
        <Pressable onPress={handleMenuClose} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          transform: [{ translateY: slideAnim }],
          zIndex: 51,
        }}
        className="rounded-t-3xl bg-background px-4 pb-4 pt-3 shadow-2xl"
        pointerEvents={showMenu ? 'auto' : 'none'}>
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-foreground">Add Attachment</Text>
          <Pressable onPress={handleMenuClose} className="h-7 w-7 items-center justify-center">
            <Icon as={X} size={18} className="text-muted-foreground" />
          </Pressable>
        </View>

        <View className="gap-2">
          {/* Row 1: Take Photo & Record Video */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => handleMenuOption(onTakePhoto)}
              className="flex-1 items-center gap-1.5 rounded-xl bg-secondary/50 p-3 active:bg-secondary">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon as={Camera} size={20} className="text-primary" />
              </View>
              <Text className="text-xs font-semibold text-foreground">Take Photo</Text>
            </Pressable>

            <Pressable
              onPress={() => handleMenuOption(onRecordVideo)}
              className="flex-1 items-center gap-1.5 rounded-xl bg-secondary/50 p-3 active:bg-secondary">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon as={Video} size={20} className="text-primary" />
              </View>
              <Text className="text-xs font-semibold text-foreground">Record Video</Text>
            </Pressable>
          </View>

          {/* Row 2: Gallery & Files */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => handleMenuOption(onSelectFromLibrary)}
              className="flex-1 items-center gap-1.5 rounded-xl bg-secondary/50 p-3 active:bg-secondary">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon as={Images} size={20} className="text-primary" />
              </View>
              <Text className="text-xs font-semibold text-foreground">Gallery</Text>
            </Pressable>

            <Pressable
              onPress={() => handleMenuOption(onSelectFiles)}
              className="flex-1 items-center gap-1.5 rounded-xl bg-secondary/50 p-3 active:bg-secondary">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon as={FileText} size={20} className="text-primary" />
              </View>
              <Text className="text-xs font-semibold text-foreground">Files</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
