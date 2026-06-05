"use client";

import { useState } from "react";
import { Paperclip, Clock, FileText } from "lucide-react";
import type { MessageContextRefs } from "@/lib/types";
import { listMessageContextRefItems } from "@/lib/chat-message-context-refs";

type Props = {
  refs: MessageContextRefs;
  hideRepeated?: boolean;
};

export function MessageContextRefsDisplay({ refs, hideRepeated = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (hideRepeated) return null;

  const items = listMessageContextRefItems(refs);
  if (items.length === 0) return null;

  const toggleExpanded = () => setExpanded((value) => !value);
  const moreCount = items.length - 1;
  const shellClass =
    "inline-flex max-w-full items-center gap-1 rounded-lg border border-border/60 bg-background/80 px-2 py-1 text-xs text-muted-foreground";

  return (
    <div className="flex w-full justify-end">
      <button type="button" onClick={toggleExpanded} className={shellClass}>
        <Paperclip className="h-3 w-3 shrink-0" />
        {!expanded ? (
          <>
            <span className="max-w-32 truncate">{items[0].name}</span>
            {moreCount > 0 ? (
              <span className="shrink-0">+{moreCount} more</span>
            ) : null}
          </>
        ) : (
          <span className="flex max-w-[min(100vw-8rem,18rem)] items-center gap-1.5 overflow-x-auto">
            {items.map((item) => (
              <span
                key={`${item.kind}-${item.id}`}
                className="inline-flex shrink-0 items-center gap-1"
              >
                {item.kind === "checkpoint" ? (
                  <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
                <span className="max-w-28 truncate">{item.name}</span>
              </span>
            ))}
          </span>
        )}
      </button>
    </div>
  );
}
