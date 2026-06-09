'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/auth-context';
import { useCheckpoint } from '@/contexts/checkpoint-context';
import { useProperty } from '@/contexts/property-context';
import { useToast } from '@/hooks/use-toast';
import {
  generatePropertyReport,
  previewPropertyReport,
  previewPropertyReportHtml,
} from '@/lib/api-reports';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import { cn } from '@/lib/utils';
import {
  comparisonRangesFromReport,
  snapshotRangeFromReport,
} from '@/lib/report-range';
import type {
  PropertyReport,
  PropertyReportPurpose,
  PropertyReportTemplate,
  ReportPreviewPair,
} from '@/lib/types';
import {
  checkpointIdsForComparisonPair,
  comparisonPairKey,
  previewHasPendingAnalysis,
  type ReportComparisonDateRanges,
} from '@/lib/report-preview';
import {
  useReportWizardCheckpointPreview,
  type ReportPreviewFetchPayload,
} from '@/hooks/use-report-wizard-checkpoint-preview';
import type { PropertyReportLayoutId } from '@/lib/report-templates';
import {
  REPORT_SECTION_TOGGLES,
  buildReportTemplate,
  defaultPurposeForMode,
  sectionTogglesFromTemplate,
} from '@/lib/report-templates';
import { buildReportLayoutPreviewHtml } from '@/lib/report-preview-html';
import {
  DEFAULT_REPORT_INTENT_ID,
  REPORT_INTENT_OPTIONS,
  applyReportIntent,
  suggestReportTitle,
  summarizeCheckpointPreview,
  reportWizardStepLabel,
  type ReportIntentId,
  type ReportWizardStep,
} from '@/lib/report-wizard';
import { ChevronLeft, ChevronDown, Loader2 } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { WizardStepPresence } from '@/components/reports/report-wizard-motion';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

type ReportMode = 'snapshot' | 'comparison';

type GenerateReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regenerateFrom?: PropertyReport | null;
};

export function GenerateReportDialog({
  open,
  onOpenChange,
  regenerateFrom,
}: GenerateReportDialogProps) {
  const { user } = useAuth();
  const { property } = useProperty();
  const {
    checkpoints: localCheckpoints,
    loading: localCheckpointsLoading,
    hasMoreCheckpoints: hasMoreLocalCheckpoints,
  } = useCheckpoint();
  const { toast } = useToast();
  const [mode, setMode] = useState<ReportMode>('snapshot');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(todayIsoDate());
  const [endDate, setEndDate] = useState(todayIsoDate());
  const [baselineStart, setBaselineStart] = useState(todayIsoDate());
  const [baselineEnd, setBaselineEnd] = useState(todayIsoDate());
  const [comparisonStart, setComparisonStart] = useState(todayIsoDate());
  const [comparisonEnd, setComparisonEnd] = useState(todayIsoDate());
  const [notes, setNotes] = useState('');
  const [purpose, setPurpose] = useState<PropertyReportPurpose>('realtor_visit');
  const [layoutId, setLayoutId] = useState<PropertyReportLayoutId>('professional');
  const [sectionToggles, setSectionToggles] = useState<
    Pick<
      PropertyReportTemplate,
      | 'includePhotos'
      | 'includeIssueTable'
      | 'includeMetricsChart'
      | 'includeVisualDiff'
      | 'includeRecommendations'
      | 'includeSignatureBlock'
    >
  >({
    includePhotos: true,
    includeIssueTable: true,
    includeMetricsChart: true,
    includeVisualDiff: true,
    includeRecommendations: true,
    includeSignatureBlock: false,
  });
  const [layoutPreviewOpen, setLayoutPreviewOpen] = useState(false);
  const [layoutPreviewLoading, setLayoutPreviewLoading] = useState(false);
  const [layoutPreviewHtml, setLayoutPreviewHtml] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<ReportWizardStep>(1);
  const [intentId, setIntentId] = useState<ReportIntentId | null>(DEFAULT_REPORT_INTENT_ID);
  const [regenerateAdvanced, setRegenerateAdvanced] = useState(false);
  const [checkpointsExpanded, setCheckpointsExpanded] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slideDirection, setSlideDirection] = useState(1);
  const isRegenerate = Boolean(regenerateFrom?.id);

  const draftSnapshotRange = { start: startDate, end: endDate };
  const draftComparisonRanges: ReportComparisonDateRanges = {
    baselineStart,
    baselineEnd,
    comparisonStart,
    comparisonEnd,
  };

  const fetchReportPreview = useCallback(
    (payload: ReportPreviewFetchPayload) =>
      previewPropertyReport(getFirebaseIdTokenForProxy, payload),
    []
  );

  const {
    preview,
    previewLoading,
    previewError,
    selectedCheckpointIds,
    setSelectedCheckpointIds,
    datesDirty,
    applyDates,
    prepareStep2,
    resetPreviewState,
    invalidatePreviewForIntentChange,
    isCheckpointPreviewPending,
  } = useReportWizardCheckpointPreview({
    enabled: open && !isRegenerate && step === 2 && Boolean(user && property),
    mode,
    userId: user?.uid,
    propertyId: property?.id,
    draftSnapshotRange,
    draftComparisonRanges,
    fetchPreview: fetchReportPreview,
    localCheckpoints,
    localCheckpointsLoading,
    hasMoreLocalCheckpoints,
  });

  const selectIntent = (id: ReportIntentId) => {
    setIntentId(id);
    invalidatePreviewForIntentChange();
    const next = applyReportIntent(id);
    setMode(next.mode);
    setPurpose(next.purpose);
    setTitle(next.title);
    setStartDate(next.startDate);
    setEndDate(next.endDate);
    setBaselineStart(next.baselineStart);
    setBaselineEnd(next.baselineEnd);
    setComparisonStart(next.comparisonStart);
    setComparisonEnd(next.comparisonEnd);
    setLayoutId('professional');
    const defaults = buildReportTemplate(next.purpose, 'professional');
    setSectionToggles({
      includePhotos: defaults.includePhotos,
      includeIssueTable: defaults.includeIssueTable,
      includeMetricsChart: defaults.includeMetricsChart,
      includeVisualDiff: defaults.includeVisualDiff,
      includeRecommendations: defaults.includeRecommendations,
      includeSignatureBlock: defaults.includeSignatureBlock,
    });
  };

  const resetWizard = () => {
    setStep(1);
    setRegenerateAdvanced(false);
    setCheckpointsExpanded(false);
    setAdvancedOpen(false);
    setError(null);
    setNotes('');
    resetPreviewState();
    selectIntent(DEFAULT_REPORT_INTENT_ID);
  };

  const openLayoutPreview = () => {
    if (!preview || !property || !user || layoutPreviewLoading) return;
    setLayoutPreviewLoading(true);
    setLayoutPreviewOpen(true);
    void (async () => {
      const fallback = buildReportLayoutPreviewHtml({
        title: title.trim() || 'Property report',
        purpose,
        layoutId,
        propertyName: property.name,
        propertyAddress: property.address,
        preview,
        selectedCount: selectedCheckpointIds.size,
      });
      try {
        const template = buildReportTemplate(purpose, layoutId, sectionToggles);
        const checkpointIds = Array.from(selectedCheckpointIds);
        const result =
          mode === 'snapshot'
            ? await previewPropertyReportHtml(getFirebaseIdTokenForProxy, {
                userId: user.uid,
                propertyId: property.id,
                title: title.trim() || 'Property report',
                mode: 'snapshot',
                purpose,
                snapshotRange: { start: startDate, end: endDate },
                checkpointIds,
                template,
                customNotes: notes.trim() || undefined,
              })
            : await previewPropertyReportHtml(getFirebaseIdTokenForProxy, {
                userId: user.uid,
                propertyId: property.id,
                title: title.trim() || 'Property report',
                mode: 'comparison',
                purpose,
                baselineRange: { start: baselineStart, end: baselineEnd },
                comparisonRange: { start: comparisonStart, end: comparisonEnd },
                checkpointIds,
                template,
                customNotes: notes.trim() || undefined,
              });
        setLayoutPreviewHtml(result.html || fallback);
      } catch {
        setLayoutPreviewHtml(fallback);
      } finally {
        setLayoutPreviewLoading(false);
      }
    })();
  };

  useEffect(() => {
    if (isRegenerate) return;
    const defaults = buildReportTemplate(purpose, layoutId);
    setSectionToggles({
      includePhotos: defaults.includePhotos,
      includeIssueTable: defaults.includeIssueTable,
      includeMetricsChart: defaults.includeMetricsChart,
      includeVisualDiff: defaults.includeVisualDiff,
      includeRecommendations: defaults.includeRecommendations,
      includeSignatureBlock: defaults.includeSignatureBlock,
    });
  }, [purpose, layoutId, isRegenerate]);

  const toggleCheckpoint = (checkpointId: string, enabled: boolean) => {
    setSelectedCheckpointIds((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(checkpointId);
      else next.delete(checkpointId);
      return next;
    });
  };

  const toggleComparisonPair = (pair: ReportPreviewPair, enabled: boolean) => {
    setSelectedCheckpointIds((prev) => {
      const next = new Set(prev);
      for (const id of checkpointIdsForComparisonPair(pair)) {
        if (enabled) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const isPairSelected = (pair: ReportPreviewPair) =>
    selectedCheckpointIds.has(pair.baselineCheckpointId) &&
    selectedCheckpointIds.has(pair.comparisonCheckpointId);

  useEffect(() => {
    if (!open) return;
    if (!regenerateFrom) {
      resetWizard();
      return;
    }
    setRegenerateAdvanced(false);
    setStep(1);
    setTitle(regenerateFrom.title || '');
    setNotes(regenerateFrom.customNotes || '');
    setPurpose(regenerateFrom.purpose || defaultPurposeForMode(regenerateFrom.mode));
    setLayoutId(regenerateFrom.template?.layoutId || 'professional');
    setSectionToggles(
      sectionTogglesFromTemplate(
        regenerateFrom.template,
        regenerateFrom.purpose || defaultPurposeForMode(regenerateFrom.mode),
        regenerateFrom.template?.layoutId || 'professional'
      )
    );
    if (regenerateFrom.mode === 'comparison') {
      setMode('comparison');
      const ranges = comparisonRangesFromReport(regenerateFrom);
      if (ranges) {
        setBaselineStart(ranges.baselineRange.start);
        setBaselineEnd(ranges.baselineRange.end);
        setComparisonStart(ranges.comparisonRange.start);
        setComparisonEnd(ranges.comparisonRange.end);
      }
    } else {
      setMode('snapshot');
      const snap = snapshotRangeFromReport(regenerateFrom);
      if (snap) {
        setStartDate(snap.start);
        setEndDate(snap.end);
      }
    }
  }, [open, regenerateFrom]);

  const previewSummary =
    preview && !isRegenerate ? summarizeCheckpointPreview(preview, selectedCheckpointIds) : null;

  const goToStep2 = () => {
    if (!intentId) return;
    prepareStep2();
    setSlideDirection(1);
    setStep(2);
  };

  const goToStep3 = () => {
    if (!title.trim()) {
      setTitle(suggestReportTitle(purpose, mode, startDate, endDate));
    }
    setSlideDirection(1);
    setAdvancedOpen(true);
    setStep(3);
  };

  const wizardPanelKey = isRegenerate
    ? regenerateAdvanced
      ? 'regenerate-advanced'
      : 'regenerate'
    : `step-${step}`;

  const isLayoutStep =
    wizardPanelKey === 'step-3' || wizardPanelKey === 'regenerate-advanced';

  const headerTitle = isRegenerate
    ? regenerateAdvanced
      ? 'PDF sections'
      : 'Regenerate report'
    : step === 1
      ? 'Create property report'
      : step === 2
        ? 'Time period'
        : 'PDF sections';

  const handleSubmit = async () => {
    if (!user || !property) return;
    const finalTitle = title.trim() || suggestReportTitle(purpose, mode, startDate, endDate);
    const checkpointIds = isRegenerate ? undefined : Array.from(selectedCheckpointIds);
    if (!isRegenerate && (!checkpointIds || checkpointIds.length === 0)) {
      toast({ variant: 'destructive', title: 'Select at least one checkpoint' });
      return;
    }
    if (
      !isRegenerate &&
      preview &&
      previewHasPendingAnalysis(preview, selectedCheckpointIds)
    ) {
      toast({
        variant: 'destructive',
        title: 'All selected checkpoints must finish analysis before generating',
      });
      return;
    }
    setSubmitting(true);
    try {
      const regenerateReportId = regenerateFrom?.id;
      const template = buildReportTemplate(purpose, layoutId, sectionToggles);
      const result =
        mode === 'snapshot'
          ? await generatePropertyReport(getFirebaseIdTokenForProxy, {
              userId: user.uid,
              propertyId: property.id,
              title: finalTitle,
              mode: 'snapshot',
              purpose,
              snapshotRange: { start: startDate, end: endDate },
              checkpointIds,
              customNotes: notes.trim() || undefined,
              template,
              regenerateReportId,
            })
          : await generatePropertyReport(getFirebaseIdTokenForProxy, {
              userId: user.uid,
              propertyId: property.id,
              title: finalTitle,
              mode: 'comparison',
              purpose,
              baselineRange: { start: baselineStart, end: baselineEnd },
              comparisonRange: { start: comparisonStart, end: comparisonEnd },
              checkpointIds,
              customNotes: notes.trim() || undefined,
              template,
              regenerateReportId,
            });

      toast({
        title: 'Report queued',
        description:
          result.warnings?.length
            ? result.warnings.join(' ')
            : 'Your PDF will appear when generation finishes.',
      });
      onOpenChange(false);
      setTitle('');
      setNotes('');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not generate report',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{headerTitle}</DialogTitle>
          {!isRegenerate ? (
            <DialogDescription>{reportWizardStepLabel(step)}</DialogDescription>
          ) : regenerateAdvanced ? (
            <DialogDescription>Optional — update layout and PDF sections.</DialogDescription>
          ) : (
            <DialogDescription>
              Creates a new PDF revision and archives v{regenerateFrom?.revision ?? 1}. Checkpoints
              and date ranges stay the same.
            </DialogDescription>
          )}
        </DialogHeader>

        <div
          className={cn(
            'py-2',
            isLayoutStep
              ? 'overflow-visible'
              : 'scrollbar-thin-hover max-h-[min(60vh,32rem)] overflow-y-auto'
          )}
        >
          <WizardStepPresence panelKey={wizardPanelKey} direction={slideDirection}>
          {isRegenerate && !regenerateAdvanced ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="report-title">Title</Label>
                <Input
                  id="report-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-notes">Notes (optional)</Label>
                <Textarea
                  id="report-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Agent name, showing time, etc."
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </>
          ) : isRegenerate && regenerateAdvanced ? (
            <>
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" className="h-8 w-full justify-between px-3 text-sm">
                    Advanced PDF sections
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                        advancedOpen && 'rotate-180'
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 rounded-md border p-2">
                    {REPORT_SECTION_TOGGLES.filter(
                      (toggle) => !toggle.comparisonOnly || mode === 'comparison'
                    ).map((toggle) => (
                      <div key={toggle.key} className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{toggle.label}</p>
                          <p className="text-xs text-muted-foreground">{toggle.description}</p>
                        </div>
                        <Switch
                          size="sm"
                          checked={sectionToggles[toggle.key]}
                          onCheckedChange={(checked) =>
                            setSectionToggles((prev) => ({ ...prev, [toggle.key]: checked }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          ) : step === 1 ? (
            <>
              <p className="text-sm text-muted-foreground">
                Pick the reason — we&apos;ll set dates and PDF sections for you.
              </p>
              <div className="grid gap-2">
                {REPORT_INTENT_OPTIONS.map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    variant="outline"
                    className={cn(
                      'h-auto flex-col items-start py-3 text-left',
                      intentId === option.id && 'border-primary bg-primary/10'
                    )}
                    onClick={() => selectIntent(option.id)}
                  >
                    <span
                      className={cn(
                        'font-medium',
                        intentId === option.id && 'text-primary'
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {option.description}
                    </span>
                  </Button>
                ))}
              </div>
            </>
          ) : step === 2 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {mode === 'comparison'
                  ? 'We match rooms by location between the two periods.'
                  : 'Includes the latest checkpoint per location in this range.'}
              </p>
              <div className="space-y-2">
                <Label htmlFor="report-title">Report title</Label>
                <Input
                  id="report-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={suggestReportTitle(purpose, mode, startDate, endDate)}
                />
              </div>
              {mode === 'snapshot' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="report-start">From</Label>
                    <DateInput
                      id="report-start"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="report-end">To</Label>
                    <DateInput
                      id="report-end"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Before (baseline)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="baseline-start">From</Label>
                      <DateInput
                        id="baseline-start"
                        value={baselineStart}
                        onChange={(e) => setBaselineStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="baseline-end">To</Label>
                      <DateInput
                        id="baseline-end"
                        value={baselineEnd}
                        onChange={(e) => setBaselineEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-foreground">After (comparison)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="comparison-start">From</Label>
                      <DateInput
                        id="comparison-start"
                        value={comparisonStart}
                        onChange={(e) => setComparisonStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="comparison-end">To</Label>
                      <DateInput
                        id="comparison-end"
                        value={comparisonEnd}
                        onChange={(e) => setComparisonEnd(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
              {datesDirty ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5">
                  <p className="text-xs text-muted-foreground">
                    Dates changed — update to refresh checkpoints
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2.5 text-xs"
                    onClick={applyDates}
                    disabled={previewLoading}
                  >
                    Update checkpoints
                  </Button>
                </div>
              ) : null}
              <div className={cn('space-y-2', isCheckpointPreviewPending && 'min-h-[5.75rem]')}>
                {isCheckpointPreviewPending ? (
                  <div
                    className="space-y-2"
                    aria-busy="true"
                    aria-label="Loading checkpoints"
                  >
                    <div className="flex h-10 items-center gap-2 rounded-md border border-dashed bg-muted/20 px-3">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Loading checkpoints…</p>
                    </div>
                    <div className="h-10 animate-pulse rounded-md bg-muted/40" aria-hidden />
                  </div>
                ) : previewError ? (
                  <p className="text-sm text-destructive">{previewError}</p>
                ) : (
                  <>
                    {previewSummary ? (
                      <div className="flex min-h-10 items-center rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
                        {previewSummary.selected} selected · {previewSummary.ready} ready
                        {previewSummary.pending > 0 ? ` · ${previewSummary.pending} pending` : ''}
                      </div>
                    ) : null}
                    {preview?.warnings?.length ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {preview.warnings.join(' ')}
                      </p>
                    ) : null}
                    {preview ? (
                      <Collapsible
                        open={checkpointsExpanded}
                        onOpenChange={setCheckpointsExpanded}
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 w-full justify-between px-3 text-sm"
                          >
                            Included checkpoints
                            <ChevronDown
                              className={cn(
                                'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                                checkpointsExpanded && 'rotate-180'
                              )}
                            />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          {preview.mode === 'snapshot' ? (
                            <div className="scrollbar-thin-hover max-h-48 space-y-1 overflow-y-auto rounded-md border p-1.5">
                              {preview.checkpoints.map((row) => {
                                const pending = row.analysisStatus !== 'completed';
                                return (
                                  <div
                                    key={row.checkpointId}
                                    className="flex items-center justify-between gap-2 px-1.5 py-1 text-sm"
                                  >
                                    <div>
                                      <p className="font-medium">{row.location || row.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {pending ? 'Analysis pending' : 'Ready'}
                                      </p>
                                    </div>
                                    <Switch
                                      size="sm"
                                      checked={selectedCheckpointIds.has(row.checkpointId)}
                                      disabled={pending}
                                      onCheckedChange={(checked) =>
                                        toggleCheckpoint(row.checkpointId, checked)
                                      }
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="scrollbar-thin-hover max-h-48 space-y-1 overflow-y-auto rounded-md border p-1.5">
                              {preview.pairs.map((pair) => (
                                <div
                                  key={comparisonPairKey(pair)}
                                  className="flex items-center justify-between gap-2 px-1.5 py-1 text-sm"
                                >
                                  <p className="font-medium">{pair.location}</p>
                                  <Switch
                                    size="sm"
                                    checked={isPairSelected(pair)}
                                    onCheckedChange={(checked) =>
                                      toggleComparisonPair(pair, checked)
                                    }
                                  />
                                </div>
                              ))}
                              {[...preview.baselineOnly, ...preview.comparisonOnly].map((row) => (
                                <div
                                  key={row.checkpointId}
                                  className="flex items-center justify-between gap-2 px-1.5 py-1 text-sm"
                                >
                                  <div>
                                    <p className="font-medium">{row.location || row.name}</p>
                                    <p className="text-xs text-muted-foreground">Unpaired location</p>
                                  </div>
                                  <Switch
                                    size="sm"
                                    checked={selectedCheckpointIds.has(row.checkpointId)}
                                    onCheckedChange={(checked) =>
                                      toggleCheckpoint(row.checkpointId, checked)
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    ) : null}
                  </>
                )}
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Optional — defaults work for most reports.
              </p>
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" className="h-8 w-full justify-between px-3 text-sm">
                    Advanced PDF sections
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                        advancedOpen && 'rotate-180'
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 rounded-md border p-2">
                    {REPORT_SECTION_TOGGLES.filter(
                      (toggle) => !toggle.comparisonOnly || mode === 'comparison'
                    ).map((toggle) => (
                      <div key={toggle.key} className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{toggle.label}</p>
                          <p className="text-xs text-muted-foreground">{toggle.description}</p>
                        </div>
                        <Switch
                          size="sm"
                          checked={sectionToggles[toggle.key]}
                          onCheckedChange={(checked) =>
                            setSectionToggles((prev) => ({ ...prev, [toggle.key]: checked }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <div className="space-y-2">
                <Label htmlFor="report-notes">Notes (optional)</Label>
                <Textarea
                  id="report-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Agent name, showing time, etc."
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </>
          )}
          </WizardStepPresence>
        </div>

        {submitting ? (
          <p className="text-sm text-muted-foreground">
            Submitting your report request. PDF generation runs in the background.
          </p>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {isRegenerate && !regenerateAdvanced ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSlideDirection(1);
                  setAdvancedOpen(true);
                  setRegenerateAdvanced(true);
                }}
                disabled={submitting}
              >
                Change PDF sections
              </Button>
              <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  'Create PDF'
                )}
              </Button>
            </>
          ) : isRegenerate && regenerateAdvanced ? (
            <div className="flex w-full gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSlideDirection(-1);
                  setRegenerateAdvanced(false);
                }}
                disabled={submitting}
              >
                Back
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Creating…' : 'Create PDF'}
              </Button>
            </div>
          ) : step === 1 ? (
            <div className="flex w-full gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={goToStep2} disabled={!intentId}>
                Continue
              </Button>
            </div>
          ) : step === 2 ? (
            <div className="flex w-full gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSlideDirection(-1);
                  setStep(1);
                }}
                disabled={submitting}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={previewLoading || datesDirty}
                onClick={() => {
                  if (datesDirty) {
                    setError('Update checkpoints after changing dates');
                    return;
                  }
                  if (preview && previewHasPendingAnalysis(preview, selectedCheckpointIds)) {
                    setError('All selected checkpoints must finish analysis first');
                    return;
                  }
                  setError(null);
                  goToStep3();
                }}
              >
                Continue
              </Button>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-2">
              {preview && !previewLoading ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={openLayoutPreview}
                  disabled={layoutPreviewLoading}
                >
                  {layoutPreviewLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading preview…
                    </>
                  ) : (
                    'Preview layout'
                  )}
                </Button>
              ) : null}
              <div className="flex w-full gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSlideDirection(-1);
                    setStep(2);
                  }}
                  disabled={submitting}
                >
                  Back
                </Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create PDF'}
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog
      open={layoutPreviewOpen}
      onOpenChange={(open) => {
        setLayoutPreviewOpen(open);
        if (!open) setLayoutPreviewLoading(false);
      }}
    >
      <DialogContent className="max-h-[85vh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Layout preview</DialogTitle>
        </DialogHeader>
        {layoutPreviewLoading ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-3 rounded-md border bg-muted/30">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Building preview…</p>
          </div>
        ) : (
          <iframe
            title="Report layout preview"
            srcDoc={layoutPreviewHtml}
            className="h-[60vh] w-full rounded-md border bg-background"
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
