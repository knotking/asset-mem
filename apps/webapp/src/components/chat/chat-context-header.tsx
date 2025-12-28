
'use client';

import { Button } from '@/components/ui/button';
import { X, FileText } from 'lucide-react';
import type { Document as DocumentType } from '@/lib/types';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '../ui/badge';

type Props = {
  documents: DocumentType[];
  onClear: () => void;
  onRemove: (doc: DocumentType) => void;
};

export function ChatContextHeader({ documents, onClear, onRemove }: Props) {
  const hasDocuments = documents.length > 0;
  return (
    <AnimatePresence>
      {hasDocuments && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="p-3 border-t bg-card">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center flex-wrap gap-2 min-w-0">
                <span className="text-sm font-medium text-muted-foreground mr-2 shrink-0">Resources:</span>
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

    