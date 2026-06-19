import { useState, useEffect, type ReactNode } from "react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Hammer,
  Wrench,
  BadgeDollarSign,
  MapPin,
  Navigation,
} from "lucide-react";
import { getPrimaryAgentIcon } from "@/lib/primary-agent-display";
import type {
  PrimaryAgent,
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
  SearchLocationInput,
  SearchLocationSource,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

const chatLog = createLogger("chat");

const TAB_PANEL_HEIGHT =
  "h-[min(18.75rem,calc(100dvh-12rem))]";

function SelectableChipButton({
  selected,
  onClick,
  className,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        "border",
        selected
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          : "border-input bg-background",
        className,
      )}
    >
      {children}
    </Button>
  );
}

interface ChatSettingsPopoverProps {
  children?: React.ReactNode;
  /** Position anchor when opened programmatically (no trigger child). */
  anchor?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const PRIMARY_AGENT_OPTIONS: ReadonlyArray<{
  id: PrimaryAgent;
  label: string;
}> = [
  { id: "checkpoint", label: "Checkpoint" },
  { id: "docs", label: "Docs" },
  { id: "report", label: "Reports" },
];

const OPTIONAL_AGENT_OPTIONS: ReadonlyArray<{
  id: CheckpointOptionalAgent;
  label: string;
  icon: typeof ShieldCheck;
}> = [
  { id: 'coverage', label: 'Coverage', icon: ShieldCheck },
  { id: 'diy', label: 'DIY', icon: Hammer },
  { id: 'service', label: 'Service', icon: Wrench },
  { id: 'cost', label: 'Cost', icon: BadgeDollarSign },
];

export function ChatSettingsPopover({
  children,
  anchor,
  open,
  onOpenChange,
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
}: ChatSettingsPopoverProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'agent' | 'location'>(initialTab);
  const [locationSource, setLocationSource] = useState<SearchLocationSource>(
    searchLocation?.source || 'property_address'
  );
  const [locationRadius, setLocationRadius] = useState<number>(
    searchLocation?.radiusMiles || 5
  );
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (searchLocation) {
      setLocationSource(searchLocation.source);
      if (searchLocation.radiusMiles !== undefined) {
        setLocationRadius(searchLocation.radiusMiles);
      }
    }
  }, [searchLocation]);

  const handleGetCurrentLocation = () => {
    setIsGettingLocation(true);
    if (!navigator.geolocation) {
      toast({
        variant: 'destructive',
        title: 'Location unavailable',
        description: 'Geolocation is not supported by your browser.',
      });
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: SearchLocationInput = {
          source: 'device_gps',
          coordinates: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          radiusMiles: locationRadius,
        };
        setLocationSource('device_gps');
        onSearchLocationChange?.(next);
        setIsGettingLocation(false);
      },
      (error) => {
        chatLog.error('location.failed', undefined, error);
        toast({
          variant: 'destructive',
          title: 'Location failed',
          description: 'Failed to get current location. Check permissions and try again.',
        });
        setIsGettingLocation(false);
      }
    );
  };

  const handleLocationSourceChange = (source: SearchLocationSource) => {
    setLocationSource(source);
    if (source === 'property_address') {
      if (propertyAddress) {
        onSearchLocationChange?.({
          source: 'property_address',
          radiusMiles: locationRadius,
        });
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
    <Popover open={open} onOpenChange={onOpenChange}>
      {anchor ? <PopoverAnchor asChild>{anchor}</PopoverAnchor> : null}
      {children ? <PopoverTrigger asChild>{children}</PopoverTrigger> : null}
      <PopoverContent
        className="w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden p-0"
        align="start"
        side={isMobile ? "top" : "bottom"}
        sideOffset={8}
        collisionPadding={12}
      >
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'agent' | 'location')}>
          <div className="shrink-0 border-b px-4 pb-3 pt-4">
            <h3 className="mb-3 text-base font-semibold">Chat Settings</h3>
            <TabsList
              className={cn(
                "grid h-10 w-full p-1",
                onSearchLocationChange ? "grid-cols-2" : "grid-cols-1",
              )}
            >
              <TabsTrigger value="agent" className="h-8 flex-1">
                Agent
              </TabsTrigger>
              {onSearchLocationChange && (
                <TabsTrigger value="location" className="h-8 flex-1">
                  Location
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <div className={cn(TAB_PANEL_HEIGHT, "overflow-y-auto overscroll-contain")}>
          <TabsContent value="agent" className="m-0 space-y-4 p-4">
            {/* Primary Agent Selection */}
            <div>
              <label className="mb-3 block text-sm font-semibold">Primary Agent</label>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {PRIMARY_AGENT_OPTIONS.map((option) => {
                  const Icon = getPrimaryAgentIcon(option.id);
                  const selected = primaryAgent === option.id;
                  return (
                    <SelectableChipButton
                      key={option.id}
                      selected={selected}
                      onClick={() => onPrimaryAgentChange(option.id)}
                      className="h-9 min-w-0 gap-1 px-1.5 text-xs sm:gap-1.5 sm:px-2 sm:text-sm"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 truncate">{option.label}</span>
                    </SelectableChipButton>
                  );
                })}
              </div>
            </div>

            {/* Optional Agents — fixed footprint so switching primary agent does not resize the popover */}
            <div className="min-h-[9rem]">
              <label className="mb-3 block text-sm font-semibold">Optional Agents</label>
              {primaryAgent === 'docs' ? (
                <>
                  <div className="flex min-h-[4.5rem] items-center rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Not available for Docs. The Docs agent answers from your uploaded property
                      documents. Switch to Checkpoint to add coverage, DIY, service, or cost
                      recommendations.
                    </p>
                  </div>
                  <div className="mt-2 min-h-[3rem]" aria-hidden />
                </>
              ) : primaryAgent === 'report' ? (
                <>
                  <div className="flex min-h-[4.5rem] items-center rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Reports mode answers from saved report snapshots you attach in chat — not live
                      checkpoints.
                    </p>
                  </div>
                  <div className="mt-2 min-h-[3rem]" aria-hidden />
                </>
              ) : (
                <>
                  <div className="flex min-h-[4.5rem] flex-wrap content-start gap-2">
                    {OPTIONAL_AGENT_OPTIONS.map((option) => {
                      const isSelected =
                        primaryAgent === 'checkpoint'
                          ? selectedCheckpointOptionalAgents.includes(option.id)
                          : selectedOptionalAgents.includes(option.id);
                      const Icon = option.icon;
                      return (
                        <SelectableChipButton
                          key={option.id}
                          selected={isSelected}
                          onClick={() =>
                            primaryAgent === 'checkpoint'
                              ? onToggleCheckpointOptionalAgent(option.id)
                              : onToggleOptionalAgent(option.id)
                          }
                          className="gap-1.5"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{option.label}</span>
                        </SelectableChipButton>
                      );
                    })}
                  </div>
                  <p className="mt-2 min-h-[3rem] text-xs text-muted-foreground">
                    {primaryAgent === 'checkpoint' ? (
                      selectedCheckpointOptionalAgents.length === 0 ? (
                        <>
                          Checkpoint Agent will answer questions about your checkpoints without
                          recommendations
                        </>
                      ) : (
                        <>
                          Checkpoint Agent will analyze checkpoints and provide{' '}
                          {selectedCheckpointOptionalAgents.join(', ')} recommendations
                        </>
                      )
                    ) : selectedOptionalAgents.length === 0 ? (
                      <>Triage agent will run by default</>
                    ) : null}
                  </p>
                </>
              )}
            </div>
          </TabsContent>

          {onSearchLocationChange && (
            <TabsContent value="location" className="m-0 space-y-4 p-4">
              {/* Location Type */}
              <div>
                <label className="mb-3 block text-sm font-semibold">Search near</label>
                <div className="flex gap-2">
                  <SelectableChipButton
                    selected={locationSource === 'property_address'}
                    onClick={() => handleLocationSourceChange('property_address')}
                    className="h-9 flex-1 gap-2"
                  >
                    <MapPin className="h-4 w-4" />
                    <span>Property</span>
                  </SelectableChipButton>
                  <SelectableChipButton
                    selected={locationSource === 'device_gps'}
                    onClick={() => handleLocationSourceChange('device_gps')}
                    className="h-9 flex-1 gap-2"
                  >
                    <Navigation className="h-4 w-4" />
                    <span>Current</span>
                  </SelectableChipButton>
                </div>
              </div>

              <div className="min-h-[5.5rem] space-y-3">
              {/* Address Mode Info */}
              {locationSource === 'property_address' && propertyAddress && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Using property address: {propertyAddress.substring(0, 50)}
                    {propertyAddress.length > 50 ? '...' : ''}
                  </p>
                </div>
              )}

              {locationSource === 'property_address' && !propertyAddress && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                  <p className="text-xs leading-relaxed text-yellow-700 dark:text-yellow-400">
                    No property address available. Please select a property or use Current Location.
                  </p>
                </div>
              )}

              {/* Current Location Button */}
              {locationSource === 'device_gps' && (
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
                  {searchLocation?.coordinates && (
                    <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                      <p className="text-xs text-green-700 dark:text-green-400">
                        ✓ Location set: {searchLocation.coordinates.lat.toFixed(4)},{' '}
                        {searchLocation.coordinates.lng.toFixed(4)}
                      </p>
                    </div>
                  )}
                </div>
              )}
              </div>

              {/* Radius Selector */}
              {(locationSource === 'device_gps' || locationSource === 'property_address') && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-semibold">Search Radius</label>
                    <span className="text-sm font-bold text-primary">{locationRadius} miles</span>
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">5</span>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={locationRadius}
                      onChange={(e) => handleRadiusChange(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground">100</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 sm:flex sm:gap-2">
                    {[5, 10, 25, 50, 100].map((radius) => (
                      <SelectableChipButton
                        key={radius}
                        selected={locationRadius === radius}
                        onClick={() => handleRadiusChange(radius)}
                        className="h-9 min-w-0 px-1 sm:flex-1 sm:px-3"
                      >
                        {radius}
                      </SelectableChipButton>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          )}
          </div>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

