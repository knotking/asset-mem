"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Camera as CameraIcon, Circle, RefreshCw, StopCircle, Video } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createLogger } from "@/lib/logger";
import { getCameraLabel, useCameraDevices } from "@/hooks/use-camera-devices";
import {
  getCameraUnsupportedMessage,
  pickFromNativeCamera,
  supportsInBrowserCamera,
  type CameraFacingMode,
} from "@/lib/camera-capability";

const cameraLog = createLogger("camera");

type CameraCaptureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  /** When the dialog opens, start in photo or video mode. */
  initialMode?: "photo" | "video";
};

const getSupportedMimeType = (): string | null => {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") return null;
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  for (const type of types) {
    try {
      if (window.MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    } catch {
      continue;
    }
  }
  return null;
};

export function CameraCaptureDialog({
  open,
  onOpenChange,
  onCapture,
  initialMode = "photo",
}: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const shouldSaveRecordingRef = useRef(false);
  const wasOpenRef = useRef(false);

  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [selectedFacingMode, setSelectedFacingMode] = useState<"user" | "environment">("environment");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isStreamLoading, setIsStreamLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCameraAccess, setHasCameraAccess] = useState(true);

  const { devices: videoDevices, refreshDevices } = useCameraDevices(open);

  const inBrowserCameraSupported = supportsInBrowserCamera();
  const useNativeCameraFallback = open && !inBrowserCameraSupported;

  const canRecordVideo =
    typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";

  type CameraSelection = {
    deviceId: string | null;
    facingMode: "user" | "environment";
  };

  const buildVideoConstraints = useCallback((selection: CameraSelection): MediaTrackConstraints => {
    if (selection.deviceId) {
      return { deviceId: { exact: selection.deviceId } };
    }
    return { facingMode: { ideal: selection.facingMode } };
  }, []);

  const getCurrentSelection = useCallback(
    (): CameraSelection => ({
      deviceId: selectedDeviceId,
      facingMode: selectedFacingMode,
    }),
    [selectedDeviceId, selectedFacingMode],
  );

  const stopRecording = useCallback(
    (shouldSave: boolean) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return;

      shouldSaveRecordingRef.current = shouldSave;
      if (recorder.state !== "inactive") {
        recorder.stop();
      } else if (!shouldSave) {
        recordedChunksRef.current = [];
        shouldSaveRecordingRef.current = false;
      }
    },
    []
  );

  const stopStream = useCallback(() => {
    stopRecording(false);
    setIsRecording(false);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stopRecording]);

  const attachStreamToVideo = useCallback(() => {
    const video = videoRef.current;
    const stream = mediaStreamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      void video.play().catch(() => {
        // Some browsers require explicit user interaction; ignore play errors.
      });
    }
  }, []);

  const setVideoElement = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node) attachStreamToVideo();
    },
    [attachStreamToVideo]
  );

  const initStream = useCallback(
    async (captureMode: "photo" | "video", selectionOverride?: CameraSelection) => {
      if (!supportsInBrowserCamera()) {
        setHasCameraAccess(false);
        setError(getCameraUnsupportedMessage());
        return;
      }

      const selection = selectionOverride ?? getCurrentSelection();

      stopStream();
      setIsStreamLoading(true);
      setError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: buildVideoConstraints(selection),
          audio: captureMode === "video" && canRecordVideo,
        });

        mediaStreamRef.current = stream;
        attachStreamToVideo();

        const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId;
        if (activeDeviceId) {
          setSelectedDeviceId(activeDeviceId);
        } else {
          setSelectedDeviceId(selection.deviceId);
        }
        setSelectedFacingMode(selection.facingMode);
        await refreshDevices();
        setHasCameraAccess(true);
      } catch (err) {
        cameraLog.error("access.failed", undefined, err);
        setHasCameraAccess(false);
        setError("Unable to access camera. Please check your browser permissions.");
      } finally {
        setIsStreamLoading(false);
      }
    },
    [
      attachStreamToVideo,
      buildVideoConstraints,
      canRecordVideo,
      getCurrentSelection,
      refreshDevices,
      stopStream,
    ],
  );

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      stopStream();
      setError(null);
      setIsStreamLoading(false);
      setHasCameraAccess(true);
      setSelectedFacingMode("environment");
      setSelectedDeviceId(null);
      if (mode !== "photo") {
        setMode("photo");
      }
      return;
    }

    if (!supportsInBrowserCamera()) {
      stopStream();
      setIsStreamLoading(false);
      setHasCameraAccess(false);
      setError(getCameraUnsupportedMessage());
      return;
    }

    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    const resolvedInitialMode =
      initialMode === "video" && canRecordVideo ? "video" : "photo";
    const streamMode = justOpened ? resolvedInitialMode : mode;

    if (justOpened && streamMode !== mode) {
      setMode(streamMode);
    }

    // Defer until the dialog video element is mounted (Radix portal/animation).
    const frameId = requestAnimationFrame(() => {
      void initStream(streamMode);
    });

    return () => {
      cancelAnimationFrame(frameId);
      stopStream();
    };
  }, [open, mode, initialMode, canRecordVideo, initStream, stopStream]);

  useEffect(() => {
    if (!canRecordVideo && mode === "video") {
      setMode("photo");
    }
  }, [canRecordVideo, mode]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      stopRecording(false);
    }
    onOpenChange(nextOpen);
  };

  const handleCapturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!video.videoWidth || !video.videoHeight) {
      setError("Camera is still initializing. Please try again in a moment.");
      return;
    }

    // Validate minimum resolution for document capture
    const MIN_RECOMMENDED_WIDTH = 640;
    const MIN_RECOMMENDED_HEIGHT = 480;
    
    if (video.videoWidth < MIN_RECOMMENDED_WIDTH || video.videoHeight < MIN_RECOMMENDED_HEIGHT) {
      cameraLog.warn("resolution.low", { width: video.videoWidth, height: video.videoHeight });
      // Don't block - just log warning, AI can still try to process it
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      setError("Unable to capture photo. Please try again.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Failed to capture photo. Please try again.");
          return;
        }

        // Validate blob size
        const MAX_FILE_SIZE = 10485760; // 10MB
        if (blob.size > MAX_FILE_SIZE) {
          setError("Image is too large (max 10MB). Please try again with lower resolution.");
          return;
        }

        const file = new File([blob], `homeapp-photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
        onOpenChange(false);
      },
      "image/jpeg",
      0.92
    );
  }, [onCapture, onOpenChange]);

  const startRecording = useCallback(() => {
    if (!canRecordVideo) {
      setError("Video recording is not supported in this browser.");
      return;
    }

    const stream = mediaStreamRef.current;
    if (!stream) {
      setError("Camera is not ready yet. Please wait a moment.");
      return;
    }

    try {
      const mimeType = getSupportedMimeType();
      recordedChunksRef.current = [];
      shouldSaveRecordingRef.current = false;

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        cameraLog.error("recorder.error");
        setError("Recording encountered an issue. Please try again.");
        setIsRecording(false);
        recordedChunksRef.current = [];
        shouldSaveRecordingRef.current = false;
      };

      recorder.onstop = () => {
        const shouldSave = shouldSaveRecordingRef.current;
        const chunks = recordedChunksRef.current;
        recordedChunksRef.current = [];
        shouldSaveRecordingRef.current = false;
        mediaRecorderRef.current = null;
        setIsRecording(false);

        if (!shouldSave || chunks.length === 0) {
          return;
        }

        const blob = new Blob(chunks, { type: mimeType ?? chunks[0]?.type ?? "video/webm" });
        const effectiveType = blob.type || "video/webm";
        const extension = effectiveType.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `homeapp-video-${Date.now()}.${extension}`, {
          type: effectiveType,
        });
        onCapture(file);
        onOpenChange(false);
      };

      recorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      cameraLog.error("record.start.failed", undefined, err);
      setError("Failed to start recording. Please try again.");
    }
  }, [canRecordVideo, onCapture, onOpenChange]);

  const handleStopRecording = () => {
    stopRecording(true);
  };

  const isReadyForCapture =
    !isStreamLoading && hasCameraAccess && mediaStreamRef.current !== null;

  const handleSwitchCamera = () => {
    if (isStreamLoading || isRecording) return;

    let nextSelection: CameraSelection;

    if (videoDevices.length > 1) {
      const currentIndex = videoDevices.findIndex((device) => device.deviceId === selectedDeviceId);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % videoDevices.length : 0;
      nextSelection = {
        deviceId: videoDevices[nextIndex]?.deviceId ?? null,
        facingMode: selectedFacingMode,
      };
    } else {
      nextSelection = {
        deviceId: null,
        facingMode: selectedFacingMode === "user" ? "environment" : "user",
      };
    }

    void initStream(mode, nextSelection);
  };

  const currentCameraLabel =
    selectedDeviceId && videoDevices.length > 0
      ? getCameraLabel(
          videoDevices.find((device) => device.deviceId === selectedDeviceId) ?? videoDevices[0],
          Math.max(videoDevices.findIndex((device) => device.deviceId === selectedDeviceId), 0)
        )
      : selectedFacingMode === "user"
        ? "Front camera"
        : "Rear camera";

  const handleOpenNativeCamera = useCallback(async () => {
    const facing: CameraFacingMode = selectedFacingMode;
    const file = await pickFromNativeCamera(mode, facing);
    if (!file) return;
    onCapture(file);
    onOpenChange(false);
  }, [mode, onCapture, onOpenChange, selectedFacingMode]);

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Use your camera</DialogTitle>
          <DialogDescription>
            Capture a photo or record a short video to share in the chat.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex shrink-0 gap-1 sm:gap-2">
              <Button
                type="button"
                variant={mode === "photo" ? "secondary" : "outline"}
                size="sm"
                className="h-8 px-2.5 sm:px-3"
                onClick={() => setMode("photo")}
                disabled={isRecording}
              >
                Photo
              </Button>
              <Button
                type="button"
                variant={mode === "video" ? "secondary" : "outline"}
                size="sm"
                className="h-8 px-2.5 sm:px-3"
                onClick={() => setMode("video")}
                disabled={(!useNativeCameraFallback && !canRecordVideo) || isRecording}
              >
                Video
              </Button>
            </div>
            {!useNativeCameraFallback && (
              <div className="ml-auto flex min-w-0 shrink items-center gap-1 sm:gap-2">
                {videoDevices.length > 1 ? (
                  <Select
                    value={selectedDeviceId ?? undefined}
                    onValueChange={(deviceId) => {
                      void initStream(mode, { deviceId, facingMode: selectedFacingMode });
                    }}
                    disabled={isStreamLoading || isRecording}
                  >
                    <SelectTrigger className="hidden h-8 w-[min(100%,10rem)] text-xs sm:flex">
                      <SelectValue placeholder="Select camera" />
                    </SelectTrigger>
                    <SelectContent>
                      {videoDevices.map((device, index) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {getCameraLabel(device, index)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="hidden text-sm text-muted-foreground sm:inline">
                    {currentCameraLabel}
                  </span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 px-2 sm:px-3"
                  onClick={handleSwitchCamera}
                  disabled={isStreamLoading || isRecording}
                  aria-label="Switch camera"
                >
                  <RefreshCw className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Switch camera</span>
                </Button>
                {isRecording && (
                  <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-destructive sm:text-sm">
                    <Circle className="h-3 w-3 fill-destructive stroke-destructive" />
                    <span className="hidden sm:inline">Recording…</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
            <video
              ref={setVideoElement}
              autoPlay
              playsInline
              muted={mode === "photo"}
              className="h-full w-full object-cover"
            />

            {isStreamLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
                Initializing camera…
              </div>
            )}

            {!hasCameraAccess && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center text-sm text-white">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <p>{error ?? "Camera access was denied. Please allow access in your browser settings."}</p>
                {useNativeCameraFallback && (
                  <Button type="button" size="sm" onClick={() => void handleOpenNativeCamera()}>
                    <CameraIcon className="mr-2 h-4 w-4" />
                    Open device camera
                  </Button>
                )}
              </div>
            )}
          </div>

          {error && hasCameraAccess && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {!canRecordVideo && (
            <div className="rounded-md border border-muted-foreground/20 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Your browser does not support in-browser video recording. You can still capture photos or upload existing videos from your device.
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleDialogOpenChange(false)}
            >
              Cancel
            </Button>
            {mode === "photo" ? (
              useNativeCameraFallback ? (
                <Button type="button" onClick={() => void handleOpenNativeCamera()}>
                  <CameraIcon className="mr-2 h-4 w-4" />
                  Open device camera
                </Button>
              ) : (
              <Button
                type="button"
                onClick={handleCapturePhoto}
                disabled={!isReadyForCapture || isRecording}
              >
                <CameraIcon className="mr-2 h-4 w-4" />
                Take photo
              </Button>
              )
            ) : isRecording ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleStopRecording}
              >
                <StopCircle className="mr-2 h-4 w-4" />
                Stop recording
              </Button>
            ) : useNativeCameraFallback ? (
              <Button type="button" onClick={() => void handleOpenNativeCamera()}>
                <Video className="mr-2 h-4 w-4" />
                Record with device camera
              </Button>
            ) : (
              <Button
                type="button"
                onClick={startRecording}
                disabled={!isReadyForCapture || !canRecordVideo}
              >
                <Video className="mr-2 h-4 w-4" />
                Start recording
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

