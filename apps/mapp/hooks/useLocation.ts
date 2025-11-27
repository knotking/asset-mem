import { useState, useCallback, useEffect } from 'react';
import * as Location from 'expo-location';
import type { LocationData, LocationRadius } from '@homeapp/common/types';

export interface UseLocationReturn {
  locationData: LocationData | null;
  isLoading: boolean;
  error: string | null;
  radius: LocationRadius;
  setRadius: (radius: LocationRadius) => void;
  requestLocation: () => Promise<void>;
  clearLocation: () => void;
  hasPermission: boolean | null;
}

export function useLocation(defaultRadius: LocationRadius = 50): UseLocationReturn {
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [radius, setRadius] = useState<LocationRadius>(defaultRadius);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Check permission status on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch {
        setHasPermission(false);
      }
    };
    checkPermission();
  }, []);

  const requestLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setHasPermission(false);
        setError('Location permission denied. Please enable location access in settings.');
        setIsLoading(false);
        return;
      }

      setHasPermission(true);

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocationData({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        radius: radius,
      });
    } catch (err) {
      console.error('[useLocation] Error getting location:', err);
      setError(
        err instanceof Error 
          ? err.message 
          : 'Failed to get your location. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [radius]);

  const clearLocation = useCallback(() => {
    setLocationData(null);
    setError(null);
  }, []);

  // Update location data when radius changes (if we already have location)
  useEffect(() => {
    if (locationData) {
      setLocationData(prev => prev ? { ...prev, radius } : null);
    }
  }, [radius]);

  return {
    locationData,
    isLoading,
    error,
    radius,
    setRadius,
    requestLocation,
    clearLocation,
    hasPermission,
  };
}

