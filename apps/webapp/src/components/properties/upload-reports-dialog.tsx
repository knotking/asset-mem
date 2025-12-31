"use client";

import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, FileText } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useReports } from "@/contexts/reports-context";
import { useToast } from "@/hooks/use-toast";
import type { InspectionReport } from "@/lib/types";

type UploadableFile = {
  file: File;
  id: string;
};

interface UploadReportsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REPORT_TYPES: Array<{ value: InspectionReport["reportType"]; label: string }> = [
  { value: "HOME_INSPECTION", label: "Home Inspection" },
  { value: "PRE_PURCHASE", label: "Pre-Purchase Inspection" },
  { value: "ANNUAL", label: "Annual Inspection" },
  { value: "SPECIALIZED", label: "Specialized Inspection" },
  { value: "OTHER", label: "Other" },
];

export function UploadReportsDialog({
  open,
  onOpenChange,
}: UploadReportsDialogProps) {
  const { uploadReport } = useReports();
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadableFile[]>([]);
  const [reportType, setReportType] = useState<InspectionReport["reportType"]>("HOME_INSPECTION");
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for PDFs
    const validFiles: UploadableFile[] = [];
    const oversizedFiles: string[] = [];

    for (const file of acceptedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        oversizedFiles.push(file.name);
      } else {
        validFiles.push({
          file,
          id: Math.random().toString(36).substr(2, 9),
        });
      }
    }

    if (oversizedFiles.length > 0) {
      toast({
        title: "Files Too Large",
        description: `The following files exceed 50MB: ${oversizedFiles.join(", ")}`,
        variant: "destructive",
      });
    }

    setFiles((prev) => [...prev, ...validFiles]);
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    multiple: true,
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one report to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const uploadPromises = files.map((uploadableFile) =>
        uploadReport(uploadableFile.file, reportType)
      );

      await Promise.all(uploadPromises);

      toast({
        title: "Upload Successful",
        description: `${files.length} report(s) uploaded and queued for analysis`,
      });

      // Reset and close
      setFiles([]);
      onOpenChange(false);
    } catch (error) {
      console.error("Error uploading reports:", error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload reports",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Inspection Reports</DialogTitle>
          <DialogDescription>
            Upload PDF or image files of property inspection reports for AI analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Report Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="report-type">Report Type</Label>
            <Select
              value={reportType}
              onValueChange={(value) => setReportType(value as InspectionReport["reportType"])}
            >
              <SelectTrigger id="report-type">
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Upload Area */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors
              ${isDragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary/50"}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 mb-2">
              {isDragActive
                ? "Drop the files here..."
                : "Drag & drop inspection reports here, or click to select"}
            </p>
            <p className="text-xs text-gray-500">
              Supports PDF and images (max 50MB per file)
            </p>
          </div>

          {/* Selected Files List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files ({files.length})</Label>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {files.map((uploadableFile) => (
                  <div
                    key={uploadableFile.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm truncate">
                        {uploadableFile.file.name}
                      </span>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        ({(uploadableFile.file.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(uploadableFile.id)}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setFiles([]);
              onOpenChange(false);
            }}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || files.length === 0}>
            {isUploading ? "Uploading..." : `Upload ${files.length} Report(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

