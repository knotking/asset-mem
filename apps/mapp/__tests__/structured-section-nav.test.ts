import { buildStructuredSectionNavItems } from '@/components/chat/StructuredSectionNav';

describe('buildStructuredSectionNavItems', () => {
  it('includes checkpoint, optional branches, and summary rows', () => {
    const items = buildStructuredSectionNavItems({
      needsClarification: false,
      hasTriage: false,
      hasCheckpointDetails: true,
      hasCheckpointInsights: true,
      hasCoverage: true,
      hasDIY: false,
      hasService: true,
      hasCostEstimates: false,
      showSummarySection: true,
      summaryPreview: 'Schedule a professional inspection.',
    });

    expect(items.map((item) => item.section)).toEqual([
      'checkpoint-details',
      'checkpoint-insights',
      'coverage',
      'service',
      'executive-summary',
    ]);
  });

  it('puts summary preview on the executive-summary row', () => {
    const items = buildStructuredSectionNavItems({
      needsClarification: false,
      hasTriage: false,
      hasCheckpointDetails: false,
      hasCheckpointInsights: false,
      hasCoverage: false,
      hasDIY: false,
      hasService: false,
      hasCostEstimates: false,
      showSummarySection: true,
      summaryPreview: 'Replace the washer assembly.',
    });

    expect(items).toHaveLength(1);
    expect(items[0].subtitle).toBe('Replace the washer assembly.');
  });
});
