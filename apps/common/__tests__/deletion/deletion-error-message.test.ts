import {
  deletionErrorLabel,
  deletionHttpErrorMessage,
  formatDeletionErrorMessage,
} from '../../src/lib/deletion/deletion-error-message';
import { deletionServiceUnavailable } from '../../src/lib/deletion/ux-copy';

describe('deletion-error-message', () => {
  it('maps Failed to fetch to a user-facing deletion message', () => {
    expect(formatDeletionErrorMessage(new TypeError('Failed to fetch'))).toBe(
      deletionServiceUnavailable
    );
  });

  it('maps React Native network errors', () => {
    expect(formatDeletionErrorMessage(new Error('Network request failed'))).toBe(
      deletionServiceUnavailable
    );
  });

  it('maps gateway errors from HTTP status', () => {
    expect(deletionHttpErrorMessage(503, '')).toBe(deletionServiceUnavailable);
  });

  it('preserves specific API errors', () => {
    expect(formatDeletionErrorMessage(new Error('TOKEN_QUOTA_EXCEEDED'))).toBe(
      'TOKEN_QUOTA_EXCEEDED'
    );
  });

  it('deletionErrorLabel falls back when empty', () => {
    expect(deletionErrorLabel()).toBe('Delete failed');
    expect(deletionErrorLabel('Failed to fetch')).toBe(deletionServiceUnavailable);
  });
});
