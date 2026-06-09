import {
  ReportPreviewCache,
  comparisonRangesDirty,
  reportWizardDatesDirty,
  snapshotRangesDirty,
} from "../report-preview";

describe("report preview date dirty helpers", () => {
  it("snapshotRangesDirty is false when applied is null", () => {
    expect(snapshotRangesDirty({ start: "2026-01-01", end: "2026-01-02" }, null)).toBe(false);
  });

  it("snapshotRangesDirty detects draft changes", () => {
    const applied = { start: "2026-01-01", end: "2026-01-02" };
    expect(snapshotRangesDirty({ start: "2026-01-01", end: "2026-01-02" }, applied)).toBe(false);
    expect(snapshotRangesDirty({ start: "2026-01-03", end: "2026-01-02" }, applied)).toBe(true);
  });

  it("comparisonRangesDirty is false when applied is null", () => {
    expect(
      comparisonRangesDirty(
        {
          baselineStart: "2026-01-01",
          baselineEnd: "2026-01-02",
          comparisonStart: "2026-02-01",
          comparisonEnd: "2026-02-02",
        },
        null
      )
    ).toBe(false);
  });

  it("reportWizardDatesDirty respects mode", () => {
    const snapshotDraft = { start: "2026-01-01", end: "2026-01-02" };
    const snapshotApplied = { start: "2026-01-01", end: "2026-01-01" };
    const comparisonDraft = {
      baselineStart: "2026-01-01",
      baselineEnd: "2026-01-02",
      comparisonStart: "2026-02-01",
      comparisonEnd: "2026-02-02",
    };
    const comparisonApplied = { ...comparisonDraft };

    expect(
      reportWizardDatesDirty(
        "snapshot",
        snapshotDraft,
        snapshotApplied,
        comparisonDraft,
        comparisonApplied
      )
    ).toBe(true);

    expect(
      reportWizardDatesDirty(
        "comparison",
        snapshotDraft,
        snapshotApplied,
        comparisonDraft,
        comparisonApplied
      )
    ).toBe(false);
  });
});

describe("ReportPreviewCache", () => {
  const snapshotPreview = {
    mode: "snapshot" as const,
    checkpoints: [],
    warnings: [],
  };

  it("evicts least-recently-used entry when over max size", () => {
    const cache = new ReportPreviewCache(2);
    cache.set("a", snapshotPreview);
    cache.set("b", snapshotPreview);
    cache.get("a");
    cache.set("c", snapshotPreview);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBeDefined();
    expect(cache.get("c")).toBeDefined();
  });
});
