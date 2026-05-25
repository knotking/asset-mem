import {
  assistantMessageHasDisplayableContent,
  extractContentParts,
  structuredDataHasVisibleSections,
} from '@/lib/chat-content-parse';

describe('structuredDataHasVisibleSections', () => {
  it('returns false for empty checkpoint streaming shell', () => {
    expect(
      structuredDataHasVisibleSections({
        analysis: {
          checkpointSummary: {},
          coverageResult: {},
          serviceResults: {},
        },
      } as never)
    ).toBe(false);
  });

  it('returns false for title-only streaming shell', () => {
    expect(
      structuredDataHasVisibleSections({
        analysis: {
          title: 'Garage Door Maintenance Analysis',
        },
      } as never)
    ).toBe(false);
  });

  it('returns true when checkpointSummary has data', () => {
    expect(
      structuredDataHasVisibleSections({
        analysis: {
          title: 'Garage Door Maintenance Analysis',
          checkpointSummary: {
            checkpointsAnalyzed: 1,
            issuesDetected: ['Paint chipping'],
            locations: ['Garage'],
          },
        },
      } as never)
    ).toBe(true);
  });
});

describe('assistantMessageHasDisplayableContent', () => {
  it('returns false for title-only JSON shell', () => {
    const extracted = extractContentParts(
      JSON.stringify({ analysis: { title: 'Garage Door Maintenance Analysis' } }),
      false
    );
    expect(assistantMessageHasDisplayableContent(extracted)).toBe(false);
  });

  it('returns true for plain markdown text', () => {
    expect(
      assistantMessageHasDisplayableContent(
        extractContentParts('Hello from the assistant.', false)
      )
    ).toBe(true);
  });
});
