import React from 'react';
import { Pressable, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  ChevronRight,
  DollarSign,
  Info,
  Lightbulb,
  ListChecks,
  ShieldCheck,
  Stethoscope,
  Users,
  Wrench,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CheckpointAccordionBranchBadge } from '@/components/CheckpointAccordionBranchBadge';
import type { StructuredResponseData } from '@asset-mem/common/types';
import {
  EXECUTIVE_SUMMARY_ACCORDION_TITLE,
  SUMMARY_ACCORDION_PLACEHOLDER_PREVIEW,
} from '@asset-mem/common/lib/executive-summary-display';

/** Sections opened in a side sheet from inline structured chat (no accordion). */
export type StructuredSection =
  | 'triage'
  | 'checkpoint-details'
  | 'checkpoint-insights'
  | 'coverage'
  | 'diy'
  | 'service'
  | 'cost-estimates'
  | 'executive-summary';

/** @deprecated Use StructuredSection */
export type StructuredOptionalSection = Exclude<
  StructuredSection,
  'triage' | 'checkpoint-details' | 'checkpoint-insights' | 'executive-summary'
>;

export type StructuredSectionNavItem = {
  section: StructuredSection;
  label: string;
  subtitle?: string;
  icon: LucideIcon;
  iconClassName: string;
  branch?: 'coverage' | 'diy' | 'service' | 'cost';
  sectionReady?: boolean;
};

export const STRUCTURED_SECTION_TITLES: Record<StructuredSection, string> = {
  triage: 'Triage Summary',
  'checkpoint-details': 'Checkpoint Details',
  'checkpoint-insights': 'Insights & Recommendations',
  coverage: 'Coverage Analysis',
  diy: 'DIY Recommendations',
  service: 'Service Recommendations',
  'cost-estimates': 'Cost Estimates',
  'executive-summary': EXECUTIVE_SUMMARY_ACCORDION_TITLE,
};

/** @deprecated Use STRUCTURED_SECTION_TITLES */
export const STRUCTURED_OPTIONAL_SECTION_TITLES = STRUCTURED_SECTION_TITLES;

type Props = {
  items: StructuredSectionNavItem[];
  analysis: StructuredResponseData['analysis'];
  onSectionPress: (section: StructuredSection) => void;
  sectionLabel?: string;
};

export function StructuredSectionNav({
  items,
  analysis,
  onSectionPress,
  sectionLabel = 'Report sections',
}: Props) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View className="mt-4 gap-2">
      <Text className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {sectionLabel}
      </Text>
      {items.map((item) => (
        <Pressable
          key={item.section}
          onPress={() => onSectionPress(item.section)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.label}`}
          className="flex-row items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 active:opacity-80">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-muted/50">
            <Icon as={item.icon} size={18} className={item.iconClassName} />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-base font-medium text-foreground">{item.label}</Text>
              {item.branch ? (
                <CheckpointAccordionBranchBadge
                  branch={item.branch}
                  analysis={analysis}
                  sectionReady={item.sectionReady ?? true}
                />
              ) : null}
            </View>
            {item.subtitle ? (
              <Text className="text-sm text-muted-foreground" numberOfLines={2}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
          <Icon as={ChevronRight} size={18} className="shrink-0 text-muted-foreground" />
        </Pressable>
      ))}
    </View>
  );
}

/** @deprecated Use StructuredSectionNav */
export const StructuredOptionalSectionNav = StructuredSectionNav;

export function buildStructuredSectionNavItems(input: {
  needsClarification: boolean;
  hasTriage: boolean;
  hasCheckpointDetails: boolean;
  hasCheckpointInsights: boolean;
  hasCoverage: boolean;
  hasDIY: boolean;
  hasService: boolean;
  hasCostEstimates: boolean;
  showSummarySection: boolean;
  summaryPreview?: string;
  summarySynthesisInProgress?: boolean;
}): StructuredSectionNavItem[] {
  const items: StructuredSectionNavItem[] = [];

  if (input.needsClarification || input.hasTriage) {
    items.push({
      section: 'triage',
      label: input.needsClarification ? 'Clarification Needed' : 'Triage Summary',
      icon: Stethoscope,
      iconClassName: 'text-info',
    });
  }

  if (input.hasCheckpointDetails) {
    items.push({
      section: 'checkpoint-details',
      label: STRUCTURED_SECTION_TITLES['checkpoint-details'],
      icon: Info,
      iconClassName: 'text-info',
    });
  }

  if (input.hasCheckpointInsights) {
    items.push({
      section: 'checkpoint-insights',
      label: STRUCTURED_SECTION_TITLES['checkpoint-insights'],
      icon: Lightbulb,
      iconClassName: 'text-warning',
    });
  }

  if (input.hasCoverage) {
    items.push({
      section: 'coverage',
      label: STRUCTURED_SECTION_TITLES.coverage,
      icon: ShieldCheck,
      iconClassName: 'text-success',
      branch: 'coverage',
      sectionReady: true,
    });
  }

  if (input.hasDIY) {
    items.push({
      section: 'diy',
      label: STRUCTURED_SECTION_TITLES.diy,
      icon: Wrench,
      iconClassName: 'text-warning',
      branch: 'diy',
      sectionReady: true,
    });
  }

  if (input.hasService) {
    items.push({
      section: 'service',
      label: STRUCTURED_SECTION_TITLES.service,
      icon: Users,
      iconClassName: 'text-indigo-600',
      branch: 'service',
      sectionReady: true,
    });
  }

  if (input.hasCostEstimates) {
    items.push({
      section: 'cost-estimates',
      label: STRUCTURED_SECTION_TITLES['cost-estimates'],
      icon: DollarSign,
      iconClassName: 'text-purple-600',
      branch: 'cost',
      sectionReady: true,
    });
  }

  if (input.showSummarySection) {
    items.push({
      section: 'executive-summary',
      label: STRUCTURED_SECTION_TITLES['executive-summary'],
      subtitle:
        input.summaryPreview ||
        (input.summarySynthesisInProgress ? SUMMARY_ACCORDION_PLACEHOLDER_PREVIEW : undefined),
      icon: ListChecks,
      iconClassName: 'text-emerald-600',
    });
  }

  return items;
}

/** @deprecated Use buildStructuredSectionNavItems */
export function buildOptionalSectionNavItems(input: {
  hasCoverage: boolean;
  hasDIY: boolean;
  hasService: boolean;
  hasCostEstimates: boolean;
}): StructuredSectionNavItem[] {
  return buildStructuredSectionNavItems({
    needsClarification: false,
    hasTriage: false,
    hasCheckpointDetails: false,
    hasCheckpointInsights: false,
    hasCoverage: input.hasCoverage,
    hasDIY: input.hasDIY,
    hasService: input.hasService,
    hasCostEstimates: input.hasCostEstimates,
    showSummarySection: false,
  });
}
