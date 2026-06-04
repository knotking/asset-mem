import {
  isAtPlanLimit,
  planLimitBlockMessage,
  toDisplayPlanLimit,
} from '../plan-limit-slice';

describe('plan-limit-slice', () => {
  it('toDisplayPlanLimit maps proxy payload', () => {
    expect(toDisplayPlanLimit({ used: 1, limit: 2 }, 2)).toEqual({
      used: 1,
      limit: 2,
      unlimited: false,
    });
  });

  it('isAtPlanLimit when next creation would exceed cap', () => {
    const slice = { used: 2, limit: 2, unlimited: false };
    expect(isAtPlanLimit(slice, 1)).toBe(true);
    expect(isAtPlanLimit(slice, 0)).toBe(false);
  });

  it('planLimitBlockMessage at cap', () => {
    const slice = { used: 2, limit: 2, unlimited: false };
    expect(planLimitBlockMessage('document', slice)).toMatch(/Monthly document limit/);
  });
});
