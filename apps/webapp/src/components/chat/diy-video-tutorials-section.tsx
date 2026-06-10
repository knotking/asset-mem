"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronRight, Play, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type DiyVideoTutorial = {
  title?: string;
  url: string;
  description?: string;
};

function getYouTubeVideoId(url: string): string | null {
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
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return match[2];
    }
    return null;
  } catch {
    return null;
  }
}

function getYouTubeThumbnailUrl(videoId: string): string {
  // mqdefault is 16:9 — hqdefault is 4:3 with letterboxing in a wide preview row.
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

function getSheetVideoOrder(videos: DiyVideoTutorial[], focusIndex: number): DiyVideoTutorial[] {
  if (focusIndex <= 0 || focusIndex >= videos.length) {
    return videos;
  }

  const focused = videos[focusIndex];
  return [focused, ...videos.filter((_, index) => index !== focusIndex)];
}

type Props = {
  videos: DiyVideoTutorial[];
};

type VideoPreviewRowProps = {
  video: DiyVideoTutorial;
  index: number;
  onPress: (index: number) => void;
};

function VideoPreviewRow({ video, index, onPress }: VideoPreviewRowProps) {
  const title = video.title?.trim() || "Video tutorial";
  const videoId = getYouTubeVideoId(video.url);

  return (
    <button
      type="button"
      onClick={() => onPress(index)}
      aria-label={`Play video tutorial: ${title}`}
      className="flex w-full items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-left transition-opacity hover:bg-muted/50 active:opacity-80"
    >
      {videoId ? (
        <div
          className="relative shrink-0 overflow-hidden rounded-md bg-muted bg-cover bg-center"
          style={{
            width: 96,
            height: 54,
            backgroundImage: `url(${getYouTubeThumbnailUrl(videoId)})`,
          }}
          aria-hidden
        >
          <div className="flex size-full items-center justify-center bg-black/35">
            <Play className="h-5 w-5 fill-white text-white" />
          </div>
        </div>
      ) : (
        <div
          className="flex shrink-0 items-center justify-center rounded-md bg-muted"
          style={{ width: 96, height: 54 }}
        >
          <Youtube className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-foreground">{title}</p>
        {video.description?.trim() ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{video.description.trim()}</p>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function DiyVideoTutorialsSection({ videos }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const count = videos.length;

  const sheetVideos = useMemo(
    () => (sheetOpen ? getSheetVideoOrder(videos, focusedIndex) : []),
    [sheetOpen, videos, focusedIndex]
  );

  const openSheet = useCallback((index: number) => {
    setFocusedIndex(index);
    setSheetOpen(true);
  }, []);

  const handleOpenAll = useCallback(() => {
    openSheet(0);
  }, [openSheet]);

  if (count === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-400">
          <Youtube className="h-4 w-4" /> Video Tutorials
        </h4>
        <div className="space-y-2">
          {videos.map((video, index) => (
            <VideoPreviewRow key={`${video.url}-${index}`} video={video} index={index} onPress={openSheet} />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center gap-2"
          aria-label={`View all ${count} video tutorials`}
          onClick={handleOpenAll}
        >
          <Youtube className="h-4 w-4" />
          View all video tutorials ({count})
        </Button>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-2xl lg:max-w-3xl"
        >
          <SheetHeader className="shrink-0 border-b px-4 py-3 pr-12 text-left">
            <SheetTitle className="text-base font-semibold sm:text-lg">
              Video tutorials ({count})
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
            {sheetVideos.map((video, index) => {
              const id = getYouTubeVideoId(video.url);
              const embedSrc = id
                ? `https://www.youtube.com/embed/${id}${index === 0 ? "?autoplay=1" : ""}`
                : null;

              return (
                <div key={video.url} className="space-y-2 border-b pb-6 last:border-b-0 last:pb-0">
                  {embedSrc ? (
                    <iframe
                      src={embedSrc}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={video.title || `YouTube video ${index + 1}`}
                      className="aspect-video w-full max-w-full rounded-md border"
                    />
                  ) : (
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-words text-sm text-blue-600 underline dark:text-blue-400"
                    >
                      {video.title?.trim() || video.url}
                    </a>
                  )}
                  <p className="text-sm font-medium text-foreground">
                    {video.title?.trim() || "Video tutorial"}
                  </p>
                  {video.description?.trim() ? (
                    <p className="text-xs text-muted-foreground">{video.description.trim()}</p>
                  ) : null}
                  <Button asChild variant="outline" className="w-full">
                    <a href={video.url} target="_blank" rel="noopener noreferrer">
                      Watch on YouTube
                    </a>
                  </Button>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
