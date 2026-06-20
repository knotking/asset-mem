import {
  useState,
  useRef,
  type FormEvent,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Paperclip,
  X,
  File,
  Square,
  AlertCircle,
  Building,
  Check,
  FileText,
  Send,
  Camera,
  Clock,
  Settings,
} from "lucide-react";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import type {
  FileAttachment,
  Property,
  Document as DocumentType,
  PrimaryAgent,
} from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "../ui/badge";
import { CameraCaptureDialog } from "./camera-capture-dialog";
import { pickFromNativeCamera, supportsInBrowserCamera } from "@/lib/camera-capability";
import {
  ANALYSIS_OPTIONAL_AGENTS,
  CHECKPOINT_OPTIONAL_AGENTS,
  type AnalysisOptionalAgent,
  type CheckpointOptionalAgent,
} from "@/lib/types";
import type { Checkpoint } from "@/lib/types";
import { CompactSettingsBar } from "./compact-settings-bar";
import { PopoverAnchor } from "@/components/ui/popover";
import { ChatSettingsPopover } from "./chat-settings-popover";
import { ComposerMetaSection } from "./composer-meta-section";

type Props = {
  onSend: (message: string) => void;
  isLoading: boolean;
  onStop: () => void;
  fileAttachment?: FileAttachment | null;
  onFileChange?: (file: File) => void;
  onFileRemove?: () => void;
  onOpenAddContext?: () => void;
  contextChipStrip?: React.ReactNode;
  sendBlockHint?: string | null;
  // Property context props (for property hub)
  properties?: Property[];
  selectedProperty?: Property | null;
  onPropertySelect?: (property: Property | null) => void;
  // Document context props (for general chat)
  documents?: DocumentType[];
  selectedDocuments?: DocumentType[];
  onDocumentSelect?: (doc: DocumentType) => void;
  placeholder?: string;
  // Agent selection
  primaryAgent: PrimaryAgent;
  onPrimaryAgentChange: (agent: PrimaryAgent) => void;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  onOptionalAgentsChange: (agents: AnalysisOptionalAgent[]) => void;
  // Checkpoint agent selection
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  onCheckpointOptionalAgentsChange: (agents: CheckpointOptionalAgent[]) => void;
  // Checkpoint selection
  selectedCheckpoints?: Checkpoint[];
  onOpenCheckpointDrawer?: () => void;
  onRemoveCheckpoint?: (checkpoint: Checkpoint) => void;
  // Location
  searchLocation?: import("@/lib/types").SearchLocationInput;
  onSearchLocationChange?: (
    searchLocation: import("@/lib/types").SearchLocationInput | undefined,
  ) => void;
  propertyAddress?: string;
  readyContextCount?: number;
  pendingContextCount?: number;
  hasQueuedSend?: boolean;
};

export const ChatInput = forwardRef<HTMLInputElement, Props>(
  (
    {
      onSend,
      isLoading,
      onStop,
      fileAttachment = null,
      onFileChange,
      onFileRemove,
      onOpenAddContext,
      contextChipStrip,
      sendBlockHint,
      properties = [],
      selectedProperty,
      onPropertySelect,
      documents = [],
      selectedDocuments = [],
      onDocumentSelect,
      placeholder = "Ask about your property...",
      primaryAgent,
      onPrimaryAgentChange,
      selectedOptionalAgents,
      onOptionalAgentsChange,
      selectedCheckpointOptionalAgents,
      onCheckpointOptionalAgentsChange,
      selectedCheckpoints = [],
      onOpenCheckpointDrawer,
      onRemoveCheckpoint,
      searchLocation,
      onSearchLocationChange,
      propertyAddress,
      readyContextCount = 0,
      pendingContextCount = 0,
      hasQueuedSend = false,
    },
    ref,
  ) => {
    const [content, setContent] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const internalFileInputRef = useRef<HTMLInputElement>(null);
    const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
    const [settingsPopoverOpen, setSettingsPopoverOpen] = useState(false);
    const [settingsPopoverTab, setSettingsPopoverTab] = useState<
      "agent" | "location"
    >("agent");
    const isMobile = useIsMobile();

    const handleTextareaFocus = () => {
      if (!isMobile) return;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        const viewport = window.visualViewport;
        if (viewport) {
          const keyboardInset = Math.max(
            0,
            window.innerHeight - viewport.height - viewport.offsetTop,
          );
          if (keyboardInset > 48) {
            el.scrollIntoView({ block: "end", behavior: "smooth" });
          }
        }
      });
    };

    useImperativeHandle(ref, () => internalFileInputRef.current!);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile && onFileChange) {
        onFileChange(selectedFile);
      }
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (
        content.trim() ||
        fileAttachment?.downloadURL ||
        selectedProperty ||
        selectedDocuments.length > 0
      ) {
        onSend(content.trim());
        setContent("");
        textareaRef.current?.style.setProperty("height", "auto");
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as FormEvent<HTMLFormElement>);
      }
    };

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      const target = e.currentTarget;
      setContent(target.value);
      target.style.height = "auto";
      target.style.height = `${target.scrollHeight}px`;
    };

    const useContextMode = !!onOpenAddContext;
    const isUploading =
      fileAttachment && fileAttachment.progress < 100 && !fileAttachment.error;
    const isSendDisabled = useContextMode
      ? isLoading || !content.trim()
      : isLoading ||
        (fileAttachment && !fileAttachment.downloadURL) ||
        (!content.trim() &&
          !fileAttachment?.downloadURL &&
          !selectedProperty &&
          selectedDocuments.length === 0);

    const [popoverOpen, setPopoverOpen] = useState(false);
    const handlePropertySelect = (property: Property) => {
      onPropertySelect?.(property);
      setPopoverOpen(false);
    };
    const handleDocumentSelect = (doc: DocumentType) => {
      onDocumentSelect?.(doc);
      setPopoverOpen(false);
    };
    const handleOptionalAgentToggle = (agent: AnalysisOptionalAgent) => {
      const isSelected = selectedOptionalAgents.includes(agent);
      const nextSelection = isSelected
        ? selectedOptionalAgents.filter((item) => item !== agent)
        : [...selectedOptionalAgents, agent];
      const canonicalSelection = ANALYSIS_OPTIONAL_AGENTS.filter((item) =>
        nextSelection.includes(item),
      );
      onOptionalAgentsChange(canonicalSelection);
    };

    const handleCheckpointOptionalAgentToggle = (
      agent: CheckpointOptionalAgent,
    ) => {
      const isSelected = selectedCheckpointOptionalAgents.includes(agent);
      const nextSelection = isSelected
        ? selectedCheckpointOptionalAgents.filter((item) => item !== agent)
        : [...selectedCheckpointOptionalAgents, agent];
      const canonicalSelection = CHECKPOINT_OPTIONAL_AGENTS.filter((item) =>
        nextSelection.includes(item),
      );
      onCheckpointOptionalAgentsChange(canonicalSelection);
    };

    const renderPreview = () => {
      if (!fileAttachment) return null;

      const fileType = fileAttachment.file.type;

      if (fileType.startsWith("image/")) {
        return (
          <div className="relative h-24 w-24">
            <Image
              src={fileAttachment.previewUrl}
              alt={fileAttachment.file.name}
              fill
              className="rounded-md object-cover"
            />
          </div>
        );
      }

      if (fileType.startsWith("video/")) {
        return (
          <div className="relative h-24 w-24">
            <video
              src={fileAttachment.previewUrl}
              autoPlay
              loop
              muted
              playsInline
              className="rounded-md object-cover h-full w-full"
            />
          </div>
        );
      }

      return (
        <div className="flex h-24 w-24 items-center justify-center rounded-md bg-primary/10">
          <File className="h-10 w-10 text-primary" />
        </div>
      );
    };

    const showPropertySelector = false; // Disabled for now
    const showDocumentSelector = false; // Disabled for now
    const allowFileAttachment = !!onFileChange && !useContextMode;
    const hasFileAttached = !!fileAttachment;
    const handleCameraCapture = (file: File) => {
      onFileChange?.(file);
      setCameraDialogOpen(false);
    };

    const handleOpenCamera = async () => {
      if (!supportsInBrowserCamera()) {
        const file = await pickFromNativeCamera("photo");
        if (file) handleCameraCapture(file);
        return;
      }
      setCameraDialogOpen(true);
    };

    const openChatSettings = (tab: "agent" | "location") => {
      setSettingsPopoverTab(tab);
      setSettingsPopoverOpen(true);
    };

    const chatSettingsPopoverProps = {
      open: settingsPopoverOpen,
      onOpenChange: setSettingsPopoverOpen,
      primaryAgent,
      onPrimaryAgentChange,
      selectedOptionalAgents,
      onToggleOptionalAgent: handleOptionalAgentToggle,
      selectedCheckpointOptionalAgents,
      onToggleCheckpointOptionalAgent: handleCheckpointOptionalAgentToggle,
      searchLocation,
      onSearchLocationChange,
      propertyAddress,
      initialTab: settingsPopoverTab,
    };

    const composerMetaSection = useContextMode ? (
      <ComposerMetaSection
        contextChipStrip={contextChipStrip}
        sendBlockHint={sendBlockHint}
      />
    ) : null;

    const composerForm = (
        <form
          onSubmit={handleSubmit}
          className={cn(
            "flex w-full min-w-0 max-w-full flex-col",
            useContextMode ? "gap-1" : "gap-2 sm:gap-2.5",
          )}
        >
          <div className="min-w-0 max-w-full space-y-2">
            {useContextMode ? (
              composerMetaSection
            ) : (
              <>
                {contextChipStrip}
                {sendBlockHint ? (
                  <p className="text-xs text-muted-foreground">{sendBlockHint}</p>
                ) : null}
                <ChatSettingsPopover
                  open={settingsPopoverOpen}
                  onOpenChange={setSettingsPopoverOpen}
                  primaryAgent={primaryAgent}
                  onPrimaryAgentChange={onPrimaryAgentChange}
                  selectedOptionalAgents={selectedOptionalAgents}
                  onToggleOptionalAgent={handleOptionalAgentToggle}
                  selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
                  onToggleCheckpointOptionalAgent={handleCheckpointOptionalAgentToggle}
                  searchLocation={searchLocation}
                  onSearchLocationChange={onSearchLocationChange}
                  propertyAddress={propertyAddress}
                  initialTab={settingsPopoverTab}
                >
                  <div onClick={() => setSettingsPopoverOpen(true)}>
                    <CompactSettingsBar
                      primaryAgent={primaryAgent}
                      selectedOptionalAgents={selectedOptionalAgents}
                      selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
                      searchLocation={searchLocation}
                      propertyAddress={propertyAddress}
                      onOpenSettings={() => {
                        setSettingsPopoverTab("agent");
                        setSettingsPopoverOpen(true);
                      }}
                      onAgentPress={() => {
                        setSettingsPopoverTab("agent");
                        setSettingsPopoverOpen(true);
                      }}
                      onLocationPress={() => {
                        setSettingsPopoverTab("location");
                        setSettingsPopoverOpen(true);
                      }}
                    />
                  </div>
                </ChatSettingsPopover>
              </>
            )}
            {!useContextMode &&
              primaryAgent === "checkpoint" &&
              selectedCheckpoints.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Selected:
                  </span>
                  {selectedCheckpoints.map((checkpoint) => (
                    <Badge
                      key={checkpoint.id}
                      variant="secondary"
                      className="gap-1 pl-2 pr-1"
                    >
                      {checkpoint.name || "Checkpoint"}
                      {onRemoveCheckpoint && (
                        <button
                          type="button"
                          onClick={() => onRemoveCheckpoint(checkpoint)}
                          className="ml-1 rounded-full hover:bg-muted p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                  {onOpenCheckpointDrawer && (
                    <button
                      type="button"
                      onClick={onOpenCheckpointDrawer}
                      className="text-xs text-primary hover:underline"
                    >
                      + Add more
                    </button>
                  )}
                </div>
              )}

            {!useContextMode &&
              primaryAgent === "checkpoint" &&
              selectedCheckpoints.length === 0 &&
              onOpenCheckpointDrawer && (
                <button
                  type="button"
                  onClick={onOpenCheckpointDrawer}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Clock className="h-4 w-4" />
                  <span>Select checkpoints for context</span>
                </button>
              )}
          </div>

          <div
            className={cn(
              "grid w-full min-w-0 items-center gap-2",
              useContextMode
                ? "grid-cols-[auto_minmax(0,1fr)_auto]"
                : "grid-cols-[minmax(0,1fr)_auto]",
            )}
          >
            {useContextMode ? (
              isMobile ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0 md:size-10"
                  onClick={() => openChatSettings("agent")}
                  aria-label="Open chat settings"
                >
                  <Settings className="size-[18px]" />
                </Button>
              ) : (
                <PopoverAnchor asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11 shrink-0 md:size-10"
                    onClick={() => openChatSettings("agent")}
                    aria-label="Open chat settings"
                  >
                    <Settings className="size-[18px]" />
                  </Button>
                </PopoverAnchor>
              )
            ) : null}

            <div className="relative flex min-h-10 min-w-0 items-center overflow-hidden rounded-lg bg-muted">
              <Textarea
                ref={textareaRef}
                value={content}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onFocus={handleTextareaFocus}
                placeholder={placeholder}
                className="min-h-10 min-w-0 flex-1 resize-none max-h-48 overflow-y-auto bg-transparent border-0 shadow-none focus-visible:ring-0 px-3 py-2 leading-5"
                rows={1}
                disabled={isLoading}
                aria-label="Chat input"
              />
              <input
                type="file"
                ref={internalFileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                disabled={isLoading || hasFileAttached}
                id="file-input"
                accept="image/*,video/*"
              />

              {showPropertySelector && (
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0"
                      disabled={isLoading}
                      type="button"
                      aria-label="Set property context"
                    >
                      <Building className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[300px] p-0 mb-2"
                    side="top"
                    align="end"
                  >
                    <Command>
                      <CommandInput placeholder="Filter properties..." />
                      <CommandList>
                        {/* <CommandEmpty>No properties found.</CommandEmpty> */}
                        <CommandGroup>
                          {properties.map((prop) => (
                            <CommandItem
                              key={prop.address}
                              value={prop.address}
                              onSelect={() => handlePropertySelect(prop)}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedProperty?.address === prop.address
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {prop.address}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}

              {showDocumentSelector && (
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0"
                      disabled={isLoading}
                      type="button"
                      aria-label="Set document context"
                    >
                      <FileText className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[350px] p-0 mb-2"
                    side="top"
                    align="end"
                  >
                    <Command>
                      <CommandInput placeholder="Filter documents..." />
                      <CommandList>
                        <CommandEmpty>No documents found.</CommandEmpty>
                        <CommandGroup>
                          {documents.map((doc) => {
                            const isSelected = selectedDocuments.some(
                              (d) => d.id === doc.id,
                            );
                            return (
                              <CommandItem
                                key={doc.id}
                                value={doc.name}
                                onSelect={() => handleDocumentSelect(doc)}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    isSelected ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <div className="flex-1 truncate">
                                  {doc.name}
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}

              {allowFileAttachment && (
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => internalFileInputRef.current?.click()}
                    disabled={isLoading || hasFileAttached}
                    type="button"
                    aria-label="Attach file"
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => void handleOpenCamera()}
                    disabled={isLoading || hasFileAttached}
                    type="button"
                    aria-label="Open camera"
                  >
                    <Camera className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>

          {isLoading ? (
            <Button
              type="button"
              size="icon"
              className="size-11 shrink-0 bg-muted-foreground text-background hover:bg-muted-foreground/90 md:size-10"
              onClick={onStop}
              aria-label="Stop processing"
              variant="destructive"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="size-11 shrink-0 bg-muted-foreground text-background hover:bg-muted-foreground/90 md:size-10"
              disabled={isSendDisabled}
              aria-label="Send message"
            >
              <Send className="size-4" />
            </Button>
          )}
          </div>
        </form>
    );

    return (
      <div className="relative w-full min-w-0">
        {hasFileAttached && (
          <div className="absolute bottom-full mb-2 w-full max-w-md">
            <div className="relative p-2 border rounded-lg bg-card shadow-lg">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 z-10 bg-black/20 hover:bg-black/50 text-white hover:text-white"
                onClick={onFileRemove}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove file</span>
              </Button>
              <div className="flex items-start gap-4">
                <div className="relative flex-shrink-0">{renderPreview()}</div>
                <div className="flex flex-col justify-center flex-grow min-w-0 pt-2">
                  <p className="text-sm font-medium text-foreground break-words truncate">
                    {fileAttachment.file.name}
                  </p>
                  {isUploading && (
                    <div className="mt-2">
                      <Progress
                        value={fileAttachment.progress}
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {Math.round(fileAttachment.progress)}% uploaded
                      </p>
                    </div>
                  )}
                  {fileAttachment.downloadURL && !fileAttachment.error && (
                    <p className="text-xs text-green-600 mt-1">
                      Upload complete
                    </p>
                  )}
                  {fileAttachment.error && (
                    <div className="flex items-center text-red-600 gap-2 mt-1">
                      <AlertCircle className="h-4 w-4" />
                      <p className="text-xs font-medium">
                        {fileAttachment.error}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {useContextMode ? (
          <ChatSettingsPopover {...chatSettingsPopoverProps}>
            {composerForm}
          </ChatSettingsPopover>
        ) : (
          composerForm
        )}

        {allowFileAttachment && (
          <CameraCaptureDialog
            open={cameraDialogOpen}
            onOpenChange={setCameraDialogOpen}
            onCapture={handleCameraCapture}
          />
        )}
      </div>
    );
  },
);
ChatInput.displayName = "ChatInput";
