
import { useState, useRef, type FormEvent, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, X, File, Square, AlertCircle, Video, Building, Check, ChevronsUpDown, FileText, Send, Camera } from "lucide-react";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import type { FileAttachment, Property, Document as DocumentType } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { CameraCaptureDialog } from "./camera-capture-dialog";

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
    placeholder = "Ask about your property..." 
}, ref) => {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const internalFileInputRef = useRef<HTMLInputElement>(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  
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
        <div className="relative flex-1 flex items-center rounded-lg bg-muted">
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
                                  const isSelected = selectedDocuments.some(d => d.id === doc.id);
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
                                )})}
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
