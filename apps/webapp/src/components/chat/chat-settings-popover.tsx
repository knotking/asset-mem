import { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Stethoscope,
  Clock,
  ShieldCheck,
  Hammer,
  Wrench,
  BadgeDollarSign,
  MapPin,
  Navigation,
} from "lucide-react";
import type {
  PrimaryAgent,
  AnalysisOptionalAgent,
  LocationData,
  LocationType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatSettingsPopoverProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryAgent: PrimaryAgent;
  onPrimaryAgentChange: (agent: PrimaryAgent) => void;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  onToggleOptionalAgent: (agent: AnalysisOptionalAgent) => void;
  locationData?: LocationData;
  onLocationDataChange?: (locationData: LocationData | undefined) => void;
  propertyAddress?: string;
  initialTab?: 'agent' | 'location';
}

const OPTIONAL_AGENT_OPTIONS = [
  { id: 'coverage' as AnalysisOptionalAgent, label: 'Coverage', icon: ShieldCheck },
  { id: 'diy' as AnalysisOptionalAgent, label: 'DIY', icon: Hammer },
  { id: 'service' as AnalysisOptionalAgent, label: 'Service', icon: Wrench },
  { id: 'cost' as AnalysisOptionalAgent, label: 'Cost', icon: BadgeDollarSign },
];

export function ChatSettingsPopover({
  children,
  open,
  onOpenChange,
  primaryAgent,
  onPrimaryAgentChange,
  selectedOptionalAgents,
  onToggleOptionalAgent,
  locationData,
  onLocationDataChange,
  propertyAddress,
  initialTab = 'agent',
}: ChatSettingsPopoverProps) {
  const [activeTab, setActiveTab] = useState<'agent' | 'location'>(initialTab);
  const [locationType, setLocationType] = useState<LocationType | undefined>(
    locationData?.locationType || 'location'
  );
  const [locationRadius, setLocationRadius] = useState<number>(
    locationData?.locationRadius || 50
  );
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (locationData) {
      setLocationType(locationData.locationType);
      if (locationData.locationRadius !== undefined) {
        setLocationRadius(locationData.locationRadius);
      }
    }
  }, [locationData]);

  const handleGetCurrentLocation = () => {
    setIsGettingLocation(true);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocationData: LocationData = {
          locationType: 'location',
          locationCoordinates: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          locationRadius: locationRadius,
        };
        setLocationType('location');
        onLocationDataChange?.(newLocationData);
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Failed to get current location');
        setIsGettingLocation(false);
      }
    );
  };

  const handleLocationTypeChange = (type: LocationType) => {
    setLocationType(type);
    if (type === 'address') {
      if (propertyAddress) {
        const newLocationData: LocationData = {
          locationType: 'address',
          locationRadius: locationRadius,
        };
        onLocationDataChange?.(newLocationData);
      } else {
        onLocationDataChange?.(undefined);
      }
    } else if (type === 'location') {
      if (locationData?.locationCoordinates) {
        const newLocationData: LocationData = {
          locationType: 'location',
          locationCoordinates: locationData.locationCoordinates,
          locationRadius: locationRadius,
        };
        onLocationDataChange?.(newLocationData);
      }
    }
  };

  const handleRadiusChange = (radius: number) => {
    setLocationRadius(radius);
    if (locationType && onLocationDataChange) {
      const newLocationData: LocationData = {
        locationType,
        locationCoordinates: locationData?.locationCoordinates,
        locationRadius: radius,
      };
      onLocationDataChange(newLocationData);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'agent' | 'location')}>
          <div className="border-b px-4 pt-4">
            <h3 className="text-base font-semibold mb-3">Chat Settings</h3>
            <TabsList className="w-full">
              <TabsTrigger value="agent" className="flex-1">
                Agent
              </TabsTrigger>
              {onLocationDataChange && (
                <TabsTrigger value="location" className="flex-1">
                  Location
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="agent" className="p-4 space-y-4 m-0">
            {/* Primary Agent Selection */}
            <div>
              <label className="text-sm font-semibold mb-3 block">Primary Agent</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={primaryAgent === 'analysis' ? 'default' : 'outline'}
                  className="flex-1 gap-2"
                  onClick={() => onPrimaryAgentChange('analysis')}>
                  <Stethoscope className="h-4 w-4" />
                  <span>Analysis</span>
                </Button>
                <Button
                  type="button"
                  variant={primaryAgent === 'checkpoint' ? 'default' : 'outline'}
                  className="flex-1 gap-2"
                  onClick={() => onPrimaryAgentChange('checkpoint')}>
                  <Clock className="h-4 w-4" />
                  <span>Checkpoint</span>
                </Button>
              </div>
            </div>

            {/* Optional Agents (Analysis Mode) */}
            {primaryAgent === 'analysis' && (
              <div>
                <label className="text-sm font-semibold mb-3 block">Optional Agents</label>
                <div className="flex flex-wrap gap-2">
                  {OPTIONAL_AGENT_OPTIONS.map((option) => {
                    const isSelected = selectedOptionalAgents.includes(option.id);
                    const Icon = option.icon;
                    return (
                      <Button
                        key={option.id}
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onToggleOptionalAgent(option.id)}
                        className="gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        <span>{option.label}</span>
                      </Button>
                    );
                  })}
                </div>
                {selectedOptionalAgents.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Triage agent will run by default
                  </p>
                )}
              </div>
            )}

            {/* Checkpoint Mode Info */}
            {primaryAgent === 'checkpoint' && (
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Checkpoint Agent analyzes your property's checkpoint history to answer questions
                  about changes, trends, and condition over time.
                </p>
              </div>
            )}
          </TabsContent>

          {onLocationDataChange && (
            <TabsContent value="location" className="p-4 space-y-4 m-0">
              {/* Location Type */}
              <div>
                <label className="text-sm font-semibold mb-3 block">Location Type</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={locationType === 'address' ? 'default' : 'outline'}
                    className="flex-1 gap-2"
                    onClick={() => handleLocationTypeChange('address')}>
                    <MapPin className="h-4 w-4" />
                    <span>Address</span>
                  </Button>
                  <Button
                    type="button"
                    variant={locationType === 'location' ? 'default' : 'outline'}
                    className="flex-1 gap-2"
                    onClick={() => handleLocationTypeChange('location')}>
                    <Navigation className="h-4 w-4" />
                    <span>Current</span>
                  </Button>
                </div>
              </div>

              {/* Address Mode Info */}
              {locationType === 'address' && propertyAddress && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Using property address: {propertyAddress.substring(0, 50)}
                    {propertyAddress.length > 50 ? '...' : ''}
                  </p>
                </div>
              )}

              {locationType === 'address' && !propertyAddress && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                  <p className="text-xs leading-relaxed text-yellow-700 dark:text-yellow-400">
                    No property address available. Please select a property or use Current Location.
                  </p>
                </div>
              )}

              {/* Current Location Button */}
              {locationType === 'location' && (
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full gap-2"
                    onClick={handleGetCurrentLocation}
                    disabled={isGettingLocation}>
                    {isGettingLocation ? (
                      <>
                        <div className="h-4 w-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                        <span>Getting location...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="h-4 w-4" />
                        <span>Get Current Location</span>
                      </>
                    )}
                  </Button>
                  {locationData?.locationCoordinates && (
                    <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                      <p className="text-xs text-green-700 dark:text-green-400">
                        ✓ Location set: {locationData.locationCoordinates.lat.toFixed(4)},{' '}
                        {locationData.locationCoordinates.lng.toFixed(4)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Radius Selector */}
              {(locationType === 'location' || locationType === 'address') && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold">Search Radius</label>
                    <span className="text-sm font-bold text-primary">{locationRadius} miles</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-muted-foreground">10</span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={locationRadius}
                      onChange={(e) => handleRadiusChange(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground">100</span>
                  </div>
                  <div className="flex gap-2">
                    {[10, 25, 50, 75, 100].map((radius) => (
                      <Button
                        key={radius}
                        type="button"
                        variant={locationRadius === radius ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => handleRadiusChange(radius)}>
                        {radius}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

