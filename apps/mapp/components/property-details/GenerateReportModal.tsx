import * as React from 'react';
import {
  Modal,
  View,
  ScrollView,
  Platform,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { X, Loader2, ChevronLeft, ChevronDown } from 'lucide-react-native';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getAppThemeColors } from '@/lib/css-theme-tokens';
import { DateInput } from '@/components/ui/date-input';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useCheckpoint } from '@homeapp/common/contexts/checkpoint-context';
import { useProperty } from '@homeapp/common/contexts/property-context';
import {
  generatePropertyReport,
  previewPropertyReport,
  previewPropertyReportHtml,
} from '@/lib/api-reports';
import {
  comparisonRangesFromReport,
  snapshotRangeFromReport,
} from '@/lib/report-range';
import type {
  PropertyReport,
  PropertyReportPurpose,
  PropertyReportTemplate,
  ReportPreviewPair,
} from '@homeapp/common/types';
import {
  checkpointIdsForComparisonPair,
  comparisonPairKey,
  previewHasPendingAnalysis,
  type ReportComparisonDateRanges,
} from '@homeapp/common/lib/report-preview';
import {
  useReportWizardCheckpointPreview,
  type ReportPreviewFetchPayload,
} from '@homeapp/common/hooks/use-report-wizard-checkpoint-preview';
import type { PropertyReportLayoutId } from '@homeapp/common/lib/report-templates';
import {
  REPORT_SECTION_TOGGLES,
  buildReportTemplate,
  defaultPurposeForMode,
  sectionTogglesFromTemplate,
} from '@homeapp/common/lib/report-templates';
import {
  DEFAULT_REPORT_INTENT_ID,
  REPORT_INTENT_OPTIONS,
  applyReportIntent,
  suggestReportTitle,
  summarizeCheckpointPreview,
  reportWizardStepLabel,
  type ReportIntentId,
  type ReportWizardStep,
} from '@homeapp/common/lib/report-wizard';
import { buildReportLayoutPreviewHtml } from '@homeapp/common/lib/report-preview-html';
import { Switch } from '@/components/ui/switch';
import { WebView } from 'react-native-webview';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

type ReportMode = 'snapshot' | 'comparison';

type GenerateReportModalProps = {
  visible: boolean;
  onClose: () => void;
  onQueued?: (warnings?: string[]) => void;
  regenerateFrom?: PropertyReport | null;
};

export function GenerateReportModal({
  visible,
  onClose,
  onQueued,
  regenerateFrom,
}: GenerateReportModalProps) {
  const colorScheme = useColorScheme();
  const backgroundColor = getAppThemeColors(colorScheme === 'dark').background;
  const { user } = useAuth();
  const { property } = useProperty();
  const {
    checkpoints: localCheckpoints,
    loading: localCheckpointsLoading,
    hasMoreCheckpoints: hasMoreLocalCheckpoints,
  } = useCheckpoint();
  const isRegenerate = Boolean(regenerateFrom?.id);

  const [step, setStep] = React.useState<ReportWizardStep>(1);
  const [intentId, setIntentId] = React.useState<ReportIntentId | null>(DEFAULT_REPORT_INTENT_ID);
  const [regenerateAdvanced, setRegenerateAdvanced] = React.useState(false);

  const [mode, setMode] = React.useState<ReportMode>('snapshot');
  const [title, setTitle] = React.useState('');
  const [startDate, setStartDate] = React.useState(todayIsoDate());
  const [endDate, setEndDate] = React.useState(todayIsoDate());
  const [baselineStart, setBaselineStart] = React.useState(todayIsoDate());
  const [baselineEnd, setBaselineEnd] = React.useState(todayIsoDate());
  const [comparisonStart, setComparisonStart] = React.useState(todayIsoDate());
  const [comparisonEnd, setComparisonEnd] = React.useState(todayIsoDate());
  const [notes, setNotes] = React.useState('');
  const [purpose, setPurpose] = React.useState<PropertyReportPurpose>('realtor_visit');
  const [layoutId, setLayoutId] = React.useState<PropertyReportLayoutId>('professional');
  const [sectionToggles, setSectionToggles] = React.useState<
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
  const [checkpointsExpanded, setCheckpointsExpanded] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [layoutPreviewVisible, setLayoutPreviewVisible] = React.useState(false);
  const [layoutPreviewLoading, setLayoutPreviewLoading] = React.useState(false);
  const [layoutPreviewHtml, setLayoutPreviewHtml] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [slideDirection, setSlideDirection] = React.useState(1);

  const draftSnapshotRange = { start: startDate, end: endDate };
  const draftComparisonRanges: ReportComparisonDateRanges = {
    baselineStart,
    baselineEnd,
    comparisonStart,
    comparisonEnd,
  };

  const fetchReportPreview = React.useCallback(
    (payload: ReportPreviewFetchPayload) => previewPropertyReport(payload),
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
    enabled: visible && !isRegenerate && step === 2 && Boolean(user && property),
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

  const selectIntent = React.useCallback((id: ReportIntentId) => {
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
  }, [invalidatePreviewForIntentChange]);

  const handleClose = React.useCallback(() => {
    Keyboard.dismiss();
    setLayoutPreviewVisible(false);
    setLayoutPreviewLoading(false);
    onClose();
  }, [onClose]);

  const resetWizard = React.useCallback(() => {
    setStep(1);
    setRegenerateAdvanced(false);
    setCheckpointsExpanded(false);
    setAdvancedOpen(false);
    setNotes('');
    setError(null);
    resetPreviewState();
    selectIntent(DEFAULT_REPORT_INTENT_ID);
  }, [resetPreviewState, selectIntent]);

  React.useEffect(() => {
    if (!visible) return;
    if (!regenerateFrom) {
      resetWizard();
      return;
    }
    setTitle(regenerateFrom.title || '');
    setNotes(regenerateFrom.customNotes || '');
    setPurpose(regenerateFrom.purpose || defaultPurposeForMode(regenerateFrom.mode));
    setLayoutId(regenerateFrom.template?.layoutId || 'professional');
    setMode(regenerateFrom.mode);
    setSectionToggles(
      sectionTogglesFromTemplate(
        regenerateFrom.template,
        regenerateFrom.purpose || defaultPurposeForMode(regenerateFrom.mode),
        regenerateFrom.template?.layoutId || 'professional'
      )
    );
    setRegenerateAdvanced(false);
    setStep(1);
    if (regenerateFrom.mode === 'comparison') {
      const ranges = comparisonRangesFromReport(regenerateFrom);
      if (ranges) {
        setBaselineStart(ranges.baselineRange.start);
        setBaselineEnd(ranges.baselineRange.end);
        setComparisonStart(ranges.comparisonRange.start);
        setComparisonEnd(ranges.comparisonRange.end);
      }
    } else {
      const snap = snapshotRangeFromReport(regenerateFrom);
      if (snap) {
        setStartDate(snap.start);
        setEndDate(snap.end);
      }
    }
  }, [visible, regenerateFrom, resetWizard]);

  const goToStep2 = () => {
    if (!intentId) return;
    prepareStep2();
    setSlideDirection(1);
    setStep(2);
  };

  const toggleCheckpoint = (checkpointId: string, enabled: boolean) => {
    setSelectedCheckpointIds((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(checkpointId);
      else next.delete(checkpointId);
      return next;
    });
  };

  const goToStep3 = () => {
    if (!title.trim()) {
      setTitle(suggestReportTitle(purpose, mode, startDate, endDate));
    }
    setSlideDirection(1);
    setAdvancedOpen(true);
    setStep(3);
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

  const previewSummary =
    preview && !isRegenerate ? summarizeCheckpointPreview(preview, selectedCheckpointIds) : null;

  const openLayoutPreview = () => {
    if (!preview || !property || !user || layoutPreviewLoading) return;
    setLayoutPreviewLoading(true);
    setLayoutPreviewVisible(true);
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
            ? await previewPropertyReportHtml({
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
            : await previewPropertyReportHtml({
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

  const handleSubmit = async () => {
    if (!user || !property) return;
    const finalTitle = title.trim() || suggestReportTitle(purpose, mode, startDate, endDate);
    if (!isRegenerate) {
      const checkpointIds = Array.from(selectedCheckpointIds);
      if (checkpointIds.length === 0) {
        setError('Select at least one checkpoint');
        return;
      }
      if (preview && previewHasPendingAnalysis(preview, selectedCheckpointIds)) {
        setError('All selected checkpoints must finish analysis before generating');
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const regenerateReportId = regenerateFrom?.id;
      const template = buildReportTemplate(purpose, layoutId, sectionToggles);
      const checkpointIds = isRegenerate ? undefined : Array.from(selectedCheckpointIds);
      const result =
        mode === 'snapshot'
          ? await generatePropertyReport({
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
          : await generatePropertyReport({
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
      onQueued?.(result.warnings);
      resetWizard();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue report');
    } finally {
      setSubmitting(false);
    }
  };

  const renderRegenerateConfirm = () => (
    <ScrollView
      className="flex-1 px-4 py-4"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 24 }}>
      <Text className="mb-2 text-base font-semibold text-foreground">Regenerate this report?</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        Creates a new PDF revision and archives v{regenerateFrom?.revision ?? 1}. Checkpoints and
        date ranges stay the same.
      </Text>
      <Text className="mb-1 text-sm font-medium text-foreground">Title</Text>
      <Input value={title} onChangeText={setTitle} className="mb-4" />
      <Text className="mb-1 text-sm font-medium text-foreground">Notes (optional)</Text>
      <Input
        value={notes}
        onChangeText={setNotes}
        multiline
        className="mb-4 min-h-[80px]"
        placeholder="Agent name, showing time…"
      />
      {error ? <Text className="mb-3 text-sm text-destructive">{error}</Text> : null}
    </ScrollView>
  );

  const renderStep1 = () => (
    <ScrollView className="flex-1 px-4 py-4" keyboardShouldPersistTaps="handled">
      <Text className="mb-1 text-lg font-semibold text-foreground">Create property report</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        Pick the reason — we&apos;ll set dates and PDF sections for you.
      </Text>
      <View className="gap-3">
        {REPORT_INTENT_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => selectIntent(option.id)}
            className={`rounded-xl border px-4 py-3 ${
              intentId === option.id ? 'border-primary bg-primary/10' : 'border-border bg-card'
            }`}>
            <Text
              className={`text-base font-medium ${
                intentId === option.id ? 'text-primary' : 'text-foreground'
              }`}>
              {option.label}
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">{option.description}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView
      className="flex-1 px-4 py-4"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 24 }}>
      <Text className="mb-1 text-lg font-semibold text-foreground">Time period & checkpoints</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        {mode === 'comparison'
          ? 'We match rooms by location between the two periods.'
          : 'Includes the latest checkpoint per location in this range.'}
      </Text>
      <Text className="mb-1 text-sm font-medium text-foreground">Report title</Text>
      <Input
        value={title}
        onChangeText={setTitle}
        placeholder={suggestReportTitle(purpose, mode, startDate, endDate)}
        className="mb-4"
      />
      {mode === 'snapshot' ? (
        <>
          <Text className="mb-1 text-sm font-medium text-foreground">From</Text>
          <DateInput value={startDate} onChange={setStartDate} className="mb-3" />
          <Text className="mb-1 text-sm font-medium text-foreground">To</Text>
          <DateInput value={endDate} onChange={setEndDate} className="mb-4" />
        </>
      ) : (
        <>
          <Text className="mb-1 text-sm font-medium text-foreground">Before (baseline) — from</Text>
          <DateInput value={baselineStart} onChange={setBaselineStart} className="mb-2" />
          <Text className="mb-1 text-sm font-medium text-foreground">Before — to</Text>
          <DateInput value={baselineEnd} onChange={setBaselineEnd} className="mb-3" />
          <Text className="mb-1 text-sm font-medium text-foreground">After (comparison) — from</Text>
          <DateInput value={comparisonStart} onChange={setComparisonStart} className="mb-2" />
          <Text className="mb-1 text-sm font-medium text-foreground">After — to</Text>
          <DateInput value={comparisonEnd} onChange={setComparisonEnd} className="mb-4" />
        </>
      )}
      {datesDirty ? (
        <View className="mb-4 flex-row items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5">
          <Text className="flex-1 text-xs text-muted-foreground">
            Dates changed — update to refresh checkpoints
          </Text>
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 px-2.5"
            onPress={applyDates}
            disabled={previewLoading}>
            <Text className="text-xs text-foreground">Update checkpoints</Text>
          </Button>
        </View>
      ) : null}
      <View className={isCheckpointPreviewPending ? 'mb-4 min-h-[92px]' : 'mb-4'}>
        {isCheckpointPreviewPending ? (
          <View className="gap-2">
            <View className="h-10 flex-row items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3">
              <Icon as={Loader2} size={16} className="animate-spin text-muted-foreground" />
              <Text className="text-sm text-muted-foreground">Loading checkpoints…</Text>
            </View>
            <View className="h-10 rounded-lg bg-muted/40" />
          </View>
        ) : previewError ? (
          <Text className="text-sm text-destructive">{previewError}</Text>
        ) : (
          <>
            {previewSummary ? (
              <View className="mb-3 min-h-10 justify-center rounded-lg border border-border bg-muted/30 px-3 py-2">
                <Text className="text-sm font-medium text-foreground">
                  {previewSummary.selected} selected · {previewSummary.ready} ready
                  {previewSummary.pending > 0 ? ` · ${previewSummary.pending} pending` : ''}
                </Text>
              </View>
            ) : null}
            {preview?.warnings?.length ? (
              <Text className="mb-3 text-xs text-amber-700 dark:text-amber-400">
                {preview.warnings.join(' ')}
              </Text>
            ) : null}
            {preview ? (
              <Collapsible open={checkpointsExpanded} onOpenChange={setCheckpointsExpanded}>
                <CollapsibleTrigger asChild>
                  <Pressable className="mb-2 h-8 flex-row items-center justify-between rounded-lg border border-border px-3 py-1.5">
                    <Text className="text-sm font-medium text-foreground">Included checkpoints</Text>
                    <Icon
                      as={ChevronDown}
                      size={16}
                      className={cn(
                        'text-muted-foreground transition-transform duration-200',
                        checkpointsExpanded && 'rotate-180'
                      )}
                    />
                  </Pressable>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {preview.mode === 'snapshot' ? (
                    <View className="mb-4 gap-1">
                      {preview.checkpoints.map((row) => {
                        const pending = row.analysisStatus !== 'completed';
                        return (
                          <View
                            key={row.checkpointId}
                            className="flex-row items-center justify-between rounded-lg border border-border px-2.5 py-1.5">
                            <View className="flex-1 pr-2">
                              <Text className="text-sm font-medium text-foreground">
                                {row.location || row.name}
                              </Text>
                              <Text className="text-xs text-muted-foreground">
                                {pending ? 'Analysis pending' : 'Ready'}
                              </Text>
                            </View>
                            <Switch
                              size="sm"
                              checked={selectedCheckpointIds.has(row.checkpointId)}
                              disabled={pending}
                              onCheckedChange={(checked) =>
                                toggleCheckpoint(row.checkpointId, checked)
                              }
                            />
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View className="mb-4 gap-1">
                      {preview.pairs.map((pair) => (
                        <View
                          key={comparisonPairKey(pair)}
                          className="rounded-lg border border-border px-2.5 py-1.5">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-sm font-medium text-foreground">{pair.location}</Text>
                            <Switch
                              size="sm"
                              checked={isPairSelected(pair)}
                              onCheckedChange={(checked) => toggleComparisonPair(pair, checked)}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </>
        )}
      </View>
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
    </ScrollView>
  );

  const renderStep3 = () => (
    <ScrollView
      className="flex-1 px-4 py-4"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 24 }}>
      <Text className="mb-1 text-lg font-semibold text-foreground">PDF sections</Text>
      <Text className="mb-4 text-sm text-muted-foreground">Optional — defaults work for most reports.</Text>
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Pressable className="mb-2 h-8 flex-row items-center justify-between rounded-lg border border-border px-3 py-1.5">
            <Text className="text-sm font-medium text-foreground">Advanced PDF sections</Text>
            <Icon
              as={ChevronDown}
              size={16}
              className={cn(
                'text-muted-foreground transition-transform duration-200',
                advancedOpen && 'rotate-180'
              )}
            />
          </Pressable>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <View className="mb-4 gap-2">
            {REPORT_SECTION_TOGGLES.filter(
              (toggle) => !toggle.comparisonOnly || mode === 'comparison'
            ).map((toggle) => (
              <View key={toggle.key} className="flex-row items-center justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">{toggle.label}</Text>
                  <Text className="text-xs text-muted-foreground">{toggle.description}</Text>
                </View>
                <Switch
                  size="sm"
                  checked={sectionToggles[toggle.key]}
                  onCheckedChange={(checked) =>
                    setSectionToggles((prev) => ({ ...prev, [toggle.key]: checked }))
                  }
                />
              </View>
            ))}
          </View>
        </CollapsibleContent>
      </Collapsible>
      <Text className="mb-1 text-sm font-medium text-foreground">Notes (optional)</Text>
      <Input
        value={notes}
        onChangeText={setNotes}
        multiline
        className="mb-4 min-h-[80px]"
        placeholder="Agent name, showing time…"
      />
      {error ? <Text className="mb-3 text-sm text-destructive">{error}</Text> : null}
    </ScrollView>
  );

  const renderRegenerateAdvanced = () => renderStep3();

  const headerTitle = isRegenerate
    ? regenerateAdvanced
      ? 'PDF sections'
      : 'Regenerate report'
    : step === 1
      ? 'Create property report'
      : step === 2
        ? 'Time period'
        : 'PDF sections';

  const showWizardSteps = !isRegenerate;

  const wizardPanelKey = isRegenerate
    ? regenerateAdvanced
      ? 'regenerate-advanced'
      : 'regenerate'
    : `step-${step}`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent
      backdropColor={backgroundColor}
      onRequestClose={handleClose}>
      <SafeAreaView
        className="flex-1 bg-background"
        style={{ backgroundColor }}
        edges={Platform.OS === 'ios' ? ['bottom', 'left', 'right'] : undefined}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <View>
              <Text className="text-lg font-semibold text-foreground">{headerTitle}</Text>
              {showWizardSteps ? (
                <Text className="text-xs text-muted-foreground">{reportWizardStepLabel(step)}</Text>
              ) : null}
            </View>
            <Button variant="ghost" size="icon" onPress={handleClose}>
              <Icon as={X} size={22} className="text-foreground" />
            </Button>
          </View>

          <View className="flex-1 overflow-hidden">
            <Animated.View
              key={wizardPanelKey}
              entering={
                slideDirection > 0 ? SlideInRight.duration(350) : SlideInLeft.duration(350)
              }
              className="flex-1">
              {isRegenerate && !regenerateAdvanced
                ? renderRegenerateConfirm()
                : isRegenerate && regenerateAdvanced
                  ? renderRegenerateAdvanced()
                  : step === 1
                    ? renderStep1()
                    : step === 2
                      ? renderStep2()
                      : renderStep3()}
            </Animated.View>
          </View>

          <View className="border-t border-border px-4 py-3">
          {isRegenerate && !regenerateAdvanced ? (
            <View className="gap-2">
              <Button
                variant="outline"
                onPress={() => {
                  setSlideDirection(1);
                  setAdvancedOpen(true);
                  setRegenerateAdvanced(true);
                }}
                disabled={submitting}>
                <Text>Change PDF sections</Text>
              </Button>
              <Button onPress={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <View className="flex-row items-center gap-2">
                    <Icon as={Loader2} size={18} className="animate-spin text-primary-foreground" />
                    <Text className="text-primary-foreground">Creating…</Text>
                  </View>
                ) : (
                  <Text className="text-primary-foreground">Create PDF</Text>
                )}
              </Button>
            </View>
          ) : isRegenerate && regenerateAdvanced ? (
            <View className="flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => {
                  setSlideDirection(-1);
                  setRegenerateAdvanced(false);
                }}>
                <Text>Back</Text>
              </Button>
              <Button className="flex-1" onPress={handleSubmit} disabled={submitting}>
                <Text className="text-primary-foreground">Create PDF</Text>
              </Button>
            </View>
          ) : step === 1 ? (
            <Button onPress={goToStep2} disabled={!intentId}>
              <Text className="text-primary-foreground">Continue</Text>
            </Button>
          ) : step === 2 ? (
            <View className="flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => {
                  setSlideDirection(-1);
                  setStep(1);
                }}>
                <Icon as={ChevronLeft} size={18} className="text-foreground" />
                <Text>Back</Text>
              </Button>
              <Button
                className="flex-1"
                onPress={() => {
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
                disabled={previewLoading || datesDirty}>
                <Text className="text-primary-foreground">Continue</Text>
              </Button>
            </View>
          ) : (
            <View className="gap-2">
              {preview && !previewLoading ? (
                <Button
                  variant="outline"
                  onPress={openLayoutPreview}
                  disabled={layoutPreviewLoading}>
                  {layoutPreviewLoading ? (
                    <>
                      <Icon as={Loader2} size={16} className="animate-spin text-foreground" />
                      <Text>Loading preview…</Text>
                    </>
                  ) : (
                    <Text>Preview layout</Text>
                  )}
                </Button>
              ) : null}
              <View className="flex-row gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => {
                    setSlideDirection(-1);
                    setStep(2);
                  }}>
                  <Text>Back</Text>
                </Button>
                <Button className="flex-1" onPress={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <Text className="text-primary-foreground">Creating…</Text>
                  ) : (
                    <Text className="text-primary-foreground">Create PDF</Text>
                  )}
                </Button>
              </View>
            </View>
          )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <Modal
        visible={layoutPreviewVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        statusBarTranslucent
        backdropColor={backgroundColor}
        onRequestClose={() => {
          setLayoutPreviewVisible(false);
          setLayoutPreviewLoading(false);
        }}>
        <SafeAreaView
          className="flex-1 bg-background"
          style={{ backgroundColor }}
          edges={Platform.OS === 'ios' ? ['bottom', 'left', 'right'] : undefined}>
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <Text className="text-lg font-semibold text-foreground">Layout preview</Text>
            <Button
              variant="ghost"
              size="icon"
              onPress={() => {
                setLayoutPreviewVisible(false);
                setLayoutPreviewLoading(false);
              }}>
              <Icon as={X} size={22} className="text-foreground" />
            </Button>
          </View>
          {layoutPreviewLoading ? (
            <View className="flex-1 items-center justify-center gap-3 bg-white">
              <Icon as={Loader2} size={32} className="animate-spin text-muted-foreground" />
              <Text className="text-sm text-muted-foreground">Building preview…</Text>
            </View>
          ) : (
            <WebView
              originWhitelist={['*']}
              source={{ html: layoutPreviewHtml }}
              style={{ flex: 1, backgroundColor: '#ffffff' }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}
