export type CameraFacingMode = "user" | "environment";
export type CameraCaptureMode = "photo" | "video";

export function isSecureCameraContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

/** True when getUserMedia preview/recording is expected to work (HTTPS or localhost). */
export function supportsInBrowserCamera(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean(isSecureCameraContext() && navigator.mediaDevices?.getUserMedia);
}

export function getCameraUnsupportedMessage(): string {
  if (!isSecureCameraContext()) {
    return "In-browser camera preview needs HTTPS or localhost. Open your device camera below, or use Gallery.";
  }
  return "Camera access is not supported in this browser. Open your device camera below, or use Gallery.";
}

/**
 * Opens the OS camera picker via a hidden file input.
 * Works on mobile Safari over HTTP where getUserMedia is blocked.
 */
export function pickFromNativeCamera(
  mode: CameraCaptureMode,
  facing: CameraFacingMode = "environment"
): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = mode === "video" ? "video/*" : "image/*";
    input.setAttribute("capture", facing);

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onWindowFocus);
      resolve(file);
    };

    const onWindowFocus = () => {
      window.setTimeout(() => {
        if (!input.files?.length) finish(null);
      }, 500);
    };

    input.onchange = () => {
      finish(input.files?.[0] ?? null);
    };

    window.addEventListener("focus", onWindowFocus);
    input.click();
  });
}
