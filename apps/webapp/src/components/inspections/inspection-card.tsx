'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Document } from '@/lib/types';
import { FileText, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';

interface InspectionCardProps {
  inspection: Document;
  selected?: boolean;
  onClick?: (inspection: Document) => void;
  onSelect?: (inspectionId: string, selected: boolean) => void;
  selectionMode?: boolean;
}

export function InspectionCard({
  inspection,
  selected = false,
  onClick,
  onSelect,
  selectionMode = false,
}: InspectionCardProps) {
  const createdDate = inspection.createdAt
    ? format(
        typeof inspection.createdAt === 'number'
          ? new Date(inspection.createdAt)
          : inspection.createdAt.toDate(),
        'MMM d, yyyy'
      )
    : 'Unknown date';

  const hasIssues = inspection.keyEntities?.some(
    (entity) =>
      entity.name.toLowerCase().includes('issue') ||
      entity.name.toLowerCase().includes('critical') ||
      entity.name.toLowerCase().includes('major')
  );

  const handleClick = () => {
    if (!selectionMode && onClick) {
      onClick(inspection);
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    if (onSelect) {
      onSelect(inspection.id, checked);
    }
  };

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        selected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={handleClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {selectionMode && (
              <Checkbox
                checked={selected}
                onCheckedChange={handleCheckboxChange}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
              />
            )}
            <div className="rounded-lg bg-primary/10 p-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm line-clamp-2">{inspection.name}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{createdDate}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {inspection.status === 'complete' ? (
              <Badge variant="secondary" className="text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                Analyzed
              </Badge>
            ) : inspection.status === 'analyzing' ? (
              <Badge variant="outline" className="text-xs">
                Analyzing...
              </Badge>
            ) : inspection.status === 'failed' ? (
              <Badge variant="destructive" className="text-xs">
                Failed
              </Badge>
            ) : null}
            {hasIssues && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Issues
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      {inspection.summary && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground line-clamp-2">{inspection.summary}</p>
        </CardContent>
      )}
      {inspection.keyEntities && inspection.keyEntities.length > 0 && (
        <CardContent className="pt-2 border-t">
          <div className="flex flex-wrap gap-1">
            {inspection.keyEntities.slice(0, 3).map((entity, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {entity.name}: {entity.value}
              </Badge>
            ))}
            {inspection.keyEntities.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{inspection.keyEntities.length - 3} more
              </Badge>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
