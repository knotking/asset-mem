import { Platform } from 'react-native';
import { getStructuredAccordionDefaultValue } from '@/lib/structured-accordion-defaults';

describe('getStructuredAccordionDefaultValue', () => {
  const originalOs = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOs;
  });

  it('opens checkpoint summary on Android when present', () => {
    Platform.OS = 'android';
    expect(
      getStructuredAccordionDefaultValue({
        hasCheckpointSummary: true,
        hasCoverage: true,
        hasDIY: true,
      })
    ).toBe('checkpoint-summary');
  });

  it('keeps optional-agent sections collapsed on Android when only summary is present', () => {
    Platform.OS = 'android';
    expect(
      getStructuredAccordionDefaultValue({
        hasCheckpointSummary: true,
        hasCoverage: true,
      })
    ).toBe('checkpoint-summary');
  });

  it('returns undefined on Android when there is no summary or clarification', () => {
    Platform.OS = 'android';
    expect(
      getStructuredAccordionDefaultValue({
        hasCoverage: true,
        hasDIY: true,
      })
    ).toBeUndefined();
  });

  it('opens clarification on Android when needed', () => {
    Platform.OS = 'android';
    expect(
      getStructuredAccordionDefaultValue({
        needsClarification: true,
        hasCheckpointSummary: true,
      })
    ).toBe('triage');
  });

  it('does not default to triage diagnosis on iOS without summary', () => {
    Platform.OS = 'ios';
    expect(
      getStructuredAccordionDefaultValue({
        hasCoverage: true,
      })
    ).toBe('coverage');
  });

  it('prefers checkpoint summary on iOS when present', () => {
    Platform.OS = 'ios';
    expect(
      getStructuredAccordionDefaultValue({
        hasCheckpointSummary: true,
        hasCheckpointDetails: true,
      })
    ).toBe('checkpoint-summary');
  });
});
