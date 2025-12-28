
'use client';

import { Button } from '@/components/ui/button';
import { X, FileText, Camera } from 'lucide-react';
import type { Document as DocumentType, Checkpoint } from '@/lib/types';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '../ui/badge';

type Props = {
  documents: DocumentType[];
  checkpoints?: Checkpoint[];
  onClear: () => void;
  onRemove: (doc: DocumentType) => void;
  onCheckpointRemove?: (checkpoint: Checkpoint) => void;
  onClearCheckpoints?: () => void;
};

export function ChatContextHeader({ 
  documents, 
  checkpoints = [],
  onClear, 
  onRemove,
  onCheckpointRemove,
  onClearCheckpoints,
}: Props) {
  const hasDocuments = documents.length > 0;
  const hasCheckpoints = checkpoints.length > 0;
  const hasAnyContext = hasDocuments || hasCheckpoints;

  return (
    <AnimatePresence>
      {hasAnyContext && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="p-3 border-t bg-card space-y-3">
            {hasDocuments && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center flex-wrap gap-2 min-w-0">
                  <span className="text-sm font-medium text-muted-foreground mr-2 shrink-0">Documents:</span>
                  {documents.map(doc => (
                    <Badge key={doc.id} variant="outline" className="flex items-center gap-1.5 pr-1.5">
                      <FileText className="h-3 w-3" />
                      <span className="font-normal">{doc.name}</span>
                      <button onClick={() => onRemove(doc)} className="rounded-full hover:bg-muted p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={onClear} className="h-7 shrink-0 text-xs">
                  Clear all
                </Button>
              </div>
            )}

            {hasCheckpoints && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center flex-wrap gap-2 min-w-0">
                  <span className="text-sm font-medium text-muted-foreground mr-2 shrink-0">Checkpoints:</span>
                  {checkpoints.map(checkpoint => (
                    <Badge key={checkpoint.id} variant="outline" className="flex items-center gap-1.5 pr-1.5">
                      <Camera className="h-3 w-3" />
                      <span className="font-normal">{checkpoint.name || 'Untitled'}</span>
                      {onCheckpointRemove && (
                        <button onClick={() => onCheckpointRemove(checkpoint)} className="rounded-full hover:bg-muted p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
                {onClearCheckpoints && (
                  <Button variant="ghost" size="sm" onClick={onClearCheckpoints} className="h-7 shrink-0 text-xs">
                    Clear all
                  </Button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
