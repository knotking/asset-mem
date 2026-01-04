import { Settings, Stethoscope, Clock, MapPin, Navigation } from "lucide-react";
import type { PrimaryAgent, LocationData, AnalysisOptionalAgent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      return `${locationData.locationRadius || 50}mi`;
    }
    return `${locationData?.locationRadius || 50}mi`;
  };

  const AgentIcon = primaryAgent === 'analysis' ? Stethoscope : Clock;
  const LocationIcon = locationData?.locationType === 'location' ? Navigation : MapPin;

  return (
    <div className="flex items-center gap-2 mb-3">
      {/* Agent Selector */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAgentPress || onOpenSettings}
        className="h-8 gap-1.5 px-3 text-xs font-medium">
        <AgentIcon className="h-3.5 w-3.5" />
        <span>{primaryAgent === 'analysis' ? 'Analysis' : 'Checkpoint'}</span>
        {primaryAgent === 'analysis' && selectedOptionalAgents.length > 0 && (
          <span className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
            +{selectedOptionalAgents.length}
          </span>
        )}
      </Button>

      {/* Location Indicator */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onLocationPress || onOpenSettings}
        className={cn(
          "h-8 gap-1.5 px-3 text-xs font-medium",
          hasLocation && "text-foreground"
        )}>
        <LocationIcon className={cn("h-3.5 w-3.5", hasLocation && "text-primary")} />
        <span className={cn(!hasLocation && "text-muted-foreground")}>{getLocationLabel()}</span>
      </Button>

      {/* Settings Button */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onOpenSettings}
        className="h-8 w-8">
        <Settings className="h-4 w-4" />
        <span className="sr-only">Open chat settings</span>
      </Button>
    </div>
  );
}

