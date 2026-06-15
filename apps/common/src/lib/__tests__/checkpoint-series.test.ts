import {
  buildChronologicalSeriesFields,
  makeSeriesId,
  normalizeSeriesLocation,
  resolveSeriesLocationKey,
  shouldReassignSeriesAfterAnalysis,
  sortSeriesMembersChronologically,
  targetSeriesIdForLocation,
  userProvidedSeriesLocation,
} from "../checkpoint-series";

describe("checkpoint-series", () => {
  it("prefers location over name for series key", () => {
    expect(resolveSeriesLocationKey({ location: "Garage", name: "Other" })).toBe(
      "garage"
    );
    expect(
      resolveSeriesLocationKey({ location: "", name: "Roof", allowNameFallback: false })
    ).toBe("unspecified");
  });

  it("detects when analysis should reassign inferred location", () => {
    expect(
      shouldReassignSeriesAfterAnalysis(
        { seriesId: "series_checkpoint-jun-15", userProvidedLocation: false },
        "Vehicle - Exterior"
      )
    ).toBe(true);
    expect(targetSeriesIdForLocation("Vehicle - Exterior")).toBe(
      makeSeriesId(normalizeSeriesLocation("Vehicle - Exterior"))
    );
  });

  it("skips reassignment when user provided location", () => {
    expect(
      shouldReassignSeriesAfterAnalysis(
        {
          seriesId: "series_kitchen",
          userProvidedLocation: true,
          location: "Kitchen",
        },
        "Kitchen"
      )
    ).toBe(false);
    expect(userProvidedSeriesLocation({ userProvidedLocation: false })).toBe(false);
  });

  it("orders series members chronologically for revision numbers", () => {
    const sorted = sortSeriesMembersChronologically([
      { id: "newer", createdAt: new Date("2026-06-15T09:00:00Z") },
      { id: "older", createdAt: new Date("2026-06-15T08:00:00Z") },
    ]);
    expect(sorted.map((member) => member.id)).toEqual(["older", "newer"]);

    const fields = buildChronologicalSeriesFields(["older", "newer"]);
    expect(fields.get("older")).toEqual({
      revisionNumber: 1,
      supersedesCaptureId: null,
      isLatestInSeries: false,
    });
    expect(fields.get("newer")).toEqual({
      revisionNumber: 2,
      supersedesCaptureId: "older",
      isLatestInSeries: true,
    });
  });
});
