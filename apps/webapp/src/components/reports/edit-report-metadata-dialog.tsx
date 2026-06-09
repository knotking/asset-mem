'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/auth-context';
import { useProperty } from '@/contexts/property-context';
import { useToast } from '@/hooks/use-toast';
import { updatePropertyReportMetadata } from '@/lib/api-reports';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import type { PropertyReport, PropertyReportTemplate } from '@/lib/types';
import type { PropertyReportLayoutId } from '@/lib/report-templates';
import {
  REPORT_SECTION_TOGGLES,
  buildReportTemplate,
} from '@/lib/report-templates';

type EditReportMetadataDialogProps = {
  report: PropertyReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditReportMetadataDialog({
  report,
  open,
  onOpenChange,
}: EditReportMetadataDialogProps) {
  const { user } = useAuth();
  const { property } = useProperty();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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
  }, [report]);

  const handleSave = async () => {
    if (!user || !property || !report) return;
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Title is required' });
      return;
    }
    setSaving(true);
    try {
      const template = buildReportTemplate(report.purpose || 'custom', layoutId, sectionToggles);
      await updatePropertyReportMetadata(getFirebaseIdTokenForProxy, {
        userId: user.uid,
        propertyId: property.id,
        reportId: report.id,
        title: title.trim(),
        customNotes: notes.trim(),
        template,
      });
      toast({ title: 'Report updated' });
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not update report',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  const isComparison = report?.mode === 'comparison';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-report-title">Title</Label>
            <Input
              id="edit-report-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-report-notes">Notes</Label>
            <Textarea
              id="edit-report-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>PDF sections</Label>
            <p className="text-xs text-muted-foreground">
              Section changes apply when you regenerate this report.
            </p>
            <div className="space-y-3 rounded-md border p-3">
              {REPORT_SECTION_TOGGLES.filter(
                (toggle) => !toggle.comparisonOnly || isComparison
              ).map((toggle) => (
                <div key={toggle.key} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{toggle.label}</p>
                    <p className="text-xs text-muted-foreground">{toggle.description}</p>
                  </div>
                  <Switch
                    checked={sectionToggles[toggle.key]}
                    onCheckedChange={(checked) =>
                      setSectionToggles((prev) => ({ ...prev, [toggle.key]: checked }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
