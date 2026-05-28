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
    });
  });

  it('prefers structured UI when contentJson has visible sections', () => {
    expect(getMessageDisplayParts(messageFixtures.structuredAssistantMessage)).toEqual({
      structuredData: messageFixtures.structuredAssistantMessage.contentJson,
      markdown: '',
    });
  });

  it('uses contentJson over dual-format markdown when sections are visible', () => {
    const parts = getMessageDisplayParts(messageFixtures.garageDoorDualFormatMessage);
    expect(parts.structuredData).toBe(messageFixtures.garageDoorDualFormatMessage.contentJson);
    expect(parts.markdown).toBe('');
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
