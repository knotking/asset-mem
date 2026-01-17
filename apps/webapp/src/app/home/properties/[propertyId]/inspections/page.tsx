'use client';

import { useState } from 'react';
import { InspectionProvider, useInspection } from '@/contexts/inspection-context';
import { InspectionCard } from '@/components/inspections/inspection-card';
import { InspectionDetailDialog } from '@/components/inspections/inspection-detail-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FileText, AlertTriangle, CheckCircle, Upload } from 'lucide-react';
import { Document } from '@/lib/types';
import { useRouter } from 'next/navigation';

function InspectionsPageContent() {
  const { inspections, loading, setSelectedInspection } = useInspection();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter inspections based on search
  const filteredInspections = inspections.filter((inspection) => {
    const matchesSearch =
      !searchTerm ||
      inspection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.summary?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const handleInspectionClick = (inspection: Document) => {
    setSelectedInspection(inspection);
  };

  const handleUpload = () => {
    // Navigate to documents page for upload
    router.push('./documents');
  };

  // Stats for display
  const totalInspections = inspections.length;
  const analyzedInspections = inspections.filter((i) => i.status === 'complete').length;
  const inspectionsWithIssues = inspections.filter((i) =>
    i.keyEntities?.some(
      (entity) =>
        entity.name.toLowerCase().includes('issue') ||
        entity.name.toLowerCase().includes('critical') ||
        entity.name.toLowerCase().includes('major')
    )
  ).length;

  if (loading) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* Header */}
      <div className="border-b bg-background p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Inspection Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and analyze property inspection reports
            </p>
          </div>
          <Button onClick={handleUpload}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Report
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalInspections}</p>
                <p className="text-xs text-muted-foreground">Total Reports</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/20">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analyzedInspections}</p>
                <p className="text-xs text-muted-foreground">Analyzed</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/20">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inspectionsWithIssues}</p>
                <p className="text-xs text-muted-foreground">With Issues</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="border-b bg-background p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search inspection reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {filteredInspections.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No inspection reports</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchTerm
                  ? 'No reports match your search criteria'
                  : 'Upload your first inspection report to get started'}
              </p>
              {!searchTerm && (
                <Button onClick={handleUpload} className="mt-4">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Report
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredInspections.map((inspection) => (
              <InspectionCard
                key={inspection.id}
                inspection={inspection}
                onClick={handleInspectionClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <InspectionDetailDialog />
    </div>
  );
}

export default function InspectionsPage() {
  return (
    <InspectionProvider>
      <InspectionsPageContent />
    </InspectionProvider>
  );
}
