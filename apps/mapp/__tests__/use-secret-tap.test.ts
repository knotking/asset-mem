import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useSecretTapReveal } from '../lib/use-secret-tap';

describe('useSecretTapReveal', () => {
  let appStateHandler: ((state: string) => void) | undefined;

  beforeEach(() => {
    appStateHandler = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      appStateHandler = handler as (state: string) => void;
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reveals after required taps within the window', () => {
    const { result } = renderHook(() =>
      useSecretTapReveal({ requiredTaps: 3, windowMs: 1000 })
    );

    act(() => {
      result.current.onSecretTap();
      result.current.onSecretTap();
      result.current.onSecretTap();
    });

    expect(result.current.revealed).toBe(true);

    act(() => {
      result.current.onSecretTap();
      result.current.onSecretTap();
      result.current.onSecretTap();
    });

    expect(result.current.revealed).toBe(false);
  });

  it('resets tap count after the window elapses', () => {
    const { result } = renderHook(() =>
      useSecretTapReveal({ requiredTaps: 3, windowMs: 500 })
    );

    act(() => {
      result.current.onSecretTap();
      result.current.onSecretTap();
      jest.advanceTimersByTime(600);
      result.current.onSecretTap();
    });

    expect(result.current.revealed).toBe(false);
  });

  it('hides revealed content when app goes to background', () => {
    const { result } = renderHook(() =>
      useSecretTapReveal({ requiredTaps: 2, resetOnBackground: true })
    );

    act(() => {
      result.current.onSecretTap();
      result.current.onSecretTap();
    });
    expect(result.current.revealed).toBe(true);

    act(() => {
      appStateHandler?.('background');
    });
    expect(result.current.revealed).toBe(false);
  });
});
