
'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import type { AgentStep } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

type Props = {
  steps: AgentStep[];
};

const statusIcons: { [key in AgentStep['status']]: React.ReactNode } = {
  transferredto: <Sparkles className="h-4 w-4 animate-pulse" />,
  executing: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <AlertCircle className="h-4 w-4 text-destructive" />,
};

const statusLabels: { [key in AgentStep['status']]: string } = {
    transferredto: 'TransferredTo',
    executing: 'Executing',
    completed: 'Completed',
    failed: 'Failed',
};

export function AgentStatus({ steps }: Props) {
  if (!steps || steps.length === 0) return null;
  const transferredStep = steps.find(step => step.status === 'transferredto');
  const otherSteps = steps.filter(step => step.status !== 'transferredto');

  return (
    <Card className="w-full max-w-md bg-background/50 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 animate-pulse">
          <Sparkles className="h-4 w-4 " />
          <span className="bg-gradient-to-r from-primary via-muted-foreground to-primary bg-clip-text text-transparent animate-text-gradient">
             {'Thinking...'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 text-sm text-foreground/80">
          <AnimatePresence>
            {otherSteps.map((step, index) => (
              <motion.div
                key={step.name}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                    {statusIcons[step.status]}
                    <span>{step.name}</span>
                </div>
                {/* <span className="text-xs text-muted-foreground">{statusLabels[step.status]}</span> */}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
