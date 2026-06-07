import { Platform } from 'react-native';
import {
  getStructuredAccordionDefaultValue,
  STRUCTURED_ACCORDION_COLLAPSED,
} from '@/lib/structured-accordion-defaults';

describe('getStructuredAccordionDefaultValue', () => {
  const originalOs = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOs;
  });

  it('exposes a non-undefined collapsed sentinel for native accordion control', () => {
    expect(STRUCTURED_ACCORDION_COLLAPSED).toBe('__collapsed__');
  });

  it('opens checkpoint summary during streaming on Android when data is visible', () => {
    Platform.OS = 'android';
    expect(
      getStructuredAccordionDefaultValue({
        analysisInProgress: true,
        hasCheckpointSummary: true,
        hasCoverage: true,
      })
    ).toBe('checkpoint-summary');
  });

  it('keeps sections collapsed during streaming before checkpoint summary arrives', () => {
    Platform.OS = 'android';
    expect(
      getStructuredAccordionDefaultValue({
        analysisInProgress: true,
        hasCoverage: true,
      })
    ).toBeUndefined();
  });

  it('opens checkpoint summary on Android when synthesis markdown is present', () => {
    Platform.OS = 'android';
    expect(
      getStructuredAccordionDefaultValue({
        hasCheckpointSummary: true,
        hasCoverage: true,
      })
    ).toBe('checkpoint-summary');
  });

  it('opens checkpoint summary on Android when present and complete', () => {
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

  it('opens checkpoint summary on iOS when synthesis markdown is present', () => {
    Platform.OS = 'ios';
    expect(
      getStructuredAccordionDefaultValue({
        hasCheckpointSummary: true,
        hasCheckpointDetails: true,
      })
    ).toBe('checkpoint-summary');
  });
});
