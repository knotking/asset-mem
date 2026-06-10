"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Extract YouTube video ID from URL
const getYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === "youtu.be") {
      return urlObj.pathname.slice(1).split("?")[0];
    }
    if (urlObj.hostname === "www.youtube.com" || urlObj.hostname === "youtube.com") {
      if (urlObj.pathname === "/watch") {
        return urlObj.searchParams.get("v");
      }
      if (urlObj.pathname.startsWith("/embed/")) {
        return urlObj.pathname.split("/")[2].split("?")[0];
      }
      if (urlObj.pathname.startsWith("/shorts/")) {
        return urlObj.pathname.split("/shorts/")[1].split("?")[0];
      }
    }
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return match[2];
    }
    return null;
  } catch (e) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return match[2];
    }
    return null;
  }
};

interface YouTubeModalProps {
  url: string;
  trigger: React.ReactNode;
  className?: string;
}

export function YouTubeModal({ url, trigger, className }: YouTubeModalProps) {
  const [open, setOpen] = useState(false);
  const videoId = getYouTubeVideoId(url);

  if (!videoId) {
    // Fallback to regular link if video ID can't be extracted
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {trigger}
      </a>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className={className}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[1680px] p-0 bg-transparent border-none shadow-none [&>button]:absolute [&>button]:right-2 [&>button]:top-2 [&>button]:z-50 [&>button]:bg-white/90 [&>button]:hover:bg-white [&>button]:text-black [&>button]:rounded-full [&>button]:p-2 [&>button]:shadow-lg">
        <DialogTitle className="sr-only">Watch Demo Video</DialogTitle>
        <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ paddingBottom: "56.25%" }}>
          {open ? (
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube video player"
              className="absolute top-0 left-0 w-full h-full"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
