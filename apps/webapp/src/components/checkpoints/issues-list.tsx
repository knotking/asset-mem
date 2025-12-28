'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Issue {
  description?: string;
  severity?: 'minor' | 'moderate' | 'major' | 'critical';
  confidence?: number;
  category?: string;
}

interface IssuesListProps {
  issues: (string | Issue)[];
}

export function IssuesList({ issues }: IssuesListProps) {
  if (!issues || issues.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-sm text-muted-foreground">
            No issues detected in this checkpoint
          </p>
        </CardContent>
      </Card>
    );
  }

  const normalizedIssues: Issue[] = issues.map((issue) =>
    typeof issue === 'string'
      ? { description: issue, severity: 'minor' }
      : issue
  );

  // Group by severity
  const critical = normalizedIssues.filter((i) => i.severity === 'critical');
  const major = normalizedIssues.filter((i) => i.severity === 'major');
  const moderate = normalizedIssues.filter((i) => i.severity === 'moderate');
  const minor = normalizedIssues.filter((i) => i.severity === 'minor' || !i.severity);

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4" />;
      case 'major':
        return <AlertTriangle className="h-4 w-4" />;
      case 'moderate':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'major':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'moderate':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const renderIssueGroup = (groupIssues: Issue[], title: string, severity: string) => {
    if (groupIssues.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {getSeverityIcon(severity)}
          <h4 className="font-semibold text-sm">
            {title} <Badge variant="secondary" className="ml-2">{groupIssues.length}</Badge>
          </h4>
        </div>
        <div className="space-y-2 pl-6">
          {groupIssues.map((issue, idx) => (
            <div
              key={idx}
              className={cn(
                'rounded-md border p-3',
                getSeverityColor(issue.severity)
              )}
            >
              <p className="text-sm">{issue.description}</p>
              <div className="mt-2 flex items-center gap-3 text-xs">
                {issue.category && (
                  <Badge variant="outline" className="text-xs">
                    {issue.category}
                  </Badge>
                )}
                {issue.confidence && (
                  <span className="text-muted-foreground">
                    Confidence: {Math.round(issue.confidence * 100)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Detected Issues</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderIssueGroup(critical, 'Critical Issues', 'critical')}
        {renderIssueGroup(major, 'Major Issues', 'major')}
        {renderIssueGroup(moderate, 'Moderate Issues', 'moderate')}
        {renderIssueGroup(minor, 'Minor Issues', 'minor')}
      </CardContent>
    </Card>
  );
}

