import { Settings, Stethoscope, Clock, FileText, MapPin, Navigation } from "lucide-react";
import type {
  PrimaryAgent,
  SearchLocationInput,
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
} from "@/lib/types";
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
  /** When false, omit the trailing settings icon (toolbar renders it beside collapse). */
  showSettingsButton?: boolean;
  className?: string;
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
  showSettingsButton = true,
  className,
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
    <div className={cn("flex min-w-0 items-center gap-2 mb-3", className)}>
      {/* Agent Selector */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "h-8 shrink-0 gap-1.5 px-2.5 text-xs font-medium",
          onAgentPress && "cursor-pointer"
        )}
        onClick={onAgentPress || onOpenSettings}
      >
        <AgentIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="capitalize">{primaryAgent}</span>
        {primaryAgent === "analysis" && selectedOptionalAgents.length > 0 && (
          <span className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
            +{selectedOptionalAgents.length}
          </span>
        )}
        {primaryAgent === "checkpoint" && selectedCheckpointOptionalAgents.length > 0 && (
          <span className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
            +{selectedCheckpointOptionalAgents.length}
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
            "h-8 min-w-0 max-w-[11rem] shrink gap-1.5 px-2.5 text-xs font-medium sm:max-w-[13rem]",
            hasLocation ? "border-primary/30" : "text-muted-foreground"
          )}
          onClick={onLocationPress}
        >
          <LocationIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">{getLocationLabel()}</span>
        </Button>
      )}

      {/* Settings */}
      {showSettingsButton ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onOpenSettings}
          aria-label="Open chat settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
