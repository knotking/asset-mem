'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  FileText,
  Loader2,
  Trash2,
  ExternalLink,
  Pencil,
  RefreshCw,
  Share2,
  MoreHorizontal,
  Search,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { useProperty } from '@/contexts/property-context';
import { useDeletionConfig } from '@/contexts/deletion-config-context';
import {
  formatReportDateRange,
  reportStatusLabel,
  useReports,
} from '@/contexts/reports-context';
import { useOptimisticDeletionOverlay } from '@/hooks/use-optimistic-deletion-overlay';
import { useToast } from '@/hooks/use-toast';
import {
  getPropertyReportSignedUrl,
  setPropertyReportRagIndex,
  sharePropertyReport,
} from '@/lib/api-reports';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { parseFeatureFlagEnv } from '@/lib/feature-flags';
import { EditReportMetadataDialog } from '@/components/reports/edit-report-metadata-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { purposeLabel, REPORT_PURPOSE_OPTIONS } from '@/lib/report-templates';
import { reportRangeBound } from '@/lib/report-range';
import { reportComparisonDateRangeLabel } from '@/lib/report-wizard';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import { deleteReportViaProxy } from '@/lib/deletion/api-client';
import { resourceDeletingLabel } from '@/lib/deletion/ux-copy';
import { SHARED_REPORT_TTL_DAYS } from '@/lib/shared-report';
import type { PropertyReport, PropertyReportPurpose, PropertyReportStatus } from '@/lib/types';

type ReportShareState = 'idle' | 'creating' | 'refreshing' | 'done';

function reportShareUrl(shareId: string): string {
  return `${window.location.origin}/share/report/${shareId}`;
}

const REPORT_DOCS_CHAT_RAG_ENABLED = parseFeatureFlagEnv(
  process.env.NEXT_PUBLIC_REPORT_DOCS_CHAT_RAG
);

function dateRangeForReport(report: PropertyReport): string {
  if (report.mode === 'comparison') {
    const label = reportComparisonDateRangeLabel(
      report.purpose ?? 'custom',
      reportRangeBound(report.baselineRange?.start),
      reportRangeBound(report.baselineRange?.end),
      reportRangeBound(report.comparisonRange?.start),
      reportRangeBound(report.comparisonRange?.end)
    );
    if (label) return label;
  }
  const range = report.snapshotRange;
  if (!range) return '—';
  return formatReportDateRange(
    reportRangeBound(range.start),
    reportRangeBound(range.end)
  );
}

type ReportsListProps = {
  onRegenerate?: (report: PropertyReport) => void;
};

export function ReportsList({ onRegenerate }: ReportsListProps) {
  const { reports, loading } = useReports();
  const { user } = useAuth();
  const { property } = useProperty();
  const deletionConfig = useDeletionConfig();
  const { toast } = useToast();
  const { markDeleting, clearDeleting, isDeletingOverlay } = useOptimisticDeletionOverlay();
  const [deleteTarget, setDeleteTarget] = useState<PropertyReport | null>(null);
  const [editTarget, setEditTarget] = useState<PropertyReport | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [reportToShare, setReportToShare] = useState<PropertyReport | null>(null);
  const [shareState, setShareState] = useState<ReportShareState>('idle');
  const [sharedLink, setSharedLink] = useState<string | null>(null);
  const [linkRefreshed, setLinkRefreshed] = useState(false);
  const [ragIndexId, setRagIndexId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState<PropertyReportPurpose | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<PropertyReportStatus | 'all'>('all');

  const filteredReports = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return reports.filter((report) => {
      const purpose = report.purpose ? purposeLabel(report.purpose) : report.mode;
      const matchesSearch =
        !term ||
        [
          report.title,
          report.customNotes,
          purpose,
          report.mode,
          dateRangeForReport(report),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);

      const matchesPurpose =
        purposeFilter === 'all' ||
        report.purpose === purposeFilter ||
        (!report.purpose && purposeFilter === 'custom');

      const matchesStatus = statusFilter === 'all' || report.status === statusFilter;

      return matchesSearch && matchesPurpose && matchesStatus;
    });
  }, [reports, searchTerm, purposeFilter, statusFilter]);

  const isTrulyEmpty =
    reports.length === 0 &&
    !searchTerm &&
    purposeFilter === 'all' &&
    statusFilter === 'all';

  const handleOpen = async (report: PropertyReport) => {
    if (!user || !property || report.status !== 'ready') return;
    setOpeningId(report.id);
    try {
      const url = await getPropertyReportSignedUrl(getFirebaseIdTokenForProxy, {
        userId: user.uid,
        propertyId: property.id,
        reportId: report.id,
      });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not open report',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setOpeningId(null);
    }
  };

  const runDeleteReport = useCallback(
    async (report: PropertyReport) => {
      if (!user || !property || !deletionConfig?.urls?.report) return;

      try {
        const result = await deleteReportViaProxy({
          url: deletionConfig.urls.report,
          getIdToken: deletionConfig.getIdToken,
          userId: user.uid,
          propertyId: property.id,
          reportId: report.id,
        });
        if (!result.ok) {
          toast({
            variant: 'destructive',
            title: 'Delete failed',
            description: result.failed[0]?.message ?? 'Unknown error',
          });
        }
      } finally {
        clearDeleting([report.id]);
      }
    },
    [user, property, deletionConfig, toast, clearDeleting]
  );

  const handleDocsChatToggle = async (report: PropertyReport, enabled: boolean) => {
    if (!user || !property || report.status !== 'ready') return;
    setRagIndexId(report.id);
    try {
      await setPropertyReportRagIndex(getFirebaseIdTokenForProxy, {
        userId: user.uid,
        propertyId: property.id,
        reportId: report.id,
        includeInDocsChat: enabled,
      });
      toast({
        title: enabled ? 'Added to Docs chat' : 'Removed from Docs chat',
        description: enabled
          ? 'Report text can be found when chatting in Docs mode.'
          : 'Report text is no longer indexed for Docs mode.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not update Docs chat indexing',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setRagIndexId(null);
    }
  };

  const handleOpenShareDialog = (report: PropertyReport) => {
    if (report.status !== 'ready') return;
    setLinkRefreshed(false);
    setReportToShare(report);
    if (report.shareId) {
      setSharedLink(reportShareUrl(report.shareId));
      setShareState('done');
    } else {
      setSharedLink(null);
      setShareState('idle');
    }
  };

  const handleCloseShareDialog = () => {
    if (shareState === 'creating' || shareState === 'refreshing') return;
    setLinkRefreshed(false);
    setReportToShare(null);
    setTimeout(() => {
      setShareState('idle');
      setSharedLink(null);
    }, 300);
  };

  const performShareAction = async (isRefresh: boolean) => {
    if (!user || !property || !reportToShare || reportToShare.status !== 'ready') return;
    setShareState(isRefresh ? 'refreshing' : 'creating');
    try {
      const { shareId } = await sharePropertyReport(getFirebaseIdTokenForProxy, {
        userId: user.uid,
        propertyId: property.id,
        reportId: reportToShare.id,
      });
      setSharedLink(reportShareUrl(shareId));
      setShareState('done');
      if (isRefresh) {
        setLinkRefreshed(true);
        window.setTimeout(() => setLinkRefreshed(false), 2000);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not share report',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      setShareState(reportToShare.shareId ? 'done' : 'idle');
    }
  };

  const handleCopyShareLink = () => {
    if (!sharedLink) return;
    void navigator.clipboard.writeText(sharedLink);
    toast({ title: 'Link Copied!' });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const report = deleteTarget;
    setDeleteTarget(null);
    markDeleting([report.id]);
    void runDeleteReport(report);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading reports…
      </div>
    );
  }

  if (isTrulyEmpty) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="font-medium text-foreground">No reports yet</p>
          <p className="mt-1 text-sm">
            Capture checkpoints on the Checkpoints tab, then create a report here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select
          value={purposeFilter}
          onValueChange={(value) => setPurposeFilter(value as PropertyReportPurpose | 'all')}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All purposes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All purposes</SelectItem>
            {REPORT_PURPOSE_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as PropertyReportStatus | 'all')}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="generating">Generating</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredReports.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">No reports match your filters.</div>
      ) : null}

      <div className="space-y-4">
        {filteredReports.map((report) => {
          const isDeleting = isDeletingOverlay(report);

          return (
            <Card
              key={report.id}
              className={cn('relative', isDeleting && 'opacity-90')}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{report.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {dateRangeForReport(report)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      v{report.revision ?? 1} ·{' '}
                      {report.purpose ? purposeLabel(report.purpose) : report.mode} ·{' '}
                      {report.checkpointIds?.length ?? 0} checkpoints
                    </p>
                    <p
                      className={cn(
                        'mt-1 text-xs font-medium',
                        report.status === 'ready' && 'text-green-700 dark:text-green-400',
                        report.status === 'generating' && 'text-amber-700 dark:text-amber-400',
                        report.status === 'failed' && 'text-destructive'
                      )}
                    >
                      {reportStatusLabel(report.status)}
                    </p>
                    {report.status === 'failed' && report.failureReason ? (
                      <p className="text-sm text-destructive mt-1">{report.failureReason}</p>
                    ) : null}
                    {REPORT_DOCS_CHAT_RAG_ENABLED && report.status === 'ready' ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Switch
                          id={`docs-chat-${report.id}`}
                          checked={!!report.includeInDocsChat}
                          disabled={ragIndexId === report.id}
                          onCheckedChange={(checked) =>
                            void handleDocsChatToggle(report, checked)
                          }
                        />
                        <Label
                          htmlFor={`docs-chat-${report.id}`}
                          className="text-sm font-normal text-muted-foreground"
                        >
                          Include in Docs chat
                        </Label>
                      </div>
                    ) : null}
                  </div>
                  {!isDeleting ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border bg-muted/50 hover:bg-muted/70 dark:bg-muted/25 dark:hover:bg-muted/40"
                        disabled={report.status !== 'ready' || openingId === report.id}
                        onClick={() => handleOpen(report)}
                      >
                        {openingId === report.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="mr-2 h-4 w-4" />
                        )}
                        View report
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">More actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {report.status === 'ready' ? (
                            <DropdownMenuItem onClick={() => setEditTarget(report)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit title & notes
                            </DropdownMenuItem>
                          ) : null}
                          {report.status === 'ready' ? (
                            <DropdownMenuItem onClick={() => handleOpenShareDialog(report)}>
                              <Share2 className="mr-2 h-4 w-4" />
                              Share link
                            </DropdownMenuItem>
                          ) : null}
                          {onRegenerate && report.status !== 'generating' ? (
                            <DropdownMenuItem onClick={() => onRegenerate(report)}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Regenerate report
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(report)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              {isDeleting ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/90">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {resourceDeletingLabel}
                  </div>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete report?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes &quot;{deleteTarget?.title}&quot; and its file. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <EditReportMetadataDialog
        report={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      />

      <Dialog open={!!reportToShare} onOpenChange={(open) => !open && handleCloseShareDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Report</DialogTitle>
            <DialogDescription>
              {shareState === 'done' || shareState === 'refreshing'
                ? `Anyone with this link can view this report. Links expire after ${SHARED_REPORT_TTL_DAYS} days (extended when you refresh the link).`
                : `Create a public link for "${reportToShare?.title}"?`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-[60px] flex-col justify-center">
            {shareState === 'done' || shareState === 'refreshing' ? (
              <div className="flex items-center gap-2 pt-2">
                <Input readOnly value={sharedLink ?? ''} className="h-9 min-w-0 flex-1 bg-muted" />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void performShareAction(true)}
                  disabled={shareState === 'refreshing'}
                >
                  {shareState === 'refreshing' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {shareState === 'refreshing'
                    ? 'Refreshing…'
                    : linkRefreshed
                      ? 'Refreshed!'
                      : 'Refresh link'}
                </Button>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={handleCopyShareLink}
                  disabled={shareState === 'refreshing'}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </div>
            ) : (
              <DialogFooter className="gap-2 pt-2 sm:justify-end">
                <Button variant="outline" onClick={handleCloseShareDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void performShareAction(false)}
                  disabled={shareState !== 'idle'}
                >
                  {shareState === 'creating' && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create public link
                </Button>
              </DialogFooter>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
