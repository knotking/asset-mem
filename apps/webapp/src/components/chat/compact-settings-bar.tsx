import { Settings, MapPin, Navigation } from "lucide-react";
import type {
  PrimaryAgent,
  SearchLocationInput,
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
} from "@/lib/types";
import { getPrimaryAgentIcon, getPrimaryAgentLabel } from "@/lib/primary-agent-display";
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

  const locationLabel = !hasLocation
    ? 'No location'
    : searchLocationLabel(searchLocation, propertyAddress);

  const AgentIcon = getPrimaryAgentIcon(primaryAgent);
  const LocationIcon = searchLocation?.source === 'device_gps' ? Navigation : MapPin;
  const agentLabel = getPrimaryAgentLabel(primaryAgent);
  const optionalCount =
    primaryAgent === "analysis"
      ? selectedOptionalAgents.length
      : primaryAgent === "checkpoint"
        ? selectedCheckpointOptionalAgents.length
        : 0;
  const agentAriaLabel =
    optionalCount > 0 ? `Agent: ${agentLabel}, +${optionalCount} optional` : `Agent: ${agentLabel}`;

  return (
    <div className={cn("mb-3 flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        title={agentAriaLabel}
        aria-label={agentAriaLabel}
        className={cn(
          "h-10 w-10 shrink-0 gap-0 px-0 text-xs font-medium sm:h-8 sm:w-auto sm:max-w-[9.5rem] sm:gap-1.5 sm:px-2.5",
          onAgentPress && "cursor-pointer"
        )}
        onClick={onAgentPress || onOpenSettings}
      >
        <AgentIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden min-w-0 truncate sm:inline">{agentLabel}</span>
        {primaryAgent === "analysis" && selectedOptionalAgents.length > 0 && (
          <span className="ml-0.5 hidden rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground sm:inline">
            +{selectedOptionalAgents.length}
          </span>
        )}
        {primaryAgent === "checkpoint" && selectedCheckpointOptionalAgents.length > 0 && (
          <span className="ml-0.5 hidden rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground sm:inline">
            +{selectedCheckpointOptionalAgents.length}
          </span>
        )}
      </Button>

      {onLocationPress && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          title={locationLabel}
          aria-label={locationLabel}
          className={cn(
            "h-10 w-10 shrink-0 gap-0 px-0 sm:h-8 sm:w-auto sm:max-w-[11rem] sm:gap-1.5 sm:px-2.5 md:max-w-[13rem]",
            hasLocation ? "border-primary/30" : "text-muted-foreground"
          )}
          onClick={onLocationPress}
        >
          <LocationIcon className="h-4 w-4 shrink-0" />
          <span className="hidden min-w-0 truncate sm:inline">{locationLabel}</span>
        </Button>
      )}

      {showSettingsButton ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 sm:h-8 sm:w-8"
          onClick={onOpenSettings}
          aria-label="Open chat settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
