import type { Message } from '@/lib/types';
import { buildAssistantMessageCopyText } from '@/lib/message-copy-text';

describe('message-copy-text', () => {
  it('exports structured sections for assistant copy', () => {
    const message = {
      id: 'm1',
      role: 'assistant',
      content: '',
      contentMarkdown: '## Overview\nSummary text.',
      contentJson: {
        analysis: {
          title: 'Garage door noise',
          triageResult: { diagnosis: 'Worn rollers likely.' },
        },
      },
    } as Message;

    const text = buildAssistantMessageCopyText(message);
    expect(text).toContain('*Garage door noise*');
    expect(text).toContain('Worn rollers likely.');
  });
});
