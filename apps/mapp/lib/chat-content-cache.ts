import type { ExtractedContentParts } from './chat-content-parse';
import { extractContentParts } from './chat-content-parse';

const TAIL_LENGTH = 64;
const DEFAULT_MAX_ENTRIES = 48;

export function contentParseCacheKey(messageId: string, content: string): string {
  const tail =
    content.length <= TAIL_LENGTH ? content : content.slice(-TAIL_LENGTH);
  return `${messageId}:${content.length}:${tail}`;
}

class LruCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, value);
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

const parseCache = new LruCache<string, ExtractedContentParts>(DEFAULT_MAX_ENTRIES);

/** LRU cache for extractContentParts keyed by messageId + length + content tail. */
export function getCachedExtractContentParts(
  messageId: string,
  content: string,
  isUser: boolean
): ExtractedContentParts {
  const key = contentParseCacheKey(messageId, content);
  const cached = parseCache.get(key);
  if (cached) return cached;

  const parsed = extractContentParts(content, isUser);
  parseCache.set(key, parsed);
  return parsed;
}

/** @internal Test helper */
export function clearContentParseCache(): void {
  parseCache.clear();
}

/** @internal Test helper */
export function getContentParseCacheSize(): number {
  return parseCache.size;
}
