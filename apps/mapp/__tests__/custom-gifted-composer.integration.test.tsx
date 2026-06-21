import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CustomGiftedComposer } from '../components/chat/CustomGiftedComposer';

describe('CustomGiftedComposer', () => {
  it('does not spam onInputSizeChanged on mount and parent re-renders', () => {
    const onInputSizeChanged = jest.fn();
    const onTextChanged = jest.fn();

    const { getByPlaceholderText, rerender } = render(
      <CustomGiftedComposer
        text=""
        placeholder="Type a message..."
        onInputSizeChanged={onInputSizeChanged}
        onTextChanged={onTextChanged}
      />
    );

    const afterMount = onInputSizeChanged.mock.calls.length;
    expect(afterMount).toBeLessThanOrEqual(2);

    fireEvent.changeText(getByPlaceholderText('Type a message...'), 'hello');
    const afterType = onInputSizeChanged.mock.calls.length;
    expect(afterType).toBeLessThanOrEqual(afterMount + 1);

    rerender(
      <CustomGiftedComposer
        text="hello"
        placeholder="Type a message..."
        onInputSizeChanged={onInputSizeChanged}
        onTextChanged={onTextChanged}
      />
    );
    expect(onInputSizeChanged.mock.calls.length).toBeLessThanOrEqual(afterType + 1);

    fireEvent.changeText(getByPlaceholderText('Type a message...'), 'hello\nworld');
    const afterNewline = onInputSizeChanged.mock.calls.length;
    expect(afterNewline).toBeLessThanOrEqual(afterType + 2);

    rerender(
      <CustomGiftedComposer
        text="hello\nworld"
        placeholder="Type a message..."
        onInputSizeChanged={onInputSizeChanged}
        onTextChanged={onTextChanged}
      />
    );
    expect(onInputSizeChanged.mock.calls.length).toBeLessThanOrEqual(afterNewline + 1);

    fireEvent.changeText(getByPlaceholderText('Type a message...'), '');
    expect(onInputSizeChanged.mock.calls.length).toBeLessThanOrEqual(afterNewline + 2);
  });
});
