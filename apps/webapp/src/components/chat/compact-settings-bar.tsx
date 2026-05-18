import { Settings, Stethoscope, Clock, FileText, MapPin, Navigation } from "lucide-react";
import type { PrimaryAgent, SearchLocationInput, AnalysisOptionalAgent, CheckpointOptionalAgent } from "@/lib/types";
import { searchLocationLabel } from "@/lib/search-location";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CompactSettingsBarProps {
  primaryAgent: PrimaryAgent;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  selectedCheckpointOptionalAgents?: CheckpointOptionalAgent[];
  searchLocation?: SearchLocationInput;
  propertyAddress?: string;
  onOpenSettings: () => void;
  onAgentPress?: () => void;
  onLocationPress?: () => void;
}

export function CompactSettingsBar({
  primaryAgent,
  selectedOptionalAgents,
  selectedCheckpointOptionalAgents = [],
  searchLocation,
  propertyAddress,
  onOpenSettings,
  onAgentPress,
  onLocationPress,
}: CompactSettingsBarProps) {
  const hasLocation = !!(
    (searchLocation?.source === 'device_gps' && searchLocation?.coordinates) ||
    (searchLocation?.source === 'property_address' && propertyAddress)
  );

  const getLocationLabel = () => {
    if (!hasLocation) return 'No location';
    return searchLocationLabel(searchLocation, propertyAddress);
  };

  const AgentIcon = primaryAgent === 'analysis' ? Stethoscope : 
                     primaryAgent === 'checkpoint' ? Clock : 
                     FileText;
  const LocationIcon = searchLocation?.source === 'device_gps' ? Navigation : MapPin;

  return (
    <div className="flex items-center gap-2 mb-3">
      {/* Agent Selector */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "h-8 gap-1.5 px-2.5 text-xs font-medium",
          onAgentPress && "cursor-pointer"
        )}
        onClick={onAgentPress || onOpenSettings}
      >
        <AgentIcon className="h-3.5 w-3.5" />
        <span className="capitalize">{primaryAgent}</span>
        {(selectedOptionalAgents.length > 0 || selectedCheckpointOptionalAgents.length > 0) && (
          <span className="text-muted-foreground">
            +{selectedOptionalAgents.length + selectedCheckpointOptionalAgents.length}
          </span>
        )}
      </Button>

      {/* Location Selector */}
      {onLocationPress && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 px-2.5 text-xs font-medium",
            hasLocation ? "border-primary/30" : "text-muted-foreground"
          )}
          onClick={onLocationPress}
        >
          <LocationIcon className="h-3.5 w-3.5" />
          <span>{getLocationLabel()}</span>
        </Button>
      )}

      {/* Settings */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 ml-auto"
        onClick={onOpenSettings}
      >
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  );
}

