'use client';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FileSearch, X, Calendar } from 'lucide-react';
import type { Document as DocumentType } from '@/lib/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface InspectionReportSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionReports: DocumentType[];
  selectedInspectionReports: DocumentType[];
  onToggleInspectionReport: (doc: DocumentType) => void;
}

export function InspectionReportSelector({
  open,
  onOpenChange,
  inspectionReports,
  selectedInspectionReports,
  onToggleInspectionReport,
}: InspectionReportSelectorProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Select Inspection Reports</SheetTitle>
          <SheetDescription>
            {selectedInspectionReports.length} selected for analysis
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {inspectionReports.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <FileSearch className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                No inspection reports available for this property.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload inspection reports in the Details tab. Documents classified as
                INSPECTION_REPORT will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-sm text-muted-foreground">
                  Select inspection reports to analyze via AI chat. The Inspection Report
                  Agent will extract findings, recommendations, and issue summaries from
                  your selected reports.
                </p>
              </div>
              <div className="space-y-3">
                {inspectionReports.map((doc) => {
                  const isSelected = selectedInspectionReports.some((d) => d.id === doc.id);
                  const date = doc.createdAt?.toDate
                    ? doc.createdAt.toDate()
                    : doc.createdAt instanceof Date
                      ? doc.createdAt
                      : new Date();

                  return (
                    <button
                      key={doc.id}
                      onClick={() => onToggleInspectionReport(doc)}
                      className={cn(
                        'w-full rounded-lg border p-4 text-left transition-colors',
                        isSelected
                          ? 'border-primary bg-secondary'
                          : 'border-border bg-card hover:bg-muted'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
                            isSelected ? 'bg-primary' : 'bg-secondary'
                          )}
                        >
                          <FileSearch
                            className={cn(
                              'h-5 w-5',
                              isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {doc.name || 'Untitled Report'}
                          </p>
                          <div className="mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              {format(date, 'MMM d, yyyy')}
                            </p>
                          </div>
                          {doc.summary && (
                            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                              {doc.summary}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary">
                            <X className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
