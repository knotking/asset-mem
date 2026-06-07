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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CompactSettingsBar } from "./compact-settings-bar";
import { ChatSettingsPopover } from "./chat-settings-popover";

type ComposerMetaSectionProps = {
  contextChipStrip?: React.ReactNode;
  sendBlockHint?: string | null;
  primaryAgent: PrimaryAgent;
  onPrimaryAgentChange: (agent: PrimaryAgent) => void;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  onToggleOptionalAgent: (agent: AnalysisOptionalAgent) => void;
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  onToggleCheckpointOptionalAgent: (agent: CheckpointOptionalAgent) => void;
  searchLocation?: SearchLocationInput;
  onSearchLocationChange?: (searchLocation: SearchLocationInput | undefined) => void;
  propertyAddress?: string;
  readyContextCount?: number;
  pendingContextCount?: number;
  hasQueuedSend?: boolean;
};

export function ComposerMetaSection({
  contextChipStrip,
  sendBlockHint,
  primaryAgent,
  onPrimaryAgentChange,
  selectedOptionalAgents,
  onToggleOptionalAgent,
  selectedCheckpointOptionalAgents,
  onToggleCheckpointOptionalAgent,
  searchLocation,
  onSearchLocationChange,
  propertyAddress,
  readyContextCount = 0,
  pendingContextCount = 0,
  hasQueuedSend = false,
}: ComposerMetaSectionProps) {
  const [settingsPopoverOpen, setSettingsPopoverOpen] = React.useState(false);
  const [settingsPopoverTab, setSettingsPopoverTab] = React.useState<"agent" | "location">(
    "agent",
  );
  const [composerMetaExpanded, setComposerMetaExpanded] = React.useState(true);

  const openSettings = React.useCallback((tab: "agent" | "location") => {
    setSettingsPopoverTab(tab);
    setSettingsPopoverOpen(true);
  }, []);

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

  const metaRow = composerMetaExpanded ? (
    <>
      {contextChipStrip}
      {sendBlockHint ? (
        <p className="text-xs text-muted-foreground">{sendBlockHint}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <CompactSettingsBar
          primaryAgent={primaryAgent}
          selectedOptionalAgents={selectedOptionalAgents}
          selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
          searchLocation={searchLocation}
          propertyAddress={propertyAddress}
          onOpenSettings={() => openSettings("agent")}
          onAgentPress={() => openSettings("agent")}
          onLocationPress={() => openSettings("location")}
          showSettingsButton={false}
          className="mb-0 min-w-0 shrink"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => openSettings("agent")}
          aria-label="Open chat settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setComposerMetaExpanded(false)}
          aria-label="Collapse chat settings and context"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </>
  ) : (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => openSettings("agent")}
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
          className="h-8 w-8 shrink-0"
          onClick={() => setComposerMetaExpanded(true)}
          aria-label="Expand chat settings and context"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>
      {sendBlockHint ? (
        <p className="mt-2 text-xs text-muted-foreground">{sendBlockHint}</p>
      ) : null}
    </>
  );

  return (
    <ChatSettingsPopover
      open={settingsPopoverOpen}
      onOpenChange={setSettingsPopoverOpen}
      primaryAgent={primaryAgent}
      onPrimaryAgentChange={onPrimaryAgentChange}
      selectedOptionalAgents={selectedOptionalAgents}
      onToggleOptionalAgent={onToggleOptionalAgent}
      selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
      onToggleCheckpointOptionalAgent={onToggleCheckpointOptionalAgent}
      searchLocation={searchLocation}
      onSearchLocationChange={onSearchLocationChange}
      propertyAddress={propertyAddress}
      initialTab={settingsPopoverTab}
      anchor={<div className="mb-3 w-full">{metaRow}</div>}
    />
  );
}
