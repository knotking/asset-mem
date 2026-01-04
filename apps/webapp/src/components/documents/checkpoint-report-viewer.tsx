"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import type { Document } from "@/lib/types";
import { format } from "date-fns";

interface CheckpointReportViewerProps {
  document: Document;
  onChatPress?: () => void;
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "destructive";
    case "major":
      return "orange";
    case "moderate":
      return "yellow";
    case "minor":
      return "blue";
    default:
      return "secondary";
  }
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case "critical":
      return AlertCircle;
    case "major":
    case "moderate":
      return AlertTriangle;
    case "minor":
      return Info;
    default:
      return Info;
  }
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "excellent":
    case "good":
      return "default";
    case "fair":
      return "secondary";
    case "poor":
    case "critical":
      return "destructive";
    default:
      return "outline";
  }
}

export function CheckpointReportViewer({
  document,
  onChatPress,
}: CheckpointReportViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const analysis = document.checkpointAnalysis;

  if (!analysis) {
    return null;
  }

  const createdDate =
    document.createdAt instanceof Date
      ? document.createdAt
      : document.createdAt?.toDate?.()
      ? document.createdAt.toDate()
      : new Date();

  const issuesBySeverity = {
    critical: analysis.issues?.filter((i) => i.severity === "critical").length || 0,
    major: analysis.issues?.filter((i) => i.severity === "major").length || 0,
    moderate: analysis.issues?.filter((i) => i.severity === "moderate").length || 0,
    minor: analysis.issues?.filter((i) => i.severity === "minor").length || 0,
  };

  const totalIssues = analysis.issues?.length || 0;

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{document.name || "Property Inspection Report"}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {format(createdDate, "MMM d, yyyy")}
              </p>
            </div>
          </div>
          {analysis.propertyStatus && (
            <Badge variant={getStatusVariant(analysis.propertyStatus)}>
              {analysis.propertyStatus}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Score */}
        {analysis.statusScore !== undefined && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Property Condition</span>
              <span className="text-sm font-semibold">{analysis.statusScore}/100</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${analysis.statusScore}%` }}
              />
            </div>
          </div>
        )}

        {/* Issues Summary */}
        {totalIssues > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">
              Issues Found ({totalIssues})
            </h4>
            <div className="flex flex-wrap gap-2">
              {issuesBySeverity.critical > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {issuesBySeverity.critical} Critical
                </Badge>
              )}
              {issuesBySeverity.major > 0 && (
                <Badge variant="orange" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {issuesBySeverity.major} Major
                </Badge>
              )}
              {issuesBySeverity.moderate > 0 && (
                <Badge variant="yellow" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {issuesBySeverity.moderate} Moderate
                </Badge>
              )}
              {issuesBySeverity.minor > 0 && (
                <Badge variant="blue" className="gap-1">
                  <Info className="h-3 w-3" />
                  {issuesBySeverity.minor} Minor
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Overall Assessment */}
        {analysis.overallAssessment && (
          <div>
            <p
              className={`text-sm text-muted-foreground ${
                isExpanded ? "" : "line-clamp-3"
              }`}
            >
              {analysis.overallAssessment}
            </p>
          </div>
        )}

        {/* Expand/Collapse Button */}
        {((analysis.issues && analysis.issues.length > 0) ||
          (analysis.recommendations && analysis.recommendations.length > 0) ||
          analysis.costEstimates) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full"
          >
            {isExpanded ? "Show Less" : "Show Details"}
            {isExpanded ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        )}

        {/* Expanded Details */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t">
            {/* Issues List */}
            {analysis.issues && analysis.issues.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3">Detailed Issues</h4>
                <div className="space-y-3">
                  {analysis.issues.map((issue, index) => {
                    const SeverityIcon = getSeverityIcon(issue.severity);
                    return (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <SeverityIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={getSeverityColor(issue.severity) as any}
                                  className="text-xs"
                                >
                                  {issue.severity}
                                </Badge>
                                {issue.category && (
                                  <span className="text-xs text-muted-foreground">
                                    {issue.category}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm">{issue.description}</p>
                              {issue.recommendation && (
                                <p className="text-xs text-muted-foreground">
                                  💡 {issue.recommendation}
                                </p>
                              )}
                              {issue.estimatedCost && (
                                <p className="text-xs font-medium">
                                  Est. Cost: {issue.estimatedCost}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3">Recommendations</h4>
                <div className="space-y-2">
                  {analysis.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <p className="text-sm flex-1">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cost Estimates */}
            {analysis.costEstimates && (
              <div>
                <h4 className="text-sm font-semibold mb-3">Cost Estimates</h4>
                <div className="grid gap-3">
                  {analysis.costEstimates.immediate && (
                    <Card>
                      <CardContent className="p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Immediate
                        </p>
                        <p className="text-sm">{analysis.costEstimates.immediate}</p>
                      </CardContent>
                    </Card>
                  )}
                  {analysis.costEstimates.shortTerm && (
                    <Card>
                      <CardContent className="p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Short-term (within 1 year)
                        </p>
                        <p className="text-sm">{analysis.costEstimates.shortTerm}</p>
                      </CardContent>
                    </Card>
                  )}
                  {analysis.costEstimates.longTerm && (
                    <Card>
                      <CardContent className="p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Long-term (beyond 1 year)
                        </p>
                        <p className="text-sm">{analysis.costEstimates.longTerm}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat Button */}
        {onChatPress && (
          <Button onClick={onChatPress} className="w-full" variant="outline">
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat about this report
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

