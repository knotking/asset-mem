import * as React from 'react';
import { Modal, View, ScrollView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Check, X } from 'lucide-react-native';
import { reportStatusLabel } from '@/hooks/usePropertyReports';
import { REPORT_PURPOSE_OPTIONS } from '@homeapp/common/lib/report-templates';
import type { PropertyReportPurpose, PropertyReportStatus } from '@homeapp/common/types';

const STATUS_OPTIONS = ['all', 'ready', 'generating', 'failed', 'draft'] as const;

type StatusFilter = PropertyReportStatus | 'all';
type PurposeFilter = PropertyReportPurpose | 'all';

type ReportFiltersSheetProps = {
  visible: boolean;
  onClose: () => void;
  statusFilter: StatusFilter;
  purposeFilter: PurposeFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  onPurposeFilterChange: (value: PurposeFilter) => void;
  onClearFilters: () => void;
};

function FilterOptionRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between rounded-lg border px-3 py-3 ${
        selected ? 'border-primary bg-primary/5' : 'border-border bg-card'
      }`}>
      <Text className={`text-sm ${selected ? 'font-medium text-primary' : 'text-foreground'}`}>
        {label}
      </Text>
      {selected ? <Icon as={Check} size={18} className="text-primary" /> : null}
    </Pressable>
  );
}

export function ReportFiltersSheet({
  visible,
  onClose,
  statusFilter,
  purposeFilter,
  onStatusFilterChange,
  onPurposeFilterChange,
  onClearFilters,
}: ReportFiltersSheetProps) {
  const insets = useSafeAreaInsets();
  const hasActiveFilters = statusFilter !== 'all' || purposeFilter !== 'all';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: Platform.OS === 'ios' ? insets.top : 16 }}>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-lg font-semibold text-foreground">Filter reports</Text>
          <Button variant="ghost" size="icon" onPress={onClose}>
            <Icon as={X} size={22} className="text-foreground" />
          </Button>
        </View>
        <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 24 }}>
          <Text className="mb-2 text-sm font-medium text-foreground">Status</Text>
          <View className="mb-5 gap-2">
            {STATUS_OPTIONS.map((status) => (
              <FilterOptionRow
                key={status}
                label={status === 'all' ? 'All status' : reportStatusLabel(status)}
                selected={statusFilter === status}
                onPress={() => onStatusFilterChange(status)}
              />
            ))}
          </View>
          <Text className="mb-2 text-sm font-medium text-foreground">Purpose</Text>
          <View className="mb-6 gap-2">
            <FilterOptionRow
              label="All purposes"
              selected={purposeFilter === 'all'}
              onPress={() => onPurposeFilterChange('all')}
            />
            {REPORT_PURPOSE_OPTIONS.map((option) => (
              <FilterOptionRow
                key={option.id}
                label={option.label}
                selected={purposeFilter === option.id}
                onPress={() => onPurposeFilterChange(option.id)}
              />
            ))}
          </View>
          <Button
            variant="outline"
            onPress={onClearFilters}
            disabled={!hasActiveFilters}
            className="mb-3">
            <Text>Clear filters</Text>
          </Button>
          <Button onPress={onClose}>
            <Text className="text-primary-foreground">Done</Text>
          </Button>
        </ScrollView>
      </View>
    </Modal>
  );
}
