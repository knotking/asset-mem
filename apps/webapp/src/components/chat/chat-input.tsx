
import { useState, useRef, useEffect, type FormEvent, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, X, File, Square, AlertCircle, Building, Check, FileText, Send, Camera, ShieldCheck, Hammer, Wrench, BadgeDollarSign, MapPin, Navigation, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import type { FileAttachment, Property, Document as DocumentType, LocationData, LocationType, PrimaryAgent } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { CameraCaptureDialog } from "./camera-capture-dialog";
import { ANALYSIS_OPTIONAL_AGENTS, type AnalysisOptionalAgent } from "@/lib/types";
import type { Checkpoint } from "@/lib/types";

type OptionalAgentOption = {
  id: AnalysisOptionalAgent;
  label: string;
  icon: LucideIcon;
};

const OPTIONAL_AGENT_OPTIONS: OptionalAgentOption[] = [
  { id: 'coverage', label: 'Coverage', icon: ShieldCheck },
  { id: 'diy', label: 'DIY', icon: Hammer },
  { id: 'service', label: 'Service', icon: Wrench },
  { id: 'cost', label: 'Cost', icon: BadgeDollarSign },
];

type Props = {
  onSend: (message: string) => void;
  isLoading: boolean;
  onStop: () => void;
  fileAttachment: FileAttachment | null;
  onFileChange: (file: File) => void;
  onFileRemove: () => void;
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
  // Checkpoint selection
  selectedCheckpoints?: Checkpoint[];
  onOpenCheckpointDrawer?: () => void;
  onRemoveCheckpoint?: (checkpoint: Checkpoint) => void;
  // Location
  locationData?: LocationData;
  onLocationDataChange?: (locationData: LocationData | undefined) => void;
  propertyAddress?: string;
};

export const ChatInput = forwardRef<HTMLInputElement, Props>(({ 
    onSend, 
    isLoading, 
    onStop, 
    fileAttachment, 
    onFileChange, 
    onFileRemove, 
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
    selectedCheckpoints = [],
    onOpenCheckpointDrawer,
    onRemoveCheckpoint,
    locationData,
    onLocationDataChange,
    propertyAddress,
}, ref) => {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const internalFileInputRef = useRef<HTMLInputElement>(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [showLocationOptions, setShowLocationOptions] = useState(false);
  // Default to 'location' (current location) if no locationData provided
  const [locationType, setLocationType] = useState<LocationType | undefined>(locationData?.locationType || 'location');
  const [locationRadius, setLocationRadius] = useState<number>(locationData?.locationRadius || 50);
  
  useImperativeHandle(ref, () => internalFileInputRef.current!);


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
        onFileChange(selectedFile);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (content.trim() || fileAttachment?.downloadURL || selectedProperty || selectedDocuments.length > 0) {
      onSend(content.trim());
      setContent("");
      textareaRef.current?.style.setProperty('height', 'auto');
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent<HTMLFormElement>);
    }
  };
  
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    setContent(target.value);
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
  };

  const isUploading = fileAttachment && fileAttachment.progress < 100 && !fileAttachment.error;
  const isSendDisabled = isLoading || (fileAttachment && !fileAttachment.downloadURL) || (!content.trim() && !fileAttachment?.downloadURL && !selectedProperty && selectedDocuments.length === 0);
  
  const [popoverOpen, setPopoverOpen] = useState(false);
  const handleOptionalAgentToggle = (agent: AnalysisOptionalAgent) => {
    const isSelected = selectedOptionalAgents.includes(agent);
    const nextSelection = isSelected
      ? selectedOptionalAgents.filter((item) => item !== agent)
      : [...selectedOptionalAgents, agent];
    const canonicalSelection = ANALYSIS_OPTIONAL_AGENTS.filter((item) => nextSelection.includes(item));
    onOptionalAgentsChange(canonicalSelection);
  };
  
  const handlePropertySelect = (property: Property) => {
    if (onPropertySelect) {
      if (selectedProperty?.address === property.address) {
          onPropertySelect(null);
      } else {
          onPropertySelect(property);
      }
    }
    setPopoverOpen(false);
  };
  
  const handleDocumentSelect = (doc: DocumentType) => {
    if (onDocumentSelect) {
        onDocumentSelect(doc);
    }
    // Keep popover open for multi-select
  }

  // Location handling
  const handleLocationTypeChange = (type: LocationType) => {
    setLocationType(type);
    if (type === 'address') {
      // Use property address if available
      if (propertyAddress) {
        const newLocationData: LocationData = {
          locationType: 'address',
          locationRadius: locationRadius,
        };
        onLocationDataChange?.(newLocationData);
      } else {
        // Clear location data if no address available
        onLocationDataChange?.(undefined);
      }
    } else if (type === 'location') {
      // Keep existing coordinates if available, otherwise prompt for location
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

  // Sync locationData changes and set default to 'location'
  useEffect(() => {
    if (locationData) {
      setLocationType(locationData.locationType);
      if (locationData.locationRadius !== undefined) {
        setLocationRadius(locationData.locationRadius);
      }
    } else {
      // Default to 'location' (current location) when no locationData
      setLocationType('location');
    }
  }, [locationData]);


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
  const allowFileAttachment = !!onFileChange;
  const hasFileAttached = !!fileAttachment;
  const handleCameraCapture = (file: File) => {
    onFileChange(file);
    setCameraDialogOpen(false);
  };

  return (
    <div className="w-full relative">
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
                        <div className="relative flex-shrink-0">
                            {renderPreview()}
                        </div>
                        <div className="flex flex-col justify-center flex-grow min-w-0 pt-2">
                            <p className="text-sm font-medium text-foreground break-words truncate">{fileAttachment.file.name}</p>
                            {isUploading && (
                                <div className="mt-2">
                                    <Progress value={fileAttachment.progress} className="h-2" />
                                    <p className="text-xs text-muted-foreground mt-1">{Math.round(fileAttachment.progress)}% uploaded</p>
                                </div>
                            )}
                            {fileAttachment.downloadURL && !fileAttachment.error && (
                                <p className="text-xs text-green-600 mt-1">Upload complete</p>
                            )}
                            {fileAttachment.error && (
                                <div className="flex items-center text-red-600 gap-2 mt-1">
                                    <AlertCircle className="h-4 w-4" />
                                    <p className="text-xs font-medium">{fileAttachment.error}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

      <form onSubmit={handleSubmit} className="relative flex w-full items-end gap-2">
        <div className="flex flex-1 flex-col gap-3">
          {/* Primary Agent Selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agent:</span>
            <button
              type="button"
              onClick={() => onPrimaryAgentChange('analysis')}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                primaryAgent === 'analysis'
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              Analysis
            </button>
            <button
              type="button"
              onClick={() => onPrimaryAgentChange('checkpoint')}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                primaryAgent === 'checkpoint'
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              Checkpoints
            </button>
          </div>

          {/* Selected Checkpoints Display */}
          {primaryAgent === 'checkpoint' && selectedCheckpoints.length > 0 && (
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
                  {checkpoint.name || 'Checkpoint'}
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

          {/* Checkpoint Selection Button */}
          {primaryAgent === 'checkpoint' && selectedCheckpoints.length === 0 && onOpenCheckpointDrawer && (
            <button
              type="button"
              onClick={onOpenCheckpointDrawer}
              className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              <Clock className="h-4 w-4" />
              <span>Select checkpoints for context</span>
            </button>
          )}

          {/* Optional Agents (only for analysis agent) */}
          {primaryAgent === 'analysis' && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wide">
                Triage required
              </Badge>
              {OPTIONAL_AGENT_OPTIONS.map((option) => {
                const isSelected = selectedOptionalAgents.includes(option.id);
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleOptionalAgentToggle(option.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
              {selectedOptionalAgents.length === 0 && (
                <span className="text-xs text-muted-foreground">Only triage will run</span>
              )}
            </div>
          )}

          {/* Location Selection */}
          {onLocationDataChange && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowLocationOptions(!showLocationOptions)}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2">
                  {locationType === 'location' ? (
                    <Navigation className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {locationType === 'address'
                      ? propertyAddress 
                        ? `Address: ${propertyAddress.substring(0, 30)}${propertyAddress.length > 30 ? '...' : ''}`
                        : 'Address (not set)'
                      : locationType === 'location'
                        ? locationData?.locationCoordinates
                          ? `Current Location (${locationData.locationCoordinates.lat.toFixed(4)}, ${locationData.locationCoordinates.lng.toFixed(4)})`
                          : 'Current Location'
                        : 'Location'}
                    {locationData?.locationRadius && (locationType === 'address' || locationType === 'location') 
                      ? ` • ${locationData.locationRadius} mi radius` 
                      : locationType === 'location' && !locationData?.locationCoordinates
                        ? ` • ${locationRadius} mi radius`
                        : ''}
                  </span>
                </div>
                <X className={`h-4 w-4 text-muted-foreground transition-transform ${showLocationOptions ? 'rotate-45' : ''}`} />
              </button>

              {showLocationOptions && (
                <div className="rounded-lg border border-border bg-background p-3 space-y-3">
                  {/* Location Type Selector */}
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-2 block">Location Type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleLocationTypeChange('address')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                          locationType === 'address'
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-transparent text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        Address
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLocationTypeChange('location')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                          locationType === 'location'
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-transparent text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        Location
                      </button>
                    </div>
                  </div>

                  {/* Location Type Descriptions */}
                  {locationType === 'address' && propertyAddress && (
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">
                        Using property address for location-based search. The address will be geocoded to coordinates for precise radius filtering.
                      </p>
                    </div>
                  )}
                  
                  {locationType === 'address' && !propertyAddress && (
                    <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-2">
                      <p className="text-xs text-yellow-700 dark:text-yellow-400">
                        No property address available. Please select a property or switch to Location type.
                      </p>
                    </div>
                  )}

                  {/* Current Location Status Display */}
                  {locationType === 'location' && locationData?.locationCoordinates && (
                    <div className="rounded-md bg-green-500/10 border border-green-500/20 p-2">
                      <p className="text-xs text-green-700 dark:text-green-400">
                        ✓ Location set: {locationData.locationCoordinates.lat.toFixed(6)}, {locationData.locationCoordinates.lng.toFixed(6)}
                      </p>
                    </div>
                  )}

                  {/* Radius Selector - Show for both address and location types */}
                  {(locationType === 'location' || locationType === 'address') && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-foreground">Search Radius</label>
                        <span className="text-xs font-medium text-muted-foreground">{locationRadius} miles</span>
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
                          <button
                            key={radius}
                            type="button"
                            onClick={() => handleRadiusChange(radius)}
                            className={cn(
                              "flex-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
                              locationRadius === radius
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-transparent text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {radius}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="relative flex w-full items-center rounded-lg bg-muted">
            <Textarea
              ref={textareaRef}
              value={content}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 resize-none max-h-48 overflow-y-auto bg-transparent border-0 shadow-none focus-visible:ring-0 pl-4 py-2.5 pr-24"
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
                <PopoverContent className="w-[300px] p-0 mb-2" side="top" align="end">
                  <Command>
                    <CommandInput placeholder="Filter properties..." />
                    <CommandList>
                      <CommandEmpty>No properties found.</CommandEmpty>
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
                                selectedProperty?.address === prop.address ? "opacity-100" : "opacity-0"
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
                <PopoverContent className="w-[350px] p-0 mb-2" side="top" align="end">
                  <Command>
                    <CommandInput placeholder="Filter documents..." />
                    <CommandList>
                      <CommandEmpty>No documents found.</CommandEmpty>
                      <CommandGroup>
                        {documents.map((doc) => {
                          const isSelected = selectedDocuments.some((d) => d.id === doc.id);
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
                                  isSelected ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex-1 truncate">{doc.name}</div>
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
                  onClick={() => setCameraDialogOpen(true)}
                  disabled={isLoading || hasFileAttached}
                  type="button"
                  aria-label="Open camera"
                >
                  <Camera className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </div>
        {isLoading ? (
            <Button
                type="button"
                size="icon"
                className="flex-shrink-0 h-10 w-10 rounded-md bg-muted-foreground text-background"
                onClick={onStop}
                aria-label="Stop processing"
                variant="destructive"
            >
                <Square className="h-5 w-5" />
            </Button>
        ) : (
            <Button 
                type="submit" 
                size="icon" 
                className="flex-shrink-0 h-10 w-10 rounded-md bg-muted-foreground text-background"
                disabled={isSendDisabled}
                aria-label="Send message"
            >
                <Send className="h-5 w-5" />
            </Button>
        )}
      </form>
      {allowFileAttachment && (
        <CameraCaptureDialog
          open={cameraDialogOpen}
          onOpenChange={setCameraDialogOpen}
          onCapture={handleCameraCapture}
        />
      )}
    </div>
  );
});
ChatInput.displayName = 'ChatInput';
