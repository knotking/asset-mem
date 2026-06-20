import { Platform } from 'react-native';
import { estimateComposerContentHeight } from '../components/chat/CustomGiftedComposer';

describe('estimateComposerContentHeight', () => {
  const min = 44;
  const max = 120;
  const lineHeight = 20;
  const padding = 20;

  it('returns min height for empty text', () => {
    expect(estimateComposerContentHeight('', lineHeight, padding, min, max, 34)).toBe(min);
    expect(estimateComposerContentHeight('   ', lineHeight, padding, min, max, 34)).toBe(min);
  });

  it('shrinks back to min after multiline text cleared', () => {
    const tall = estimateComposerContentHeight('a\nb\nc\nd', lineHeight, padding, min, max, 34);
    expect(tall).toBeGreaterThan(min);
    expect(estimateComposerContentHeight('', lineHeight, padding, min, max, 34)).toBe(min);
  });

  it('grows with explicit newlines', () => {
    const oneLine = estimateComposerContentHeight('hello', lineHeight, padding, min, max, 34);
    const threeLines = estimateComposerContentHeight('a\nb\nc', lineHeight, padding, min, max, 34);
    expect(threeLines).toBeGreaterThan(oneLine);
    const slack = Platform.OS === 'ios' ? 4 : 0;
    expect(threeLines).toBe(3 * (lineHeight + slack) + padding);
  });

  it('grows when a wrapped line would exceed charsPerLine', () => {
    const short = estimateComposerContentHeight('abc', lineHeight, padding, min, max, 10);
    const wrapped = estimateComposerContentHeight('abcdefghijk', lineHeight, padding, min, max, 10);
    expect(wrapped).toBeGreaterThan(short);
  });

  it('caps at max height', () => {
    const long = 'line\n'.repeat(20);
    expect(estimateComposerContentHeight(long, lineHeight, padding, min, max, 34)).toBe(max);
  });
});
