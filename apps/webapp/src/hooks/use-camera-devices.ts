"use client";

import { useCallback, useEffect, useState } from "react";

export function useCameraDevices(enabled: boolean) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const refreshDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setDevices([]);
      return;
    }

    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((device) => device.kind === "videoinput"));
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setDevices([]);
      return;
    }

    void refreshDevices();

    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return;

    mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => {
      mediaDevices.removeEventListener("devicechange", refreshDevices);
    };
  }, [enabled, refreshDevices]);

  return { devices, refreshDevices };
}

export function getCameraLabel(device: MediaDeviceInfo, index: number): string {
  const label = device.label?.trim();
  if (label) return label;
  return `Camera ${index + 1}`;
}
