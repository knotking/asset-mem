"use client";

import { cn } from "@/lib/utils";

type DotsProps = {
  className?: string;
};

/** Pre-lifecycle and follow-up proxy: scale + opacity pulse. */
export function AssistantBounceDots({ className }: DotsProps) {
  return (
    <svg
      width="45"
      height="24"
      viewBox="0 0 45 24"
      fill="currentColor"
      className={cn("text-muted-foreground", className)}
      aria-hidden
    >
      <circle cx="6.75" cy="12" r="3.75">
        <animate
          attributeName="r"
          dur="0.8s"
          values="3.75;5.25;3.75"
          repeatCount="indefinite"
        />
        <animate
          attributeName="fill-opacity"
          dur="0.8s"
          values="1;.5;1"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="22.5" cy="12" r="3.75">
        <animate
          attributeName="r"
          dur="0.8s"
          begin="0.2s"
          values="3.75;5.25;3.75"
          repeatCount="indefinite"
        />
        <animate
          attributeName="fill-opacity"
          dur="0.8s"
          begin="0.2s"
          values="1;.5;1"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="38.25" cy="12" r="3.75">
        <animate
          attributeName="r"
          dur="0.8s"
          begin="0.4s"
          values="3.75;5.25;3.75"
          repeatCount="indefinite"
        />
        <animate
          attributeName="fill-opacity"
          dur="0.8s"
          begin="0.4s"
          values="1;.5;1"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

/** First-turn proxy lifecycle: vertical wave. */
export function AssistantWaveDots({ className }: DotsProps) {
  return (
    <svg
      width="45"
      height="24"
      viewBox="0 0 45 24"
      fill="currentColor"
      className={cn("text-muted-foreground", className)}
      aria-hidden
    >
      <circle cx="6.75" cy="12" r="3.75">
        <animate
          attributeName="cy"
          dur="0.65s"
          values="12;9;12"
          repeatCount="indefinite"
        />
        <animate
          attributeName="fill-opacity"
          dur="0.65s"
          values="1;.45;1"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="22.5" cy="12" r="3.75">
        <animate
          attributeName="cy"
          dur="0.65s"
          begin="0.12s"
          values="12;9;12"
          repeatCount="indefinite"
        />
        <animate
          attributeName="fill-opacity"
          dur="0.65s"
          begin="0.12s"
          values="1;.45;1"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="38.25" cy="12" r="3.75">
        <animate
          attributeName="cy"
          dur="0.65s"
          begin="0.24s"
          values="12;9;12"
          repeatCount="indefinite"
        />
        <animate
          attributeName="fill-opacity"
          dur="0.65s"
          begin="0.24s"
          values="1;.45;1"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}
