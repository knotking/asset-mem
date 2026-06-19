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
import { ChatSettingsPopover, type ChatSettingsTab } from "./chat-settings-popover";

export type ChatSetupControl = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: ChatSettingsTab;
  onTabChange: (tab: ChatSettingsTab) => void;
};

type ComposerMetaSectionProps = {
  contextChipStrip?: React.ReactNode;
  contextPicker?: React.ReactNode;
  chatSetupControl?: ChatSetupControl;
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

function withWrapChipLayout(strip: React.ReactNode): React.ReactNode {
  if (!React.isValidElement(strip)) return strip;
  return React.cloneElement(strip as React.ReactElement<{ chipLayout?: "scroll" | "wrap" }>, {
    chipLayout: "wrap",
  });
}

export function ComposerMetaSection({
  contextChipStrip,
  contextPicker,
  chatSetupControl,
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
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [internalTab, setInternalTab] = React.useState<ChatSettingsTab>("agent");
  const [composerMetaExpanded, setComposerMetaExpanded] = React.useState(false);

  const settingsOpen = chatSetupControl?.open ?? internalOpen;
  const setSettingsOpen = chatSetupControl?.onOpenChange ?? setInternalOpen;
  const settingsTab = chatSetupControl?.tab ?? internalTab;
  const setSettingsTab = chatSetupControl?.onTabChange ?? setInternalTab;

  const hasContextContent =
    readyContextCount + pendingContextCount > 0 || hasQueuedSend;

  React.useEffect(() => {
    setComposerMetaExpanded(!isMobile);
  }, [isMobile]);

  const defaultSettingsTab = React.useCallback((): ChatSettingsTab => {
    if (isMobile && (contextChipStrip != null || contextPicker != null) && hasContextContent) {
      return "context";
    }
    return "agent";
  }, [contextChipStrip, contextPicker, hasContextContent, isMobile]);

  const openSettings = React.useCallback(
    (tab?: ChatSettingsTab) => {
      setSettingsTab(tab ?? defaultSettingsTab());
      setSettingsOpen(true);
    },
    [defaultSettingsTab, setSettingsOpen, setSettingsTab],
  );

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

  const mobileMetaRow = (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => openSettings()}
        className={cn(
          "flex w-full min-w-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-2",
          "text-left text-xs font-medium text-foreground",
        )}
        aria-label={`Chat setup: ${collapsedSummary}`}
      >
        <span className="min-w-0 flex-1 truncate">{collapsedSummary}</span>
        <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      {sendBlockHint ? (
        <p className="text-xs text-muted-foreground">{sendBlockHint}</p>
      ) : null}
    </div>
  );

  const desktopMetaRow = composerMetaExpanded ? (
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
          onOpenSettings={() => openSettings("agent")}
          onAgentPress={() => openSettings("agent")}
          onLocationPress={() => openSettings("location")}
          showSettingsButton={false}
          className="mb-0"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => openSettings("agent")}
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
          aria-label="Collapse chat settings and context"
        >
          <ChevronDown className="size-4" />
        </Button>
      </div>
    </div>
  ) : (
    <>
      <div className="flex min-w-0 max-w-full items-center gap-1.5">
        <button
          type="button"
          onClick={() => openSettings()}
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

  const metaRow = isMobile ? mobileMetaRow : desktopMetaRow;

  return (
    <ChatSettingsPopover
      open={settingsOpen}
      onOpenChange={setSettingsOpen}
      primaryAgent={primaryAgent}
      onPrimaryAgentChange={onPrimaryAgentChange}
      selectedOptionalAgents={selectedOptionalAgents}
      onToggleOptionalAgent={onToggleOptionalAgent}
      selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
      onToggleCheckpointOptionalAgent={onToggleCheckpointOptionalAgent}
      searchLocation={searchLocation}
      onSearchLocationChange={onSearchLocationChange}
      propertyAddress={propertyAddress}
      initialTab={settingsTab}
      contextSection={isMobile ? withWrapChipLayout(contextChipStrip) : undefined}
      contextPicker={isMobile ? contextPicker : undefined}
      hasContextContent={hasContextContent}
      anchor={<div className="w-full min-w-0 max-w-full">{metaRow}</div>}
    />
  );
}
