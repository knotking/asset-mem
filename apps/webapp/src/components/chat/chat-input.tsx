
import { useState, useRef, type FormEvent, forwardRef, useImperativeHandle, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, X, File, Square, AlertCircle, Camera, Building, Check, FileText, Send } from "lucide-react";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import type { FileAttachment, Property, Document as DocumentType } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const shouldSaveRecordingRef = useRef(false);
  const latestOnFileChangeRef = useRef(onFileChange);
  
  useImperativeHandle(ref, () => internalFileInputRef.current!);

  useEffect(() => {
    latestOnFileChangeRef.current = onFileChange;
  }, [onFileChange]);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<"photo" | "video">("photo");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const stopCamera = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error("Error stopping media recorder:", error);
      }
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    shouldSaveRecordingRef.current = false;
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsRecording(false);
  }, []);

  const getCameraUnavailableMessage = useCallback(() => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      const host = window.location.hostname;
      const isLocalHost =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.endsWith(".local");
      if (!isLocalHost) {
        return "Camera capture requires a secure (https) connection. Please reload the app over https or use a trusted certificate.";
      }
    }
    return "Camera access is unavailable. Check browser permissions and ensure no other app is using the camera.";
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(getCameraUnavailableMessage());
      return;
    }
    setCameraError(null);

    try {
      stopCamera();
      const constraints: MediaStreamConstraints = {
        video: { facingMode: "environment" },
        audio: captureMode === "video",
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (error) {
      console.error("Camera access error:", error);
      setCameraError("Unable to access camera. Please check permissions and try again.");
      stopCamera();
    }
  }, [captureMode, stopCamera, getCameraUnavailableMessage]);

  useEffect(() => {
    if (!isCameraOpen) {
      stopCamera();
      return;
    }

    startCamera();
    return () => {
      stopCamera();
    };
  }, [isCameraOpen, captureMode, startCamera, stopCamera]);

  const getSupportedMimeType = () => {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
      return "";
    }
    const mimeTypes = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return "";
  };

  const startRecording = useCallback(() => {
    if (!mediaStreamRef.current) {
      setCameraError("Camera is not ready yet.");
      return;
    }

    try {
      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(mediaStreamRef.current, { mimeType })
        : new MediaRecorder(mediaStreamRef.current);

      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      shouldSaveRecordingRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setCameraError("Recording failed. Please try again.");
      };

      recorder.onstop = () => {
        const shouldSave = shouldSaveRecordingRef.current;
        const chunks = recordedChunksRef.current;
        setIsRecording(false);

        if (shouldSave && chunks.length > 0) {
          const mime = recorder.mimeType || mimeType || "video/webm";
          const extension = mime.includes("mp4") ? "mp4" : "webm";
          const recordedBlob = new Blob(chunks, { type: mime });
          const fileName = `ai-chat-${Date.now()}.${extension}`;
          const file = new File([recordedBlob], fileName, { type: mime });
          latestOnFileChangeRef.current(file);
          setIsCameraOpen(false);
        }

        recordedChunksRef.current = [];
        shouldSaveRecordingRef.current = false;
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      setCameraError("Unable to start recording on this device.");
    }
  }, []);

  const stopRecording = useCallback((save: boolean) => {
    if (!mediaRecorderRef.current) return;
    shouldSaveRecordingRef.current = save;
    if (mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error("Error stopping recording:", error);
        setCameraError("Failed to stop recording.");
      }
    }
  }, []);

  const handleCapturePhoto = useCallback(async () => {
    if (!videoRef.current) {
      setCameraError("Camera preview is not available yet.");
      return;
    }

    const videoElement = videoRef.current;
    const width = videoElement.videoWidth;
    const height = videoElement.videoHeight;

    if (!width || !height) {
      setCameraError("Camera is still initializing. Please wait and try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("Unable to capture photo on this device.");
      return;
    }

    context.drawImage(videoElement, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );

    if (!blob) {
      setCameraError("Failed to capture photo. Please try again.");
      return;
    }

    const fileName = `ai-chat-${Date.now()}.jpg`;
    const file = new File([blob], fileName, { type: blob.type });
    latestOnFileChangeRef.current(file);
    setIsCameraOpen(false);
  }, []);

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

  return (
    <div className="w-full relative">
       <Dialog
          open={isCameraOpen}
          onOpenChange={(open) => {
            if (!open && isRecording) {
              stopRecording(false);
            }
            if (!open) {
              setIsCameraOpen(false);
              setCameraError(null);
              return;
            }
            if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
              setCameraError(getCameraUnavailableMessage());
              setIsCameraOpen(true);
              return;
            }
            setCaptureMode("photo");
            setIsCameraOpen(true);
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Capture media</DialogTitle>
              <DialogDescription>
                Use your camera to attach a photo or video to the chat.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={captureMode === "photo" || !isRecording}
                  className="h-full w-full object-cover"
                />
                {isRecording && (
                  <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600/80 px-3 py-1 text-xs font-semibold text-white">
                    <span className="block h-2 w-2 rounded-full bg-white animate-pulse" />
                    Recording…
                  </div>
                )}
              </div>
              {cameraError && (
                <p className="text-sm text-destructive">{cameraError}</p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant={captureMode === "photo" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCaptureMode("photo")}
                    disabled={isRecording}
                  >
                    Photo
                  </Button>
                  <Button
                    variant={captureMode === "video" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCaptureMode("video")}
                    disabled={isRecording}
                  >
                    Video
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isRecording) {
                        stopRecording(false);
                      }
                      setIsCameraOpen(false);
                      setCameraError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  {captureMode === "photo" ? (
                    <Button
                      size="sm"
                      onClick={handleCapturePhoto}
                      disabled={!!cameraError || isRecording}
                    >
                      Capture Photo
                    </Button>
                  ) : !isRecording ? (
                    <Button
                      size="sm"
                      onClick={startRecording}
                      disabled={!!cameraError}
                    >
                      Start Recording
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => stopRecording(true)}
                    >
                      Stop &amp; Attach
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
                className="flex-1 resize-none max-h-48 overflow-y-auto bg-transparent border-0 shadow-none focus-visible:ring-0 pl-4 py-2.5 pr-28"
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
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
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
                    onClick={() => {
                        if (isLoading || hasFileAttached) return;
                        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
                            setCameraError(getCameraUnavailableMessage());
                            setIsCameraOpen(true);
                            return;
                        }
                        setCameraError(null);
                        setCaptureMode("photo");
                        setIsCameraOpen(true);
                    }}
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
    </div>
  );
});
ChatInput.displayName = 'ChatInput';
