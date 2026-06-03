import {
  CHECKPOINT_QUOTA_USER_MESSAGE,
  DOCUMENT_QUOTA_USER_MESSAGE,
  TOKEN_QUOTA_USER_MESSAGE,
  checkpointFailureBadgeLabel,
  getCheckpointAnalysisFailureMessage,
  getPlanLimitFailureMessage,
  isCheckpointPlanLimitFailure,
} from '../document-analysis-errors';

describe('getPlanLimitFailureMessage', () => {
  it('maps document quota API bodies', () => {
    expect(
      getPlanLimitFailureMessage(
        new Error('{"code":"DOCUMENT_QUOTA_EXCEEDED","message":"limit"}')
      )
    ).toBe(DOCUMENT_QUOTA_USER_MESSAGE);
  });

  it('maps checkpoint quota API bodies', () => {
    expect(
      getPlanLimitFailureMessage(new Error('CHECKPOINT_QUOTA_EXCEEDED'))
    ).toBe(CHECKPOINT_QUOTA_USER_MESSAGE);
  });

  it('maps token quota API bodies', () => {
    expect(
      getPlanLimitFailureMessage(new Error('TOKEN_QUOTA_EXCEEDED'))
    ).toBe(TOKEN_QUOTA_USER_MESSAGE);
  });

  it('normalizes worker document limit copy', () => {
    expect(
      getPlanLimitFailureMessage(new Error('Monthly document limit reached.'))
    ).toBe(DOCUMENT_QUOTA_USER_MESSAGE);
  });
});

describe('getCheckpointAnalysisFailureMessage', () => {
  it('uses worker token quota flag', () => {
    expect(
      getCheckpointAnalysisFailureMessage({ analysisQuotaExceeded: true })
    ).toBe(TOKEN_QUOTA_USER_MESSAGE);
  });

  it('uses worker checkpoint creation quota flag', () => {
    expect(
      getCheckpointAnalysisFailureMessage({ analysisCreationQuotaExceeded: true })
    ).toBe(CHECKPOINT_QUOTA_USER_MESSAGE);
  });

  it('prefers stored analysisFailureSummary', () => {
    expect(
      getCheckpointAnalysisFailureMessage({
        analysisFailureSummary: CHECKPOINT_QUOTA_USER_MESSAGE,
      })
    ).toBe(CHECKPOINT_QUOTA_USER_MESSAGE);
  });
});

describe('checkpointFailureBadgeLabel', () => {
  it('shows Plan limit when quota flags set', () => {
    expect(
      checkpointFailureBadgeLabel({ analysisQuotaExceeded: true })
    ).toBe('Plan limit');
    expect(isCheckpointPlanLimitFailure({ analysisQuotaExceeded: true })).toBe(
      true
    );
  });
});
