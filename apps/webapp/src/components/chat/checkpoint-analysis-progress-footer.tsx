"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { CheckpointBranchProgress } from "@/lib/checkpoint-branch-progress";

const stripTextTransition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

type Props = {
  progress: CheckpointBranchProgress;
};

export function CheckpointAnalysisProgressFooter({ progress }: Props) {
  const textKey = `${progress.header}\u0000${progress.detail ?? ""}`;

  return (
    <motion.div
      layout
      className="border-t bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <motion.div layout className="flex items-start gap-2 text-sm">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-primary" />
        <motion.div layout className="relative min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={textKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={stripTextTransition}
              className="flex min-w-0 flex-col"
            >
              <span className="font-medium text-primary">{progress.header}</span>
              {progress.detail ? (
                <span className="text-xs text-muted-foreground">{progress.detail}</span>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
