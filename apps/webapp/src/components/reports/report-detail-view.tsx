"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Send,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useReports } from "@/contexts/reports-context";
import type { InspectionReport, ReportIssue, ReportRecommendation } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800";
    case "major":
      return "bg-orange-100 text-orange-800";
    case "moderate":
      return "bg-yellow-100 text-yellow-800";
    case "minor":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getTimeframeColor = (timeframe: string) => {
  switch (timeframe) {
    case "immediate":
      return "bg-red-100 text-red-800";
    case "short_term":
      return "bg-orange-100 text-orange-800";
    case "long_term":
      return "bg-blue-100 text-blue-800";
    case "monitoring":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

interface ReportDetailViewProps {
  report: InspectionReport | null;
  onClose: () => void;
}

export function ReportDetailView({ report, onClose }: ReportDetailViewProps) {
  const { chatWithReport } = useReports();
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ q: string; a: string }>>([]);
  const [isChatting, setIsChatting] = useState(false);

  if (!report) return null;

  const aiAnalysis = report.aiAnalysis;

  const handleChat = async () => {
    if (!chatQuestion.trim() || !report.id) return;

    setIsChatting(true);
    const question = chatQuestion;
    setChatQuestion("");

    try {
      const answer = await chatWithReport(report.id, question);
      setChatHistory((prev) => [...prev, { q: question, a: answer }]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatHistory((prev) => [
        ...prev,
        { q: question, a: "Sorry, I couldn't process that question. Please try again." },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <Dialog open={!!report} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{report.name}</DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                {report.createdAt &&
                  formatDistanceToNow(report.createdAt.toDate(), { addSuffix: true })}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.open(report.url, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View PDF
            </Button>
          </div>
        </DialogHeader>

        {report.status !== "complete" || !aiAnalysis ? (
          <div className="py-12 text-center">
            <p className="text-gray-500">
              {report.status === "analyzing"
                ? "Report is being analyzed..."
                : report.status === "failed"
                ? "Analysis failed"
                : "No analysis available"}
            </p>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="issues">Issues</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{aiAnalysis.summary}</p>
                  <div className="mt-4 flex items-center gap-4">
                    <Badge className="text-sm capitalize">
                      {aiAnalysis.overallCondition}
                    </Badge>
                    {aiAnalysis.confidence && (
                      <span className="text-xs text-gray-500">
                        Confidence: {(aiAnalysis.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {aiAnalysis.keyFindings && aiAnalysis.keyFindings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Key Findings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {aiAnalysis.keyFindings.map((finding, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {aiAnalysis.costEstimates && (
                <Card>
                  <CardHeader>
                    <CardTitle>Cost Estimates</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Immediate Repairs:</span>
                      <span className="font-semibold">
                        ${aiAnalysis.costEstimates.immediate?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Short-term (1-3 months):</span>
                      <span className="font-semibold">
                        ${aiAnalysis.costEstimates.shortTerm?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Long-term (1-2 years):</span>
                      <span className="font-semibold">
                        ${aiAnalysis.costEstimates.longTerm?.toLocaleString() || 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="issues" className="space-y-4">
              {aiAnalysis.issues && aiAnalysis.issues.length > 0 ? (
                aiAnalysis.issues.map((issue, idx) => {
                  if (typeof issue === "string") {
                    return (
                      <Card key={idx}>
                        <CardContent className="pt-4">
                          <p className="text-sm">{issue}</p>
                        </CardContent>
                      </Card>
                    );
                  }
                  const typedIssue = issue as ReportIssue;
                  return (
                    <Card key={typedIssue.id || idx}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base">{typedIssue.title}</CardTitle>
                            <p className="text-xs text-gray-500 mt-1">{typedIssue.category}</p>
                          </div>
                          <Badge className={getSeverityColor(typedIssue.severity)}>
                            {typedIssue.severity}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm">{typedIssue.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Location: {typedIssue.location}</span>
                          {typedIssue.estimatedCost && (
                            <span>Est. Cost: ${typedIssue.estimatedCost.toLocaleString()}</span>
                          )}
                          {typedIssue.pageNumber && <span>Page {typedIssue.pageNumber}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <p className="text-center text-gray-500 py-8">No issues found</p>
              )}
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-4">
              {aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0 ? (
                aiAnalysis.recommendations.map((rec, idx) => {
                  const typedRec = rec as ReportRecommendation;
                  return (
                    <Card key={typedRec.id || idx}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base flex-1">{typedRec.issue}</CardTitle>
                          <Badge className={getTimeframeColor(typedRec.timeframe)}>
                            {typedRec.timeframe.replace("_", " ")}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm">{typedRec.recommendation}</p>
                        <div className="flex items-center gap-4 text-xs">
                          {typedRec.estimatedCost && (
                            <span className="text-gray-600">
                              Est. Cost: ${typedRec.estimatedCost.toLocaleString()}
                            </span>
                          )}
                          <Badge variant={typedRec.diyFeasible ? "default" : "secondary"}>
                            {typedRec.diyFeasible ? "DIY Possible" : "Professional Required"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <p className="text-center text-gray-500 py-8">No recommendations available</p>
              )}
            </TabsContent>

            <TabsContent value="chat" className="space-y-4">
              <div className="space-y-4 min-h-[300px] max-h-[400px] overflow-y-auto">
                {chatHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>Ask questions about this report</p>
                    <p className="text-xs mt-2">
                      For example: "What are the critical issues?" or "How much will repairs cost?"
                    </p>
                  </div>
                ) : (
                  chatHistory.map((chat, idx) => (
                    <div key={idx} className="space-y-2">
                      <Card className="bg-blue-50">
                        <CardContent className="pt-4">
                          <p className="text-sm font-medium">Q: {chat.q}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-sm whitespace-pre-wrap">A: {chat.a}</p>
                        </CardContent>
                      </Card>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Ask a question about this report..."
                  value={chatQuestion}
                  onChange={(e) => setChatQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !isChatting && handleChat()}
                  disabled={isChatting}
                />
                <Button onClick={handleChat} disabled={isChatting || !chatQuestion.trim()}>
                  {isChatting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

