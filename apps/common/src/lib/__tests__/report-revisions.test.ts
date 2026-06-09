import {
  ReportRevisionListCache,
  reportRevisionListCacheKey,
} from "../report-revisions";

describe("report revision list cache", () => {
  it("builds stable cache keys from report revision", () => {
    expect(reportRevisionListCacheKey("u", "p", "r", 3)).toBe("u/p/r/v3");
  });

  it("stores, returns copies, and evicts oldest entries", () => {
    const cache = new ReportRevisionListCache(2);
    const item = {
      reportId: "report-1",
      revision: 2,
      title: "Move-out",
      mode: "snapshot" as const,
      isArchived: false,
    };

    cache.set("a", [item]);
    cache.set("b", [{ ...item, revision: 1 }]);
    expect(cache.get("a")).toEqual([item]);

    cache.set("c", [{ ...item, revision: 3 }]);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toEqual([{ ...item, revision: 3 }]);
  });
});
