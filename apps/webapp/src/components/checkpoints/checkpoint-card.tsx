'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import type { Checkpoint } from '@homeapp/common/types';
import { Checkbox } from '@/components/ui/checkbox';

interface CheckpointCardProps {
  checkpoint: Checkpoint;
  onClick?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
}

export function CheckpointCard({
  checkpoint,
  onClick,
  selectionMode = false,
  isSelected = false,
  onSelectionChange,
}: CheckpointCardProps) {
  const createdDate = checkpoint.createdAt?.toDate
    ? checkpoint.createdAt.toDate()
    : checkpoint.createdAt instanceof Date
      ? checkpoint.createdAt
      : new Date();

  // Get condition badge styling based on AI analysis
  const getConditionInfo = () => {
    if (!checkpoint.aiAnalysis) {
      return {
        label: 'Pending Analysis',
        variant: 'bg-gray-100 text-gray-800 border-gray-200' as const,
        icon: AlertCircle,
      };
    }

    const issues = checkpoint.aiAnalysis.issues || [];
    const hasStructuredIssues = issues.length > 0 && typeof issues[0] === 'object';
    
    if (hasStructuredIssues) {
      const structuredIssues = issues as Array<{ severity?: string }>;
      const hasCritical = structuredIssues.some(i => i.severity === 'critical');
      const hasMajor = structuredIssues.some(i => i.severity === 'major');
      
      if (hasCritical) {
        return {
          label: 'Critical Issues',
          variant: 'bg-red-100 text-red-800 border-red-200' as const,
          icon: AlertTriangle,
        };
      }
      if (hasMajor) {
        return {
          label: 'Needs Attention',
          variant: 'bg-orange-100 text-orange-800 border-orange-200' as const,
          icon: AlertCircle,
        };
      }
    }

    return {
      label: 'Good Condition',
      variant: 'bg-green-100 text-green-800 border-green-200' as const,
      icon: CheckCircle2,
    };
  };

  const conditionInfo = getConditionInfo();
  const ConditionIcon = conditionInfo.icon;

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && onSelectionChange) {
      e.preventDefault();
      onSelectionChange(!isSelected);
    } else if (onClick) {
      onClick();
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={handleCardClick}
    >
      <CardContent className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-4 flex-1">
            {selectionMode && (
              <div onClick={handleCheckboxClick}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectionChange?.(!!checked)}
                />
              </div>
            )}
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                conditionInfo.variant.split(' ')[0]
              }`}
            >
              <ConditionIcon
                className={`h-5 w-5 ${conditionInfo.variant.split(' ')[1].replace('text-', '')}`}
              />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{checkpoint.name}</h3>
              {checkpoint.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {checkpoint.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  <span>{format(createdDate, 'MMM dd, yyyy, hh:mm a')}</span>
                </div>
                {checkpoint.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" />
                    <span>{checkpoint.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Badge variant="outline" className={conditionInfo.variant}>
              {conditionInfo.label}
            </Badge>
            {checkpoint.analysisStatus === 'processing' && (
              <Badge variant="outline">Analyzing...</Badge>
            )}
          </div>
        </div>

        {checkpoint.media.length > 0 && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">
              {checkpoint.media.length} {checkpoint.media.length === 1 ? 'image' : 'images'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {checkpoint.media.slice(0, 4).map((mediaItem, index) => (
                <div
                  key={mediaItem.id}
                  className="relative aspect-square overflow-hidden rounded-lg bg-muted"
                >
                  <Image
                    src={mediaItem.thumbnailUrl || mediaItem.url}
                    alt={`Checkpoint ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  {index === 3 && checkpoint.media.length > 4 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white font-semibold">
                        +{checkpoint.media.length - 4}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {checkpoint.aiAnalysis && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {checkpoint.aiAnalysis.summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

