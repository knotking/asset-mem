
'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import type { AgentStep } from '@/lib/types';
import {
  getAgentStepDisplayLabel,
  isStepVisibleInStatusList,
  formatAgentStepDuration,
} from '@/lib/agent-display';
import { useDebouncedThinkingStatus } from '@/hooks/use-debounced-thinking-status';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

type Props = {
  steps: AgentStep[];
  messageContent?: string | null;
};

const statusIcons: { [key in AgentStep['status']]: React.ReactNode } = {
  transferredto: <Sparkles className="h-4 w-4 animate-pulse text-primary" />,
  executing: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <AlertCircle className="h-4 w-4 text-destructive" />,
};

/** Re-render once a second while an active step is running so durations tick. */
function useTick(active: boolean): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

export function AgentStatus({ steps, messageContent }: Props) {
  const { header: headerText, preview: headerPreview } = useDebouncedThinkingStatus(steps, {
    messageContent,
  });
  const activeStep = steps?.find(
    (s) => s.status === 'executing' || s.status === 'transferredto',
  );
  useTick(!!activeStep);

  if (!steps || steps.length === 0) return null;

  const listSteps = steps.filter(isStepVisibleInStatusList);

  return (
    <Card className="w-full max-w-md bg-background/50 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-start gap-2">
          <Sparkles className="h-4 w-4 mt-0.5 shrink-0 animate-pulse text-primary" />
          <div className="flex flex-col">
            <span className="display-title-gradient-text">
              {headerText}
            </span>
            {headerPreview && (
              <span className="text-xs text-muted-foreground font-normal">
                {headerPreview}
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 text-sm text-foreground/80">
          <AnimatePresence>
            {listSteps.map((step, index) => {
              const duration = formatAgentStepDuration(step);
              return (
                <motion.div
                  key={step.name}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="mt-0.5 shrink-0">{statusIcons[step.status]}</div>
                    <div className="min-w-0">
                      <div className="truncate text-foreground">{getAgentStepDisplayLabel(step, steps)}</div>
                      {step.preview && (
                        <div className="text-xs text-muted-foreground truncate">
                          {step.preview}
                        </div>
                      )}
                      {step.detail && !step.preview && (
                        <div className="text-xs text-muted-foreground/80 truncate">
                          {step.detail}
                        </div>
                      )}
                    </div>
                  </div>
                  {duration && (
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {duration}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
