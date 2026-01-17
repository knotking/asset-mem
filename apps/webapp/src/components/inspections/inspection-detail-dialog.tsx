'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInspection } from '@/contexts/inspection-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Calendar, FileText, ExternalLink, AlertTriangle, CheckCircle, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

export function InspectionDetailDialog() {
  const { selectedInspection, setSelectedInspection } = useInspection();

  if (!selectedInspection) {
    return null;
  }

  const createdDate = selectedInspection.createdAt
    ? format(
        typeof selectedInspection.createdAt === 'number'
          ? new Date(selectedInspection.createdAt)
          : selectedInspection.createdAt.toDate(),
        'MMMM d, yyyy h:mm a'
      )
    : 'Unknown date';

  const handleDownload = () => {
    if (selectedInspection.url) {
      window.open(selectedInspection.url, '_blank');
    }
  };

  const hasIssues = selectedInspection.keyEntities?.some(
    (entity) =>
      entity.name.toLowerCase().includes('issue') ||
      entity.name.toLowerCase().includes('critical') ||
      entity.name.toLowerCase().includes('major')
  );

  return (
    <Dialog open={!!selectedInspection} onOpenChange={() => setSelectedInspection(null)}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl">{selectedInspection.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{createdDate}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {selectedInspection.status === 'complete' ? (
                <Badge variant="secondary">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Analyzed
                </Badge>
              ) : selectedInspection.status === 'analyzing' ? (
                <Badge variant="outline">Analyzing...</Badge>
              ) : selectedInspection.status === 'failed' ? (
                <Badge variant="destructive">Failed</Badge>
              ) : null}
              {hasIssues && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Issues Found
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Summary Section */}
            {selectedInspection.summary && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Summary</h3>
                <p className="text-sm text-muted-foreground">{selectedInspection.summary}</p>
              </div>
            )}

            <Separator />

            {/* Key Entities/Metadata */}
            {selectedInspection.keyEntities && selectedInspection.keyEntities.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-3">Key Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedInspection.keyEntities.map((entity, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50 border"
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        {entity.name}
                      </span>
                      <span className="text-sm">{entity.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Document Details */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Document Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Content Type:</span>
                  <span>{selectedInspection.contentType || 'application/pdf'}</span>
                </div>
                {selectedInspection.propertyAddress && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Property:</span>
                    <span>{selectedInspection.propertyAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
          {selectedInspection.url && (
            <Button variant="outline" size="sm" asChild>
              <a href={selectedInspection.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Document
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
