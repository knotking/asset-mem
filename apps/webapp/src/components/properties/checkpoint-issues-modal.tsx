'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Checkpoint } from '@/lib/types';
import { format } from 'date-fns';

type IssueSeverity = 'critical' | 'major' | 'moderate' | 'minor';

interface IssueRow {
  severity: IssueSeverity;
  description: string;
  checkpointId: string;
  checkpointName: string;
  createdAt: Date;
}

interface CheckpointIssuesModalProps {
  checkpoints: Checkpoint[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function normalizeIssuesFromCheckpoints(
  checkpoints: Checkpoint[],
  maxCheckpoints: number
): IssueRow[] {
  const rows: IssueRow[] = [];
  const slice = checkpoints.slice(0, maxCheckpoints);
  
  for (const cp of slice) {
    const issues = cp.aiAnalysis?.issues as any[] | undefined;
    if (!issues || issues.length === 0) continue;
    
    const createdAt = cp.createdAt?.toDate ? cp.createdAt.toDate() : new Date();
    
    for (const issue of issues) {
      if (typeof issue === 'string') {
        rows.push({
          severity: 'minor',
          description: issue,
          checkpointId: cp.id,
          checkpointName: cp.name || 'Untitled Checkpoint',
          createdAt,
        });
      } else if (issue && typeof issue === 'object') {
        const sev: IssueSeverity =
          issue.severity === 'critical' ||
          issue.severity === 'major' ||
          issue.severity === 'moderate'
            ? issue.severity
            : 'minor';
        const desc = String(issue.description || issue.text || issue.title || 'Issue detected');
        rows.push({
          severity: sev,
          description: desc,
          checkpointId: cp.id,
          checkpointName: cp.name || 'Untitled Checkpoint',
          createdAt,
        });
      }
    }
  }
  
  // Newest first
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return rows;
}

function severityLabel(sev: IssueSeverity) {
  return sev === 'critical'
    ? 'Critical'
    : sev === 'major'
      ? 'Major'
      : sev === 'moderate'
        ? 'Moderate'
        : 'Minor';
}

const severityColors = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  major: 'bg-orange-100 text-orange-800 border-orange-200',
  moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  minor: 'bg-blue-100 text-blue-800 border-blue-200',
};

export function CheckpointIssuesModal({ checkpoints, open, onOpenChange }: CheckpointIssuesModalProps) {
  const [filter, setFilter] = useState<IssueSeverity | 'all'>('all');

  const rows = normalizeIssuesFromCheckpoints(checkpoints, 12);
  const filtered = filter === 'all' ? rows : rows.filter((r) => r.severity === filter);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issues Breakdown</DialogTitle>
          <DialogDescription>
            All detected issues from recent checkpoints
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Filter chips */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'critical', 'major', 'moderate', 'minor'] as const).map((sev) => (
              <Badge
                key={sev}
                variant={filter === sev ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setFilter(sev)}
              >
                {sev === 'all' ? 'All' : severityLabel(sev)}
              </Badge>
            ))}
          </div>

          {/* Issues list */}
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No issues found in the recent checkpoints.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.slice(0, 50).map((r, idx) => (
                <Card key={`${r.checkpointId}-${idx}`}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className={severityColors[r.severity]}>
                        {severityLabel(r.severity)}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {format(r.createdAt, 'MMM d, yyyy')}
                      </p>
                    </div>
                    <p className="text-sm font-medium mb-1">{r.description}</p>
                    <p className="text-xs text-muted-foreground">
                      From: {r.checkpointName}
                    </p>
                  </CardContent>
                </Card>
              ))}
              {filtered.length > 50 && (
                <p className="text-xs text-center text-muted-foreground">
                  Showing the first 50 issues.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

