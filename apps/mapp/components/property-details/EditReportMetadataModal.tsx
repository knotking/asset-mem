import * as React from 'react';
import { Modal, View, ScrollView, Platform, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { X, Loader2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@asset-mem/common/contexts/auth-context';
import { useProperty } from '@asset-mem/common/contexts/property-context';
import { updatePropertyReportMetadata } from '@/lib/api-reports';
import type { PropertyReport, PropertyReportTemplate } from '@asset-mem/common/types';
import type { PropertyReportLayoutId } from '@asset-mem/common/lib/report-templates';
import {
  REPORT_SECTION_TOGGLES,
  buildReportTemplate,
} from '@asset-mem/common/lib/report-templates';
import { Switch } from '@/components/ui/switch';

type EditReportMetadataModalProps = {
  visible: boolean;
  report: PropertyReport | null;
  onClose: () => void;
};

export function EditReportMetadataModal({
  visible,
  report,
  onClose,
}: EditReportMetadataModalProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { property } = useProperty();
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
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
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!report) return;
    setTitle(report.title || '');
    setNotes(report.customNotes || '');
    const template = buildReportTemplate(
      report.purpose || 'custom',
      report.template?.layoutId || 'professional',
      report.template
    );
    setLayoutId(template.layoutId || 'professional');
    setSectionToggles({
      includePhotos: template.includePhotos,
      includeIssueTable: template.includeIssueTable,
      includeMetricsChart: template.includeMetricsChart,
      includeVisualDiff: template.includeVisualDiff,
      includeRecommendations: template.includeRecommendations,
      includeSignatureBlock: template.includeSignatureBlock,
    });
    setError(null);
  }, [report]);

  const handleSave = async () => {
    if (!user || !property || !report) return;
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const template = buildReportTemplate(report.purpose || 'custom', layoutId, sectionToggles);
      await updatePropertyReportMetadata({
        userId: user.uid,
        propertyId: property.id,
        reportId: report.id,
        title: title.trim(),
        customNotes: notes.trim(),
        template,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update report');
    } finally {
      setSaving(false);
    }
  };

  const isComparison = report?.mode === 'comparison';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: Platform.OS === 'ios' ? insets.top : 16 }}>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-lg font-semibold text-foreground">Edit report</Text>
          <Button variant="ghost" size="icon" onPress={onClose}>
            <Icon as={X} size={22} className="text-foreground" />
          </Button>
        </View>
        <ScrollView className="flex-1 px-4 py-4" keyboardShouldPersistTaps="handled">
          <Text className="mb-1 text-sm font-medium text-foreground">Title</Text>
          <Input value={title} onChangeText={setTitle} className="mb-4" />
          <Text className="mb-1 text-sm font-medium text-foreground">Notes</Text>
          <Input
            value={notes}
            onChangeText={setNotes}
            multiline
            className="mb-4 min-h-[80px]"
          />
          <Text className="mb-2 text-sm font-medium text-foreground">Report sections</Text>
          <Text className="mb-3 text-xs text-muted-foreground">
            Section changes apply when you regenerate this report.
          </Text>
          <View className="mb-4 gap-3">
            {REPORT_SECTION_TOGGLES.filter(
              (toggle) => !toggle.comparisonOnly || isComparison
            ).map((toggle) => (
              <View key={toggle.key} className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">{toggle.label}</Text>
                  <Text className="text-xs text-muted-foreground">{toggle.description}</Text>
                </View>
                <Switch
                  checked={sectionToggles[toggle.key]}
                  onCheckedChange={(checked) =>
                    setSectionToggles((prev) => ({ ...prev, [toggle.key]: checked }))
                  }
                />
              </View>
            ))}
          </View>
          {error ? <Text className="mb-3 text-sm text-destructive">{error}</Text> : null}
          <Button onPress={handleSave} disabled={saving} className="mb-8">
            {saving ? (
              <View className="flex-row items-center gap-2">
                <Icon as={Loader2} size={18} className="animate-spin text-primary-foreground" />
                <Text className="text-primary-foreground">Saving…</Text>
              </View>
            ) : (
              <Text className="text-primary-foreground">Save</Text>
            )}
          </Button>
        </ScrollView>
      </View>
    </Modal>
  );
}
