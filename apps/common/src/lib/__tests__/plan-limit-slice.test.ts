import {
  isAtPlanLimit,
  mergePlanLimitUsage,
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
    expect(planLimitBlockMessage('report', slice)).toMatch(/Monthly report limit/);
  });

  it('mergePlanLimitUsage overlays live Firestore period count', () => {
    const slice = { used: 0, limit: 5, unlimited: false };
    expect(mergePlanLimitUsage(slice, 3)).toEqual({
      used: 3,
      limit: 5,
      unlimited: false,
    });
    expect(mergePlanLimitUsage(null, 3)).toBeNull();
  });
});
