import * as React from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Home, Navigation } from 'lucide-react-native';
import type { LocationData, LocationRadius, LocationMode } from '@homeapp/common/types';
import { LOCATION_RADIUS_OPTIONS } from '@homeapp/common/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface LocationSelectorProps {
  propertyAddress: string | undefined;
  locationMode: LocationMode;
  onLocationModeChange: (mode: LocationMode) => void;
  locationData: LocationData | null;
  isLoadingLocation: boolean;
  locationError: string | null;
  radius: LocationRadius;
  onRadiusChange: (radius: LocationRadius) => void;
  onRequestLocation: () => void;
  hasLocationPermission: boolean | null;
}

export function LocationSelector({
  propertyAddress,
  locationMode,
  onLocationModeChange,
  locationData,
  isLoadingLocation,
  locationError,
  radius,
  onRadiusChange,
  onRequestLocation,
  hasLocationPermission,
}: LocationSelectorProps) {
  const insets = useSafeAreaInsets();
  const contentInsets = {
    top: insets.top,
    bottom: insets.bottom,
    left: 12,
    right: 12,
  };

  const handleModeToggle = (checked: boolean) => {
    const newMode = checked ? 'location' : 'address';
    onLocationModeChange(newMode);
    
    // Auto-request location when switching to location mode
    if (newMode === 'location' && !locationData && !isLoadingLocation) {
      onRequestLocation();
    }
  };

  // If no property address, always use location mode
  const effectiveMode = propertyAddress ? locationMode : 'location';
  const showAddressToggle = !!propertyAddress;

  return (
    <View className="border-t border-border bg-secondary/30 px-3 py-2">
      {/* Toggle between address and location */}
      {showAddressToggle && (
        <View className="mb-2 flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-2">
            <Icon 
              as={effectiveMode === 'address' ? Home : MapPin} 
              size={16} 
              className="text-muted-foreground" 
            />
            <Text className="text-sm text-muted-foreground">
              {effectiveMode === 'address' ? 'Using property address' : 'Using current location'}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-muted-foreground">
              {effectiveMode === 'address' ? 'Address' : 'GPS'}
            </Text>
            <Switch
              checked={effectiveMode === 'location'}
              onCheckedChange={handleModeToggle}
            />
          </View>
        </View>
      )}

      {/* Show address when in address mode */}
      {effectiveMode === 'address' && propertyAddress && (
        <View className="flex-row items-center gap-2 rounded-md bg-background/50 px-2 py-1.5">
          <Icon as={Home} size={14} className="text-primary" />
          <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
            {propertyAddress}
          </Text>
        </View>
      )}

      {/* Location mode UI */}
      {effectiveMode === 'location' && (
        <View className="gap-2">
          {/* Location status and radius selector */}
          <View className="flex-row items-center justify-between">
            {/* Location status */}
            <Pressable 
              onPress={onRequestLocation}
              disabled={isLoadingLocation}
              className="flex-1 flex-row items-center gap-2 rounded-md bg-background/50 px-2 py-1.5"
            >
              {isLoadingLocation ? (
                <>
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <Text className="text-sm text-muted-foreground">Getting location...</Text>
                </>
              ) : locationData ? (
                <>
                  <Icon as={Navigation} size={14} className="text-green-500" />
                  <Text className="text-sm text-foreground" numberOfLines={1}>
                    Location acquired
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    (tap to refresh)
                  </Text>
                </>
              ) : (
                <>
                  <Icon as={MapPin} size={14} className="text-primary" />
                  <Text className="text-sm text-primary">
                    Tap to get location
                  </Text>
                </>
              )}
            </Pressable>

            {/* Radius selector */}
            <View className="ml-2">
              <Select
                value={{ value: String(radius), label: `${radius} mi` }}
                onValueChange={(option) => {
                  if (option) {
                    onRadiusChange(Number(option.value) as LocationRadius);
                  }
                }}
              >
                <SelectTrigger size="sm" className="min-w-[80px]">
                  <SelectValue placeholder="Radius" />
                </SelectTrigger>
                <SelectContent insets={contentInsets}>
                  {LOCATION_RADIUS_OPTIONS.map((r) => (
                    <SelectItem key={r} value={String(r)} label={`${r} miles`}>
                      {r} miles
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </View>
          </View>

          {/* Error message */}
          {locationError && (
            <View className="rounded-md bg-destructive/10 px-2 py-1.5">
              <Text className="text-xs text-destructive">{locationError}</Text>
            </View>
          )}

          {/* No address hint */}
          {!propertyAddress && !locationData && !isLoadingLocation && (
            <Text className="text-xs text-muted-foreground">
              No property address set. Using your current location for service provider search.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

