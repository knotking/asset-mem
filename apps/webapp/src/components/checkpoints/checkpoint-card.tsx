'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, AlertCircle, CheckCircle, Clock, Camera, Video } from 'lucide-react';
import { Checkpoint } from '@/lib/types';
import { format } from 'date-fns';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface CheckpointCardProps {
  checkpoint: Checkpoint;
  selected?: boolean;
  onClick?: () => void;
  onSelect?: (selected: boolean) => void;
  selectionMode?: boolean;
}

export function CheckpointCard({
  checkpoint,
  selected = false,
  onClick,
  onSelect,
  selectionMode = false,
}: CheckpointCardProps) {
  const createdAt = checkpoint.createdAt?.toDate
    ? checkpoint.createdAt.toDate()
    : checkpoint.createdAt instanceof Date
      ? checkpoint.createdAt
      : new Date();

  const hasAnalysis = !!checkpoint.aiAnalysis;
  const isAnalyzing = checkpoint.analysisStatus === 'processing' || checkpoint.analysisStatus === 'pending';
  const analysisFailed = checkpoint.analysisStatus === 'failed';

  // Determine overall condition from analysis
  const getConditionBadge = () => {
    if (analysisFailed) {
      return <Badge variant="destructive">Analysis Failed</Badge>;
    }
    if (isAnalyzing) {
      return <Badge variant="outline" className="border-blue-300 text-blue-700"><Clock className="h-3 w-3 mr-1 animate-spin" />Analyzing</Badge>;
    }
    if (!hasAnalysis) {
      return <Badge variant="outline">No Analysis</Badge>;
    }

    // Check for issues
    const issues = checkpoint.aiAnalysis?.issues || [];
    const hasCritical = issues.some((i: any) => typeof i === 'object' && i.severity === 'critical');
    const hasMajor = issues.some((i: any) => typeof i === 'object' && i.severity === 'major');

    if (hasCritical) {
      return <Badge variant="destructive">Critical Issues</Badge>;
    }
    if (hasMajor) {
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Major Issues</Badge>;
    }
    if (issues.length > 0) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Needs Attention</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800 border-green-200">Good Condition</Badge>;
  };

  const handleClick = () => {
    if (selectionMode && onSelect) {
      onSelect(!selected);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        selected && 'ring-2 ring-primary',
        selectionMode && 'hover:ring-2 hover:ring-muted-foreground'
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
            {checkpoint.media && checkpoint.media.length > 0 ? (
              <>
                <Image
                  src={checkpoint.media[0].thumbnailUrl || checkpoint.media[0].url}
                  alt={checkpoint.name}
                  fill
                  className="object-cover"
                />
                {checkpoint.media[0].contentType?.startsWith('video/') && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Video className="h-6 w-6 text-white" />
                  </div>
                )}
                {checkpoint.media.length > 1 && (
                  <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                    <Camera className="inline h-3 w-3 mr-0.5" />
                    {checkpoint.media.length}
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <Camera className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            {selectionMode && (
              <div className="absolute top-1 left-1">
                {selected ? (
                  <CheckCircle className="h-5 w-5 text-primary fill-primary" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-white bg-black/20" />
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-foreground line-clamp-1">
                  {checkpoint.name || (isAnalyzing ? 'Analyzing...' : 'Untitled Checkpoint')}
                </h3>
                {getConditionBadge()}
              </div>
              {checkpoint.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{checkpoint.description}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{format(createdAt, 'MMM dd, yyyy')}</span>
                </div>
                {checkpoint.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{checkpoint.location}</span>
                  </div>
                )}
              </div>

              {checkpoint.visualDiff && (
                <Badge variant="outline" className="text-xs">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Comparison Available
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

