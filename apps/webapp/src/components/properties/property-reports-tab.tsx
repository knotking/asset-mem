"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
} from "lucide-react";
import { useReports } from "@/contexts/reports-context";
import { UploadReportsDialog } from "./upload-reports-dialog";
import { ReportDetailView } from "../reports/report-detail-view";
import type { InspectionReport } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

const getStatusColor = (status: InspectionReport["status"]) => {
  switch (status) {
    case "complete":
      return "bg-green-100 text-green-800";
    case "analyzing":
      return "bg-blue-100 text-blue-800";
    case "failed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getConditionColor = (condition: string) => {
  switch (condition) {
    case "excellent":
      return "text-green-600";
    case "good":
      return "text-blue-600";
    case "fair":
      return "text-yellow-600";
    case "poor":
      return "text-orange-600";
    case "critical":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
};

const ReportCard = ({
  report,
  onClick,
}: {
  report: InspectionReport;
  onClick: () => void;
}) => {
  const aiAnalysis = report.aiAnalysis;
  const criticalIssues =
    aiAnalysis?.issues?.filter((issue) =>
      typeof issue === "object" ? issue.severity === "critical" : false
    ).length || 0;
  const totalIssues = aiAnalysis?.issues?.length || 0;

  const createdDate = report.createdAt
    ? formatDistanceToNow(report.createdAt.toDate(), { addSuffix: true })
    : "Unknown";

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-500" />
            <CardTitle className="text-base">{report.name}</CardTitle>
          </div>
          <Badge className={getStatusColor(report.status)}>{report.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-gray-500">Type</p>
            <p className="font-medium">
              {report.reportType?.replace(/_/g, " ") || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Uploaded</p>
            <p className="font-medium">{createdDate}</p>
          </div>
        </div>

        {report.status === "complete" && aiAnalysis && (
          <>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Condition</span>
                <span
                  className={`text-sm font-semibold capitalize ${getConditionColor(
                    aiAnalysis.overallCondition
                  )}`}
                >
                  {aiAnalysis.overallCondition}
                </span>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">
                {aiAnalysis.summary}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="font-medium">{criticalIssues}</span>
                <span className="text-gray-500 text-xs">Critical</span>
              </div>
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{totalIssues}</span>
                <span className="text-gray-500 text-xs">Issues</span>
              </div>
              {aiAnalysis.costEstimates && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-xs">
                    $
                    {(
                      (aiAnalysis.costEstimates.immediate || 0) +
                      (aiAnalysis.costEstimates.shortTerm || 0) +
                      (aiAnalysis.costEstimates.longTerm || 0)
                    ).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {report.status === "analyzing" && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <Clock className="h-4 w-4 animate-spin" />
            <span>Analyzing report...</span>
          </div>
        )}

        {report.status === "failed" && (
          <div className="text-sm text-red-600">
            Analysis failed. Please try uploading again.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export function PropertyReportsTab() {
  const { reports, loading, selectedReport, setSelectedReport } = useReports();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Inspection Reports</h2>
          <p className="text-gray-500 text-sm">
            Upload and analyze property inspection reports with AI
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Report
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Reports Yet</h3>
            <p className="text-gray-500 text-center mb-4">
              Upload inspection reports to get AI-powered analysis and insights
            </p>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Your First Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onClick={() => setSelectedReport(report)}
            />
          ))}
        </div>
      )}

      <UploadReportsDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />

      <ReportDetailView
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </div>
  );
}

