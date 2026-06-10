import * as React from 'react';
import { View, ScrollView, Linking, ActivityIndicator, Pressable } from 'react-native';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  FileText,
  ExternalLink,
  Trash2,
  Loader2,
  Pencil,
  Share2,
  RefreshCw,
  MoreHorizontal,
  Search,
  ListFilter,
  Copy,
} from 'lucide-react-native';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useProperty } from '@homeapp/common/contexts/property-context';
import { useOptimisticDeletionOverlay } from '@homeapp/common/hooks/use-optimistic-deletion-overlay';
import { resourceDeletingLabel } from '@homeapp/common/lib/deletion';
import {
  reportDateRangeLabel,
  reportStatusLabel,
  usePropertyReports,
} from '@/hooks/usePropertyReports';
import {
  getPropertyReportSignedUrl,
  setPropertyReportRagIndex,
  sharePropertyReport,
} from '@/lib/api-reports';
import { Switch } from '@/components/ui/switch';
import { getMappDeletionApiUrls } from '@/lib/deletion-api';
import { deleteReportViaProxy } from '@homeapp/common/lib/deletion/api-client';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import { parseFeatureFlagEnv } from '@homeapp/common/lib/feature-flags';
import { purposeLabel } from '@homeapp/common/lib/report-templates';
import type {
  PropertyReport,
  PropertyReportPurpose,
  PropertyReportStatus,
} from '@homeapp/common/types';
import { Input } from '@/components/ui/input';
import { GenerateReportModal } from '@/components/property-details/GenerateReportModal';
import { EditReportMetadataModal } from '@/components/property-details/EditReportMetadataModal';
import { ReportFiltersSheet } from '@/components/property-details/ReportFiltersSheet';
import {
  ReportActionsSheet,
  type ReportAction,
} from '@/components/property-details/ReportActionsSheet';
import { AlertDialogWrapper } from '@/components/property-details/AlertDialogWrapper';
import { useThemedAlert } from '@/contexts/themed-alert-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SHARED_REPORT_TTL_DAYS } from '@homeapp/common/lib/shared-report';

type ReportShareState = 'idle' | 'creating' | 'refreshing' | 'done';

const WEB_APP_URL = (Constants.expoConfig?.extra?.webAppUrl as string) || '';
const REPORT_DOCS_CHAT_RAG_ENABLED = parseFeatureFlagEnv(
  Constants.expoConfig?.extra?.reportDocsChatRagEnabled as boolean | string | undefined
);

function statusTone(status: PropertyReport['status']): string {
  switch (status) {
    case 'ready':
      return 'text-green-700 dark:text-green-400';
    case 'generating':
      return 'text-amber-700 dark:text-amber-400';
    case 'failed':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
}

type PropertyReportsSegmentProps = {
  generateModalVisible?: boolean;
  onGenerateModalVisibleChange?: (visible: boolean) => void;
};

export function PropertyReportsSegment({
  generateModalVisible: controlledVisible,
  onGenerateModalVisibleChange,
}: PropertyReportsSegmentProps = {}) {
  const { showAlert } = useThemedAlert();
  const { reports, loading } = usePropertyReports();
  const { user } = useAuth();
  const { property } = useProperty();
  const { markDeleting, clearDeleting, isDeletingOverlay } = useOptimisticDeletionOverlay();
  const [internalVisible, setInternalVisible] = React.useState(false);
  const isGenerateModalVisible = controlledVisible ?? internalVisible;
  const setIsGenerateModalVisible = onGenerateModalVisibleChange ?? setInternalVisible;
  const [openingId, setOpeningId] = React.useState<string | null>(null);
  const [reportToShare, setReportToShare] = React.useState<PropertyReport | null>(null);
  const [shareState, setShareState] = React.useState<ReportShareState>('idle');
  const [sharedLink, setSharedLink] = React.useState<string | null>(null);
  const [linkCopied, setLinkCopied] = React.useState(false);
  const [linkRefreshed, setLinkRefreshed] = React.useState(false);
  const linkCopiedTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkRefreshedTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reportToDelete, setReportToDelete] = React.useState<PropertyReport | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [editReport, setEditReport] = React.useState<PropertyReport | null>(null);
  const [regenerateFrom, setRegenerateFrom] = React.useState<PropertyReport | null>(null);
  const [ragIndexId, setRagIndexId] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [purposeFilter, setPurposeFilter] = React.useState<PropertyReportPurpose | 'all'>('all');
  const [statusFilter, setStatusFilter] = React.useState<PropertyReportStatus | 'all'>('all');
  const [filterSheetVisible, setFilterSheetVisible] = React.useState(false);
  const [actionsReport, setActionsReport] = React.useState<PropertyReport | null>(null);

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) + (purposeFilter !== 'all' ? 1 : 0);

  const clearFilters = React.useCallback(() => {
    setStatusFilter('all');
    setPurposeFilter('all');
  }, []);

  const filteredReports = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return reports.filter((report) => {
      const purpose = report.purpose ? purposeLabel(report.purpose) : report.mode;
      const matchesSearch =
        !term ||
        [report.title, report.customNotes, purpose, report.mode, reportDateRangeLabel(report)]
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
      const url = await getPropertyReportSignedUrl({
        userId: user.uid,
        propertyId: property.id,
        reportId: report.id,
      });
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        showAlert('Cannot open report', 'No app available to view this link.');
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      showAlert('Could not open report', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setOpeningId(null);
    }
  };

  const runDeleteReport = React.useCallback(
    async (report: PropertyReport) => {
      if (!user || !property) return;
      const urls = getMappDeletionApiUrls();
      if (!urls?.report) {
        showAlert('Delete unavailable', 'Deletion API is not configured.');
        clearDeleting([report.id]);
        return;
      }
      try {
        const result = await deleteReportViaProxy({
          url: urls.report,
          getIdToken: getFirebaseIdTokenForProxy,
          userId: user.uid,
          propertyId: property.id,
          reportId: report.id,
        });
        if (!result.ok) {
          showAlert('Delete failed', result.failed[0]?.message ?? 'Unknown error');
        }
      } finally {
        clearDeleting([report.id]);
      }
    },
    [user, property, clearDeleting, showAlert]
  );

  const reportShareUrl = React.useCallback((shareId: string) => {
    const base = WEB_APP_URL.replace(/\/$/, '');
    return `${base}/share/report/${shareId}`;
  }, []);

  React.useEffect(() => {
    return () => {
      if (linkCopiedTimeoutRef.current) clearTimeout(linkCopiedTimeoutRef.current);
      if (linkRefreshedTimeoutRef.current) clearTimeout(linkRefreshedTimeoutRef.current);
    };
  }, []);

  const handleOpenShareDialog = (report: PropertyReport) => {
    if (report.status !== 'ready') return;
    setLinkCopied(false);
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
    setLinkCopied(false);
    setLinkRefreshed(false);
    if (linkCopiedTimeoutRef.current) clearTimeout(linkCopiedTimeoutRef.current);
    if (linkRefreshedTimeoutRef.current) clearTimeout(linkRefreshedTimeoutRef.current);
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
      const { shareId } = await sharePropertyReport({
        userId: user.uid,
        propertyId: property.id,
        reportId: reportToShare.id,
      });
      setSharedLink(reportShareUrl(shareId));
      setShareState('done');
      if (isRefresh) {
        setLinkRefreshed(true);
        if (linkRefreshedTimeoutRef.current) clearTimeout(linkRefreshedTimeoutRef.current);
        linkRefreshedTimeoutRef.current = setTimeout(() => setLinkRefreshed(false), 2000);
      }
    } catch (err) {
      showAlert('Could not share report', err instanceof Error ? err.message : 'Unknown error');
      setShareState(reportToShare.shareId || sharedLink ? 'done' : 'idle');
    }
  };

  const handleCopyShareLink = async () => {
    if (!sharedLink) return;
    await Clipboard.setStringAsync(sharedLink);
    setLinkCopied(true);
    if (linkCopiedTimeoutRef.current) clearTimeout(linkCopiedTimeoutRef.current);
    linkCopiedTimeoutRef.current = setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleDocsChatToggle = async (report: PropertyReport, enabled: boolean) => {
    if (!user || !property || report.status !== 'ready') return;
    setRagIndexId(report.id);
    try {
      await setPropertyReportRagIndex({
        userId: user.uid,
        propertyId: property.id,
        reportId: report.id,
        includeInDocsChat: enabled,
      });
    } catch (err) {
      showAlert(
        'Could not update Docs chat indexing',
        err instanceof Error ? err.message : 'Unknown error'
      );
    } finally {
      setRagIndexId(null);
    }
  };

  const closeActionsSheet = React.useCallback(() => {
    setActionsReport(null);
  }, []);

  const actionsForReport = React.useCallback(
    (report: PropertyReport): ReportAction[] => {
      const actions: ReportAction[] = [];
      if (report.status === 'ready') {
        actions.push({
          id: 'edit',
          label: 'Edit title & notes',
          onPress: () => {
            closeActionsSheet();
            setEditReport(report);
          },
        });
        actions.push({
          id: 'share',
          label: 'Share link',
          onPress: () => {
            closeActionsSheet();
            handleOpenShareDialog(report);
          },
        });
      }
      if (report.status !== 'generating') {
        actions.push({
          id: 'regenerate',
          label: 'Regenerate report',
          onPress: () => {
            closeActionsSheet();
            setRegenerateFrom(report);
            setIsGenerateModalVisible(true);
          },
        });
      }
      actions.push({
        id: 'delete',
        label: 'Delete',
        destructive: true,
        onPress: () => {
          closeActionsSheet();
          setReportToDelete(report);
          setDeleteDialogOpen(true);
        },
      });
      return actions;
    },
    [closeActionsSheet, handleOpenShareDialog, setIsGenerateModalVisible]
  );

  const openMoreActions = (report: PropertyReport) => {
    if (isDeletingOverlay(report)) return;
    setActionsReport(report);
  };

  const confirmDeleteReport = () => {
    const report = reportToDelete;
    if (!report) return;
    setDeleteDialogOpen(false);
    setReportToDelete(null);
    markDeleting([report.id]);
    void runDeleteReport(report);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator />
        <Text className="mt-2 text-muted-foreground">Loading reports…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="border-b border-border px-4 py-3">
        <Text className="text-sm text-muted-foreground">Saved reports from your timeline</Text>
      </View>
      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {!isTrulyEmpty ? (
          <View className="mb-4 flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center rounded-lg border border-border bg-background px-3">
              <Icon as={Search} size={18} className="text-muted-foreground" />
              <Input
                className="ml-2 flex-1 border-0 bg-transparent"
                placeholder="Search reports..."
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
            </View>
            <Button
              variant="outline"
              size="sm"
              onPress={() => setFilterSheetVisible(true)}
              className={
                activeFilterCount > 0 ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }>
              <Icon
                as={ListFilter}
                size={16}
                className={activeFilterCount > 0 ? 'text-primary' : 'text-foreground'}
              />
              <Text className={activeFilterCount > 0 ? 'text-primary' : 'text-foreground'}>
                {activeFilterCount > 0 ? `Filter · ${activeFilterCount}` : 'Filter'}
              </Text>
            </Button>
          </View>
        ) : null}

        {isTrulyEmpty ? (
          <View className="items-center rounded-xl border border-border bg-card px-6 py-10">
            <Icon as={FileText} size={40} className="mb-3 text-muted-foreground opacity-60" />
            <Text className="text-center font-medium text-foreground">No reports yet</Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground">
              Capture checkpoints on the Timeline tab, then tap + above to create a report.
            </Text>
          </View>
        ) : filteredReports.length === 0 ? (
          <View className="items-center py-8">
            <Text className="text-center text-sm text-muted-foreground">
              No reports match your filters.
            </Text>
            {activeFilterCount > 0 ? (
              <Button variant="link" onPress={clearFilters} className="mt-2">
                <Text className="text-primary">Clear filters</Text>
              </Button>
            ) : null}
          </View>
        ) : (
          filteredReports.map((report) => {
            const isDeleting = isDeletingOverlay(report);
            const purpose = report.purpose ? purposeLabel(report.purpose) : report.mode;
            return (
              <View
                key={report.id}
                className={`relative mb-3 rounded-xl border border-border bg-card p-4 ${isDeleting ? 'opacity-90' : ''}`}>
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
                      {report.title}
                    </Text>
                    <Text className="mt-1 text-sm text-muted-foreground">
                      {reportDateRangeLabel(report)}
                    </Text>
                    <Text className="mt-1 text-xs text-muted-foreground">
                      v{report.revision ?? 1} · {purpose} · {report.checkpointIds?.length ?? 0}{' '}
                      checkpoints
                    </Text>
                  </View>
                  <Text className={`text-xs font-medium ${statusTone(report.status)}`}>
                    {reportStatusLabel(report.status)}
                  </Text>
                </View>
                {report.status === 'failed' && report.failureReason ? (
                  <Text className="mt-2 text-sm text-destructive">{report.failureReason}</Text>
                ) : null}
                {REPORT_DOCS_CHAT_RAG_ENABLED && report.status === 'ready' ? (
                  <View className="mt-2 flex-row items-center gap-2">
                    <Switch
                      checked={!!report.includeInDocsChat}
                      disabled={ragIndexId === report.id}
                      onCheckedChange={(checked) => void handleDocsChatToggle(report, checked)}
                    />
                    <Text className="text-sm text-muted-foreground">Include in Docs chat</Text>
                  </View>
                ) : null}
                {!isDeleting ? (
                  <View className="mt-3 flex-row items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border bg-muted/50 dark:bg-muted/25"
                      disabled={report.status !== 'ready' || openingId === report.id}
                      onPress={() => void handleOpen(report)}>
                      <Icon as={ExternalLink} size={14} className="text-foreground" />
                      <Text>View report</Text>
                    </Button>
                    <Pressable
                      onPress={() => openMoreActions(report)}
                      className="h-8 w-8 items-center justify-center rounded-md border border-border">
                      <Icon as={MoreHorizontal} size={16} className="text-foreground" />
                    </Pressable>
                  </View>
                ) : null}
                {isDeleting ? (
                  <View className="absolute inset-0 items-center justify-center rounded-xl bg-background/90">
                    <View className="flex-row items-center gap-2">
                      <Icon as={Loader2} size={16} className="animate-spin text-muted-foreground" />
                      <Text className="text-sm font-medium text-foreground">
                        {resourceDeletingLabel}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
      <ReportActionsSheet
        visible={!!actionsReport}
        title={actionsReport?.title || 'Report'}
        actions={actionsReport ? actionsForReport(actionsReport) : []}
        onClose={closeActionsSheet}
      />
      <ReportFiltersSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        statusFilter={statusFilter}
        purposeFilter={purposeFilter}
        onStatusFilterChange={setStatusFilter}
        onPurposeFilterChange={setPurposeFilter}
        onClearFilters={clearFilters}
      />
      <GenerateReportModal
        visible={isGenerateModalVisible}
        regenerateFrom={regenerateFrom}
        onClose={() => {
          setIsGenerateModalVisible(false);
          setRegenerateFrom(null);
        }}
      />
      <EditReportMetadataModal
        visible={!!editReport}
        report={editReport}
        onClose={() => setEditReport(null)}
      />
      <AlertDialogWrapper
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setReportToDelete(null);
          }
        }}
        title="Delete report?"
        description={
          reportToDelete
            ? `"${reportToDelete.title}" and its file will be removed permanently.`
            : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteReport}
        showCancel
        confirmVariant="destructive"
      />

      <Dialog open={!!reportToShare} onOpenChange={(open) => !open && handleCloseShareDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Report</DialogTitle>
            <DialogDescription>
              {shareState === 'done' || shareState === 'refreshing'
                ? `Anyone with this link can view this report PDF. Links expire after ${SHARED_REPORT_TTL_DAYS} days (extended when you refresh the link).`
                : `Create a public link for "${reportToShare?.title}"?`}
            </DialogDescription>
          </DialogHeader>

          <View className="min-h-[60px] justify-center">
            {shareState === 'done' || shareState === 'refreshing' ? (
              <View className="gap-2 pt-2">
                <View className="max-w-full overflow-hidden rounded-md border border-border bg-muted px-3 py-2">
                  <Text className="text-sm text-foreground" numberOfLines={2} ellipsizeMode="middle">
                    {sharedLink}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => void performShareAction(true)}
                    disabled={shareState === 'refreshing'}
                    className="flex-1 flex-row items-center justify-center gap-2">
                    {shareState === 'refreshing' ? (
                      <Icon as={Loader2} size={16} className="animate-spin text-foreground" />
                    ) : null}
                    <Text className="text-sm">
                      {shareState === 'refreshing'
                        ? 'Refreshing…'
                        : linkRefreshed
                          ? 'Refreshed!'
                          : 'Refresh link'}
                    </Text>
                  </Button>
                  <Button
                    onPress={() => void handleCopyShareLink()}
                    size="sm"
                    className="flex-1 flex-row items-center justify-center gap-2"
                    disabled={shareState === 'refreshing'}>
                    <Icon as={Copy} size={16} className="text-primary-foreground" />
                    <Text className="text-sm text-primary-foreground">
                      {linkCopied ? 'Copied!' : 'Copy Link'}
                    </Text>
                  </Button>
                </View>
              </View>
            ) : (
              <DialogFooter>
                <Button variant="outline" onPress={handleCloseShareDialog}>
                  <Text className="text-sm">Cancel</Text>
                </Button>
                <Button
                  onPress={() => void performShareAction(false)}
                  disabled={shareState !== 'idle'}
                  className="flex-row items-center gap-2">
                  {shareState === 'creating' ? (
                    <Icon as={Loader2} size={16} className="animate-spin text-primary-foreground" />
                  ) : null}
                  <Text className="text-sm text-primary-foreground">Create public link</Text>
                </Button>
              </DialogFooter>
            )}
          </View>
        </DialogContent>
      </Dialog>
    </View>
  );
}
