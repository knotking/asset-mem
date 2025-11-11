"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Camera as CameraIcon, Circle, RefreshCw, StopCircle, Video } from "lucide-react";

type CameraMode = "photo" | "video";

type CameraCaptureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  initialMode?: CameraMode;
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

export function CameraCaptureDialog({ open, onOpenChange, onCapture, initialMode = "photo" }: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const shouldSaveRecordingRef = useRef(false);

  const [mode, setMode] = useState<CameraMode>(initialMode);
  const [selectedFacingMode, setSelectedFacingMode] = useState<"user" | "environment">("environment");
  const [isRecording, setIsRecording] = useState(false);
  const [isStreamLoading, setIsStreamLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCameraAccess, setHasCameraAccess] = useState(true);

  const canRecordVideo =
    typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";

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

  const initStream = useCallback(
    async (captureMode: "photo" | "video") => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setHasCameraAccess(false);
        setError("Camera access is not supported in this browser.");
        return;
      }

      stopStream();
      setIsStreamLoading(true);
      setError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: selectedFacingMode } },
          audio: captureMode === "video" && canRecordVideo,
        });

        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {
            // Some browsers require explicit user interaction; ignore play errors.
          }
        }

        setHasCameraAccess(true);
      } catch (err) {
        console.error("Camera access error:", err);
        setHasCameraAccess(false);
        setError("Unable to access camera. Please check your browser permissions.");
      } finally {
        setIsStreamLoading(false);
      }
    },
    [canRecordVideo, selectedFacingMode, stopStream]
  );

  useEffect(() => {
    if (!open) {
      stopStream();
      setError(null);
      setIsStreamLoading(false);
      setHasCameraAccess(true);
      setSelectedFacingMode("environment");
      setMode(initialMode);
      return;
    }

    const nextMode: CameraMode = initialMode;
    setMode(nextMode);
    initStream(nextMode);

    return () => {
      stopStream();
    };
  }, [open, initialMode, initStream, stopStream]);

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
        console.error("MediaRecorder error:", event);
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
      console.error("Failed to start recording:", err);
      setError("Failed to start recording. Please try again.");
    }
  }, [canRecordVideo, onCapture, onOpenChange]);

  const handleStopRecording = () => {
    stopRecording(true);
  };

  const isReadyForCapture =
    !isStreamLoading && hasCameraAccess && mediaStreamRef.current !== null;

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "photo" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setMode("photo")}
                disabled={isRecording}
              >
                Photo
              </Button>
              <Button
                type="button"
                variant={mode === "video" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setMode("video")}
                disabled={!canRecordVideo || isRecording}
              >
                Video
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedFacingMode === "user" ? "Front camera" : "Rear camera"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelectedFacingMode((prev) => (prev === "user" ? "environment" : "user"))
                }
                disabled={isStreamLoading || isRecording}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Switch camera
              </Button>
              {isRecording && (
                <div className="flex items-center gap-1 text-sm font-medium text-destructive">
                  <Circle className="h-3 w-3 fill-destructive stroke-destructive" />
                  Recording…
                </div>
              )}
            </div>
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
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
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 px-6 text-center text-sm text-white">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <p>{error ?? "Camera access was denied. Please allow access in your browser settings."}</p>
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
              <Button
                type="button"
                onClick={handleCapturePhoto}
                disabled={!isReadyForCapture || isRecording}
              >
                <CameraIcon className="mr-2 h-4 w-4" />
                Take photo
              </Button>
            ) : isRecording ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleStopRecording}
              >
                <StopCircle className="mr-2 h-4 w-4" />
                Stop recording
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

