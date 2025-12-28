"use client";

import { Camera, X, MapPin, Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Checkpoint } from "@/lib/types";
import { format } from "date-fns";
import Image from "next/image";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface CheckpointSelectorProps {
  checkpoints: Checkpoint[];
  selectedCheckpoints: Checkpoint[];
  onToggle: (checkpoint: Checkpoint) => void;
  onClose?: () => void;
}

export function CheckpointSelector({
  checkpoints,
  selectedCheckpoints,
  onToggle,
  onClose,
}: CheckpointSelectorProps) {
  const isSelected = (checkpoint: Checkpoint) =>
    selectedCheckpoints.some((cp) => cp.id === checkpoint.id);

  if (checkpoints.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <SheetHeader className="border-b bg-background px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <SheetTitle className="text-sm font-semibold">Select Checkpoints</SheetTitle>
              <p className="text-xs text-muted-foreground">
                No checkpoints available
              </p>
            </div>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SheetHeader>
        <div className="p-4">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No checkpoints available for this property.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Create checkpoints to track property condition over time.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SheetHeader className="border-b bg-background px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <SheetTitle className="text-sm font-semibold">Select Checkpoints</SheetTitle>
            <p className="text-xs text-muted-foreground">
              {selectedCheckpoints.length} selected for chat context
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SheetHeader>

      <div className="rounded-lg bg-secondary/50 p-3 mx-4 mt-4">
        <p className="text-xs text-muted-foreground">
          Select checkpoints to provide context for your chat conversation. The
          AI will use these checkpoints to answer questions about property
          condition, changes, and history.
        </p>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-3">
          {checkpoints.map((checkpoint) => {
            const selected = isSelected(checkpoint);
            const date = checkpoint.createdAt?.toDate
              ? checkpoint.createdAt.toDate()
              : new Date();
            const thumbnailUrl =
              checkpoint.media?.[0]?.thumbnailUrl ||
              checkpoint.media?.[0]?.url;

            return (
              <button
                key={checkpoint.id}
                onClick={() => onToggle(checkpoint)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-start gap-3">
                  {thumbnailUrl ? (
                    <div className="relative h-12 w-12 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                      <Image
                        src={thumbnailUrl}
                        alt={checkpoint.name || "Checkpoint"}
                        fill
                        className="object-cover"
                      />
                      {selected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="rounded-full bg-primary p-1">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "h-12 w-12 flex-shrink-0 rounded-md flex items-center justify-center",
                        selected ? "bg-primary" : "bg-secondary"
                      )}
                    >
                      <Camera
                        className={cn(
                          "h-5 w-5",
                          selected
                            ? "text-primary-foreground"
                            : "text-muted-foreground"
                        )}
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm text-foreground truncate">
                        {checkpoint.name || "Untitled Checkpoint"}
                      </p>
                      {selected && (
                        <Badge
                          variant="default"
                          className="flex-shrink-0 h-5 px-1.5"
                        >
                          <Check className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>

                    {checkpoint.location && (
                      <div className="mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground truncate">
                          {checkpoint.location}
                        </p>
                      </div>
                    )}

                    <div className="mt-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {format(date, "MMM d, yyyy")}
                      </p>
                    </div>

                    {checkpoint.aiAnalysis?.summary && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {checkpoint.aiAnalysis.summary}
                      </p>
                    )}

                    {checkpoint.aiAnalysis?.issues &&
                      checkpoint.aiAnalysis.issues.length > 0 && (
                        <div className="mt-2 flex items-center gap-1">
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-5 px-1.5"
                          >
                            {checkpoint.aiAnalysis.issues.length} issue
                            {checkpoint.aiAnalysis.issues.length !== 1
                              ? "s"
                              : ""}
                          </Badge>
                        </div>
                      )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

