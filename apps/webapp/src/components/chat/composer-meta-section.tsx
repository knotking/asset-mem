"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Settings } from "lucide-react";
import type {
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
  PrimaryAgent,
  SearchLocationInput,
} from "@/lib/types";
import { buildCollapsedComposerSummary } from "@/lib/composer-collapse";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CompactSettingsBar } from "./compact-settings-bar";

type ComposerMetaSectionProps = {
  contextChipStrip?: React.ReactNode;
  sendBlockHint?: string | null;
  primaryAgent: PrimaryAgent;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  searchLocation?: SearchLocationInput;
  propertyAddress?: string;
  readyContextCount?: number;
  pendingContextCount?: number;
  hasQueuedSend?: boolean;
  onOpenSettings: (tab: "agent" | "location") => void;
};

export function ComposerMetaSection({
  contextChipStrip,
  sendBlockHint,
  primaryAgent,
  selectedOptionalAgents,
  selectedCheckpointOptionalAgents,
  searchLocation,
  propertyAddress,
  readyContextCount = 0,
  pendingContextCount = 0,
  hasQueuedSend = false,
  onOpenSettings,
}: ComposerMetaSectionProps) {
  const isMobile = useIsMobile();
  const [composerMetaExpanded, setComposerMetaExpanded] = React.useState(true);

  const collapsedSummary = React.useMemo(
    () =>
      buildCollapsedComposerSummary({
        primaryAgent,
        selectedOptionalAgents,
        selectedCheckpointOptionalAgents,
        readyContextCount,
        pendingContextCount,
        hasQueuedSend,
      }),
    [
      primaryAgent,
      selectedOptionalAgents,
      selectedCheckpointOptionalAgents,
      readyContextCount,
      pendingContextCount,
      hasQueuedSend,
    ],
  );

  if (isMobile) {
    if (!contextChipStrip && !sendBlockHint) {
      return null;
    }
    return (
      <div className="space-y-2">
        {contextChipStrip}
        {sendBlockHint ? (
          <p className="text-xs text-muted-foreground">{sendBlockHint}</p>
        ) : null}
      </div>
    );
  }

  if (composerMetaExpanded) {
    return (
      <div className="space-y-2.5">
        {contextChipStrip}
        {sendBlockHint ? (
          <p className="text-xs text-muted-foreground">{sendBlockHint}</p>
        ) : null}
        <div className="flex min-w-0 max-w-full items-center gap-1 overflow-hidden">
          <CompactSettingsBar
            primaryAgent={primaryAgent}
            selectedOptionalAgents={selectedOptionalAgents}
            selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
            searchLocation={searchLocation}
            propertyAddress={propertyAddress}
            onOpenSettings={() => onOpenSettings("agent")}
            onAgentPress={() => onOpenSettings("agent")}
            onLocationPress={() => onOpenSettings("location")}
            showSettingsButton={false}
            className="mb-0"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => onOpenSettings("agent")}
            aria-label="Open chat settings"
          >
            <Settings className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => setComposerMetaExpanded(false)}
            aria-label="Collapse chat settings and attachments"
          >
            <ChevronDown className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-w-0 max-w-full items-center gap-1.5">
        <button
          type="button"
          onClick={() => onOpenSettings("agent")}
          className={cn(
            "min-w-0 max-w-[calc(100%-2.25rem)] shrink rounded-full border border-border bg-background px-3 py-1.5",
            "text-left text-xs font-medium text-foreground truncate",
          )}
          aria-label={`Chat settings: ${collapsedSummary}`}
        >
          {collapsedSummary}
        </button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => setComposerMetaExpanded(true)}
          aria-label="Expand chat settings and attachments"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>
      {sendBlockHint ? (
        <p className="mt-2 text-xs text-muted-foreground">{sendBlockHint}</p>
      ) : null}
    </>
  );
}
