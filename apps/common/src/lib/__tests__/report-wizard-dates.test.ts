import {
  monthRangeContainingDate,
  rangeEndAfterStartChange,
  rentalComparisonRangesFromAnchors,
  rentalMoveInDates,
  rentalMoveOutDates,
} from "../report-wizard";
import { defaultReportMonthRange } from "../report-quick-presets";

describe("defaultReportMonthRange", () => {
  it("defaults from/to to start and end of the reference month", () => {
    expect(defaultReportMonthRange(new Date(2026, 5, 9))).toEqual({
      start: "2026-06-01",
      end: "2026-06-30",
    });
  });
});

describe("rangeEndAfterStartChange", () => {
  it("mirrors end to start when end was not edited", () => {
    expect(
      rangeEndAfterStartChange("2026-03-01", "2026-01-01", "2026-01-01", false)
    ).toBe("2026-03-01");
  });

  it("keeps end when user edited it", () => {
    expect(
      rangeEndAfterStartChange("2026-03-01", "2026-01-01", "2026-01-31", true)
    ).toBe("2026-01-31");
  });

  it("keeps end when it already differed from start", () => {
    expect(
      rangeEndAfterStartChange("2026-03-01", "2026-01-01", "2026-01-31", false)
    ).toBe("2026-01-31");
  });
});

describe("rentalMoveInDates", () => {
  it("sets baseline start and end to the same day", () => {
    expect(rentalMoveInDates("2026-01-15")).toEqual({
      baselineStart: "2026-01-15",
      baselineEnd: "2026-01-15",
    });
  });
});

describe("rentalMoveOutDates", () => {
  it("sets comparison start and end to the same day", () => {
    expect(rentalMoveOutDates("2026-06-15")).toEqual({
      comparisonStart: "2026-06-15",
      comparisonEnd: "2026-06-15",
    });
  });
});

describe("monthRangeContainingDate", () => {
  it("expands an anchor day to the full calendar month", () => {
    expect(monthRangeContainingDate("2026-05-15")).toEqual({
      start: "2026-05-01",
      end: "2026-05-31",
    });
  });
});

describe("rentalComparisonRangesFromAnchors", () => {
  it("uses the full move-in to move-out span for both sides", () => {
    expect(rentalComparisonRangesFromAnchors("2026-03-31", "2026-06-30")).toEqual({
      baselineStart: "2026-03-31",
      baselineEnd: "2026-06-30",
      comparisonStart: "2026-03-31",
      comparisonEnd: "2026-06-30",
    });
  });

  it("uses the same span for same-month move-in and move-out", () => {
    expect(rentalComparisonRangesFromAnchors("2026-06-01", "2026-06-30")).toEqual({
      baselineStart: "2026-06-01",
      baselineEnd: "2026-06-30",
      comparisonStart: "2026-06-01",
      comparisonEnd: "2026-06-30",
    });
  });

  it("normalizes reversed anchors", () => {
    expect(rentalComparisonRangesFromAnchors("2026-06-30", "2026-06-01")).toEqual({
      baselineStart: "2026-06-01",
      baselineEnd: "2026-06-30",
      comparisonStart: "2026-06-01",
      comparisonEnd: "2026-06-30",
    });
  });
});
