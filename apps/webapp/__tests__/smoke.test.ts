describe('webapp test harness', () => {
  it('runs jest in jsdom environment', () => {
    expect(typeof window).toBe('object');
    expect(1 + 1).toBe(2);
  });
});
