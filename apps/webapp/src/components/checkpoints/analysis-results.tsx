'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckpointAnalysis } from '@homeapp/common/types';
import { IssuesList } from './issues-list';
import { Sparkles, Package, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface AnalysisResultsProps {
  analysis: CheckpointAnalysis;
}

export function AnalysisResults({ analysis }: AnalysisResultsProps) {
  const analyzedAt = analysis.analyzedAt?.toDate
    ? analysis.analyzedAt.toDate()
    : analysis.analyzedAt instanceof Date
      ? analysis.analyzedAt
      : new Date();

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            AI Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{analysis.summary}</p>
          {analysis.aiConfidence && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" />
              <span>Confidence: {Math.round(analysis.aiConfidence * 100)}%</span>
              <span className="mx-1">•</span>
              <span>Analyzed {format(analyzedAt, 'MMM dd, yyyy · h:mm a')}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detected Items */}
      {analysis.detectedItems && analysis.detectedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              Detected Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analysis.detectedItems.map((item, idx) => (
                <Badge key={idx} variant="secondary">
                  {item}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conditions */}
      {analysis.conditions && analysis.conditions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analysis.conditions.map((condition, idx) => (
                <Badge key={idx} variant="outline">
                  {condition}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Issues */}
      {analysis.issues && <IssuesList issues={analysis.issues} />}

      {/* Issues by Severity Summary (if available) */}
      {analysis.issues_by_severity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issues Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {analysis.issues_by_severity.critical !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {analysis.issues_by_severity.critical}
                  </p>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </div>
              )}
              {analysis.issues_by_severity.major !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {analysis.issues_by_severity.major}
                  </p>
                  <p className="text-xs text-muted-foreground">Major</p>
                </div>
              )}
              {analysis.issues_by_severity.moderate !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {analysis.issues_by_severity.moderate}
                  </p>
                  <p className="text-xs text-muted-foreground">Moderate</p>
                </div>
              )}
              {analysis.issues_by_severity.minor !== undefined && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {analysis.issues_by_severity.minor}
                  </p>
                  <p className="text-xs text-muted-foreground">Minor</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

