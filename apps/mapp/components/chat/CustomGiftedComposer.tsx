import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

export type CustomGiftedComposerProps = {
  composerHeight?: number;
  minComposerHeight?: number;
  maxComposerHeight?: number;
  lineHeight?: number;
  verticalPadding?: number;
  horizontalPadding?: number;
  fontSize?: number;
  /** Pill chrome on wrapper — not on TextInput (avoids iOS multiline clip). */
  containerStyle?: ViewStyle;
  text?: string;
  placeholder?: string;
  placeholderTextColor?: string;
  textInputProps?: Partial<TextInputProps>;
  textInputStyle?: TextInputProps['style'];
  textInputAutoFocus?: boolean;
  keyboardAppearance?: TextInputProps['keyboardAppearance'];
  multiline?: boolean;
  disableComposer?: boolean;
  onTextChanged?(text: string): void;
  onInputSizeChanged?(layout: { width: number; height: number }): void;
  /** Rendered inside the pill (border) container — e.g. send button. Clipped by overflow. */
  overlay?: React.ReactNode;
  paddingTop?: number;
  paddingBottomSingle?: number;
  paddingBottomMulti?: number;
  wrapCharsThreshold?: number;
};

const DEFAULT_MIN_HEIGHT = 44;
const DEFAULT_MAX_HEIGHT = 120;
const DEFAULT_LINE_HEIGHT = 20;
const DEFAULT_FONT_SIZE = Platform.OS === 'ios' ? 15 : 16;
const IOS_LINE_SLACK = Platform.OS === 'ios' ? 4 : 0;
const DEFAULT_VERTICAL_PADDING = 20;
const DEFAULT_LAYOUT_WIDTH = 280;
const DEFAULT_HORIZONTAL_PADDING = 12 + 58;

export function composerLooksMultiline(text: string | undefined, wrapThreshold = 28): boolean {
  if (!text?.trim()) return false;
  if (text.includes('\n')) return true;
  return text.length > wrapThreshold;
}

export function estimateComposerContentHeight(
  text: string,
  lineHeight: number,
  verticalPadding: number,
  minHeight: number,
  maxHeight: number,
  charsPerLine: number
): number {
  if (!text.trim()) {
    return minHeight;
  }

  const segments = text.split('\n');
  let lineCount = 0;
  for (const segment of segments) {
    lineCount += Math.max(1, Math.ceil(Math.max(segment.length, 1) / charsPerLine));
  }

  const perLine = lineHeight + IOS_LINE_SLACK;
  const contentHeight = lineCount * perLine + verticalPadding;
  return Math.min(maxHeight, Math.max(minHeight, contentHeight));
}

export function charsPerLineForWidth(width: number, horizontalPadding: number, fontSize = 16): number {
  if (width <= 0) return 30;
  const innerWidth = Math.max(80, width - horizontalPadding);
  return Math.max(12, Math.floor(innerWidth / (fontSize * 0.62)));
}

/**
 * GiftedChat Composer uses fixed height; iOS New Arch often skips onContentSizeChange.
 * Height is derived from text + layout width only — no native content-size feedback
 * (that caused resize loops with GiftedChat state).
 */
export function CustomGiftedComposer({
  minComposerHeight = DEFAULT_MIN_HEIGHT,
  maxComposerHeight = DEFAULT_MAX_HEIGHT,
  lineHeight = DEFAULT_LINE_HEIGHT,
  verticalPadding = DEFAULT_VERTICAL_PADDING,
  horizontalPadding = DEFAULT_HORIZONTAL_PADDING,
  fontSize = DEFAULT_FONT_SIZE,
  containerStyle,
  disableComposer = false,
  keyboardAppearance = 'default',
  multiline = true,
  onInputSizeChanged,
  onTextChanged,
  placeholder = 'Type a message...',
  placeholderTextColor,
  text = '',
  textInputAutoFocus = false,
  textInputProps,
  textInputStyle,
  overlay,
  paddingTop = 10,
  paddingBottomSingle = 10,
  paddingBottomMulti = 28,
  wrapCharsThreshold = 28,
}: CustomGiftedComposerProps) {
  const [layoutWidth, setLayoutWidth] = useState(DEFAULT_LAYOUT_WIDTH);
  const [optimisticText, setOptimisticText] = useState<string | null>(null);
  const reportedHeightRef = useRef<number | null>(null);

  const effectiveText = optimisticText ?? text;

  const isMultiline = composerLooksMultiline(effectiveText, wrapCharsThreshold);
  const paddingBottom = isMultiline ? paddingBottomMulti : paddingBottomSingle;
  const contentVerticalPadding = paddingTop + paddingBottom;
  const singleLineVerticalInset = Math.max(0, (minComposerHeight - lineHeight) / 2);
  const textPaddingTop = isMultiline ? paddingTop : singleLineVerticalInset;
  const textPaddingBottom = isMultiline ? paddingBottom : singleLineVerticalInset;

  useEffect(() => {
    if (optimisticText !== null && text === optimisticText) {
      setOptimisticText(null);
    }
  }, [optimisticText, text]);

  const charsPerLine = useMemo(
    () => charsPerLineForWidth(layoutWidth, horizontalPadding, fontSize),
    [fontSize, horizontalPadding, layoutWidth]
  );

  const inputHeight = useMemo(
    () =>
      estimateComposerContentHeight(
        effectiveText,
        lineHeight,
        contentVerticalPadding,
        minComposerHeight,
        maxComposerHeight,
        charsPerLine
      ),
    [
      charsPerLine,
      contentVerticalPadding,
      effectiveText,
      lineHeight,
      maxComposerHeight,
      minComposerHeight,
    ]
  );

  const syncHeightToParent = useCallback(
    (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      if (reportedHeightRef.current === height) return;
      reportedHeightRef.current = height;
      onInputSizeChanged?.({ width, height });
    },
    [onInputSizeChanged]
  );

  useEffect(() => {
    syncHeightToParent(layoutWidth, inputHeight);
  }, [inputHeight, layoutWidth, syncHeightToParent]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width <= 0) return;
    setLayoutWidth((prev) => (prev === width ? prev : width));
  }, []);

  const handleTextChanged = useCallback(
    (newText: string) => {
      setOptimisticText(newText);
      onTextChanged?.(newText);
    },
    [onTextChanged]
  );

  const {
    onContentSizeChange: textInputOnContentSizeChange,
    onLayout: textInputOnLayout,
    scrollEnabled: textInputScrollEnabled,
    ref: textInputRefFromProps,
    ...restTextInputProps
  } = textInputProps ?? {};

  const assignInputRef = useCallback(
    (node: TextInput | null) => {
      if (typeof textInputRefFromProps === 'function') {
        textInputRefFromProps(node);
      } else if (textInputRefFromProps && 'current' in textInputRefFromProps) {
        (textInputRefFromProps as React.MutableRefObject<TextInput | null>).current = node;
      }
    },
    [textInputRefFromProps]
  );

  const atMaxHeight = inputHeight >= maxComposerHeight;
  const scrollEnabled = textInputScrollEnabled ?? atMaxHeight;

  return (
    <View style={{ width: '100%', height: inputHeight, minHeight: minComposerHeight }} onLayout={handleLayout}>
      <View
        style={[
          { flex: 1, width: '100%', overflow: 'hidden', position: 'relative' },
          containerStyle,
        ]}>
        <TextInput
          ref={assignInputRef}
          testID={placeholder}
          accessible
          accessibilityLabel={placeholder}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          multiline={multiline}
          editable={!disableComposer}
          onContentSizeChange={textInputOnContentSizeChange}
          onLayout={textInputOnLayout}
          onChangeText={handleTextChanged}
          style={[
            {
              width: '100%',
              height: inputHeight,
              maxHeight: inputHeight,
              margin: 0,
              paddingTop: textPaddingTop,
              paddingBottom: textPaddingBottom,
              textAlignVertical: 'top',
            },
            textInputStyle,
          ]}
          autoFocus={textInputAutoFocus}
          value={effectiveText}
          enablesReturnKeyAutomatically
          underlineColorAndroid="transparent"
          keyboardAppearance={keyboardAppearance}
          {...restTextInputProps}
          scrollEnabled={scrollEnabled}
        />
        {overlay}
      </View>
    </View>
  );
}
