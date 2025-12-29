'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckpointProcessingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkpointId: string;
  checkpointName: string;
  onViewCheckpoint: (checkpointId: string) => void;
}

export function CheckpointProcessingDialog({
  open,
  onOpenChange,
  checkpointId,
  checkpointName,
  onViewCheckpoint,
}: CheckpointProcessingDialogProps) {
  const [countdown, setCountdown] = useState(4);
  const [isAnimating, setIsAnimating] = useState(false);

  // Reset and start animations when dialog becomes visible
  useEffect(() => {
    if (open) {
      setCountdown(4);
      setIsAnimating(false);
      // Trigger animation after a brief delay
      const animationTimer = setTimeout(() => setIsAnimating(true), 100);
      return () => clearTimeout(animationTimer);
    }
  }, [open]);

  // Auto-dismiss countdown
  useEffect(() => {
    if (!open || countdown <= 0) return;

    const timer = setTimeout(() => {
      const newCountdown = countdown - 1;
      setCountdown(newCountdown);

      if (newCountdown === 0) {
        onOpenChange(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [open, countdown, onOpenChange]);

  const handleViewCheckpoint = () => {
    onViewCheckpoint(checkpointId);
    onOpenChange(false);
  };

  const handleContinue = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div
              className={cn(
                'h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center transition-all duration-300',
                isAnimating ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
              )}>
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">Checkpoint Created!</DialogTitle>
          <DialogDescription className="text-center font-medium pt-2">
            {checkpointName}
          </DialogDescription>
        </DialogHeader>

        {/* Processing Info */}
        <div className="rounded-lg bg-primary/5 p-4 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-sm font-semibold text-primary">AI Analysis in Progress</p>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Your checkpoint is being analyzed. This usually takes 10-30 seconds. You can view
            progress in the checkpoint details.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2 sm:gap-2">
          <Button onClick={handleViewCheckpoint} className="w-full">
            <Eye className="mr-2 h-4 w-4" />
            View Checkpoint
          </Button>
          <Button onClick={handleContinue} variant="outline" className="w-full">
            Continue {countdown > 0 && `(${countdown}s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

