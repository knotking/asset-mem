
import { useState, useRef, type FormEvent, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, X, File, Square, AlertCircle, Building, Check, FileText, Send, Camera, ShieldCheck, Hammer, Wrench, BadgeDollarSign, MapPin, MapPinned } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import type { FileAttachment, Property, Document as DocumentType } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { CameraCaptureDialog } from "./camera-capture-dialog";
import { ANALYSIS_OPTIONAL_AGENTS, type AnalysisOptionalAgent } from "@/lib/types";
import type { Location } from '@homeapp/common/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Slider } from "../ui/slider";
import { Label } from "../ui/label";

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
  selectedOptionalAgents: AnalysisOptionalAgent[];
  onOptionalAgentsChange: (agents: AnalysisOptionalAgent[]) => void;
  location?: Location | null;
  onLocationChange?: (location: Location | null) => void;
  showLocationOption?: boolean;
  propertyAddress?: string;
  useLocationInsteadOfAddress?: boolean;
  onToggleLocationMode?: (useLocation: boolean) => void;
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
    selectedOptionalAgents,
    onOptionalAgentsChange,
    location,
    onLocationChange,
    showLocationOption = false,
    propertyAddress,
    useLocationInsteadOfAddress = false,
    onToggleLocationMode,
}, ref) => {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const internalFileInputRef = useRef<HTMLInputElement>(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [tempRadius, setTempRadius] = useState<number>(location?.radius || 25);
  
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

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser. Please use a modern browser with location services enabled.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          radius: tempRadius,
        };
        if (onLocationChange) {
          onLocationChange(newLocation);
        }
        setLocationDialogOpen(false);
      },
      (error) => {
        let errorMessage = 'Failed to get location. ';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Location permission was denied. Please enable location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Location request timed out. Please try again.';
            break;
          default:
            errorMessage += error.message || 'Unknown error occurred.';
            break;
        }
        alert(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleRemoveLocation = () => {
    if (onLocationChange) {
      onLocationChange(null);
    }
    setLocationDialogOpen(false);
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
          <div className="flex flex-wrap items-center justify-between gap-2">
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
            {/* Address/Location Toggle - Right side */}
            {propertyAddress && onToggleLocationMode && (
              <div className="flex items-center gap-1 border-l border-border pl-3">
                <button
                  type="button"
                  onClick={() => onToggleLocationMode(false)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors",
                    !useLocationInsteadOfAddress
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                  title="Use property address for location-based searches"
                >
                  <MapPinned className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!location) {
                      setLocationDialogOpen(true);
                    }
                    onToggleLocationMode(true);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors",
                    useLocationInsteadOfAddress
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                  title={location ? "Use current location for searches" : "Set your current location"}
                >
                  <MapPin className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
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
                {showLocationOption && (
                  <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant={location ? "default" : "ghost"}
                        size="icon"
                        className={cn(
                          "flex-shrink-0",
                          location && "bg-primary text-primary-foreground"
                        )}
                        disabled={isLoading}
                        type="button"
                        aria-label="Set location"
                      >
                        <MapPin className="h-5 w-5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Set Location</DialogTitle>
                        <DialogDescription>
                          Use your current location to find nearby services. The search radius can be adjusted from 10 to 100 miles.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="radius">Search Radius: {tempRadius} miles</Label>
                          <Slider
                            id="radius"
                            min={10}
                            max={100}
                            step={5}
                            value={[tempRadius]}
                            onValueChange={(value) => setTempRadius(value[0])}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>10 miles</span>
                            <span>100 miles</span>
                          </div>
                        </div>
                        {location && (
                          <div className="text-sm text-muted-foreground">
                            Current location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button onClick={handleGetCurrentLocation} className="flex-1">
                            {location ? "Update Location" : "Use Current Location"}
                          </Button>
                          {location && (
                            <Button variant="outline" onClick={handleRemoveLocation}>
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
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
