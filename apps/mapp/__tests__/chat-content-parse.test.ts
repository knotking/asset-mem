import {
  assistantMessageHasDisplayableContent,
  getMessageDisplayParts,
  structuredDataHasVisibleSections,
} from '@/lib/chat-content-parse';
import { messageFixtures } from './fixtures/messages';

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

  it('returns true when service search failed with searchError', () => {
    expect(
      structuredDataHasVisibleSections({
        analysis: {
          serviceResults: {
            searchStatus: 'failed',
            searchError: 'Service provider search is temporarily unavailable.',
            localPros: { serpAPIResults: [], googleSearchResults: [] },
          },
        },
      } as never)
    ).toBe(true);
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

describe('getMessageDisplayParts', () => {
  it('returns markdown for plain assistant text', () => {
    expect(getMessageDisplayParts(messageFixtures.partialAssistantMessage)).toEqual({
      structuredData: null,
      markdown: messageFixtures.partialAssistantMessage.contentMarkdown,
      summaryMarkdown: '',
    });
  });

  it('prefers structured UI when contentJson has visible sections', () => {
    expect(getMessageDisplayParts(messageFixtures.structuredAssistantMessage)).toEqual({
      structuredData: messageFixtures.structuredAssistantMessage.contentJson,
      markdown: '',
      summaryMarkdown: '',
    });
  });

  it('uses contentJson over dual-format markdown when sections are visible', () => {
    const parts = getMessageDisplayParts(messageFixtures.garageDoorDualFormatMessage);
    expect(parts.structuredData).toBe(messageFixtures.garageDoorDualFormatMessage.contentJson);
    expect(parts.markdown).toBe('');
    expect(parts.summaryMarkdown).toContain('### Next Steps');
    expect(parts.summaryMarkdown).not.toContain('Following the inspection');
    expect(parts.summaryMarkdown).not.toContain('Repair Options');
  });

  it('extracts summaryMarkdown from legacy content when contentMarkdown is empty', () => {
    const legacy = {
      ...messageFixtures.garageDoorDualFormatMessage,
      contentMarkdown: '',
      content: `# Garage Door Analysis

Following the inspection, paint chipping was found.

### Next Steps
1. Prep the surface before priming.`,
    };
    const parts = getMessageDisplayParts(legacy);
    expect(parts.summaryMarkdown).toContain('### Next Steps');
    expect(parts.summaryMarkdown).not.toContain('Following the inspection');
  });
});

describe('assistantMessageHasDisplayableContent', () => {
  it('returns true for plain markdown text', () => {
    expect(
      assistantMessageHasDisplayableContent(
        getMessageDisplayParts(messageFixtures.partialAssistantMessage)
      )
    ).toBe(true);
  });

  it('returns true for structured contentJson-only messages', () => {
    expect(
      assistantMessageHasDisplayableContent(
        getMessageDisplayParts(messageFixtures.structuredAssistantMessage)
      )
    ).toBe(true);
  });
});
