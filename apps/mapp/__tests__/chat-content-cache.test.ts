import {
  clearContentParseCache,
  contentParseCacheKey,
  getCachedExtractContentParts,
  getContentParseCacheSize,
} from '@/lib/chat-content-cache';
import { messageFixtures } from './fixtures/messages';

describe('chat-content-cache', () => {
  beforeEach(() => {
    clearContentParseCache();
  });

  it('builds cache key from message id, length, and tail', () => {
    const content = 'a'.repeat(100);
    expect(contentParseCacheKey('msg-1', content)).toBe(`msg-1:100:${'a'.repeat(64)}`);
  });

  it('returns cached result on identical key', () => {
    const first = getCachedExtractContentParts(
      'msg-1',
      messageFixtures.partialAssistantMessage.content,
      false
    );
    const second = getCachedExtractContentParts(
      'msg-1',
      messageFixtures.partialAssistantMessage.content,
      false
    );
    expect(second).toBe(first);
    expect(getContentParseCacheSize()).toBe(1);
  });

  it('misses cache when content grows during stream', () => {
    const short = 'Streaming...';
    const first = getCachedExtractContentParts('msg-stream', short, false);
    const longer = `${short} more tokens`;
    const second = getCachedExtractContentParts('msg-stream', longer, false);
    expect(second).not.toBe(first);
    expect(getContentParseCacheSize()).toBe(2);
  });

  it('evicts oldest entries when LRU exceeds capacity', () => {
    for (let i = 0; i < 50; i++) {
      getCachedExtractContentParts(`msg-${i}`, `content-${i}`, false);
    }
    expect(getContentParseCacheSize()).toBeLessThanOrEqual(48);
  });
});
