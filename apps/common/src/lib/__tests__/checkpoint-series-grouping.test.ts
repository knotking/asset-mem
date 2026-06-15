import { describe, expect, it } from "@jest/globals";
import type { Checkpoint } from "../../types";
import {
  findPreviousCaptureInList,
  formatCaptureRevisionLabel,
  getDefaultSeriesReassignTargetId,
  getMergeSeriesGuidance,
  groupCheckpointsBySeries,
  listSeriesReassignTargets,
  predictSeriesCaptureAssignment,
} from "../checkpoint-series-grouping";

function cp(
  partial: Partial<Checkpoint> & { id: string }
): Checkpoint {
  return {
    userId: "u1",
    propertyId: "p1",
    name: partial.name ?? "Test",
    createdAt: partial.createdAt ?? ({ toDate: () => new Date("2025-01-01") } as Checkpoint["createdAt"]),
    media: [],
    ...partial,
  };
}

describe("groupCheckpointsBySeries", () => {
  it("groups by seriesId and orders captures newest first", () => {
    const groups = groupCheckpointsBySeries([
      cp({ id: "c1", seriesId: "series_kitchen", revisionNumber: 1, location: "Kitchen" }),
      cp({ id: "c2", seriesId: "series_kitchen", revisionNumber: 2, location: "Kitchen", isLatestInSeries: true }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].captureCount).toBe(2);
    expect(groups[0].captures.map((c) => c.id)).toEqual(["c2", "c1"]);
  });

  it("puts legacy checkpoints in single-item groups", () => {
    const groups = groupCheckpointsBySeries([
      cp({ id: "legacy1", location: "Garage" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].captureCount).toBe(1);
    expect(groups[0].seriesId).toBe("legacy-legacy1");
  });
});

describe("findPreviousCaptureInList", () => {
  it("returns revision N-1 in same series", () => {
    const list = [
      cp({ id: "c1", seriesId: "s1", revisionNumber: 1 }),
      cp({ id: "c2", seriesId: "s1", revisionNumber: 2 }),
    ];
    expect(findPreviousCaptureInList(list, list[1])?.id).toBe("c1");
  });
});

describe("predictSeriesCaptureAssignment", () => {
  it("predicts next revision for matching location", () => {
    const prediction = predictSeriesCaptureAssignment(
      [cp({ id: "c1", seriesId: "series_kitchen", revisionNumber: 2, location: "Kitchen" })],
      { location: "Kitchen" }
    );
    expect(prediction?.nextRevision).toBe(3);
    expect(prediction?.existingCount).toBe(1);
  });
});

describe("formatCaptureRevisionLabel", () => {
  it("labels latest and historical revisions", () => {
    expect(
      formatCaptureRevisionLabel(
        cp({ id: "c1", seriesId: "s", revisionNumber: 3, isLatestInSeries: true })
      )
    ).toBe("Latest · v3");
    expect(
      formatCaptureRevisionLabel(
        cp({ id: "c1", seriesId: "s", revisionNumber: 1, isLatestInSeries: true })
      )
    ).toBe("First capture");
    expect(
      formatCaptureRevisionLabel(
        cp({ id: "c1", seriesId: "s", revisionNumber: 2, isLatestInSeries: false })
      )
    ).toBe("v2");
  });
});

describe("listSeriesReassignTargets", () => {
  it("suggests same-location groups and picks them as default", () => {
    const current = cp({
      id: "c1",
      seriesId: "series_a",
      revisionNumber: 1,
      location: "Vehicle - Exterior",
      name: "Checkpoint A",
    });
    const targets = listSeriesReassignTargets(
      [
        current,
        cp({
          id: "c2",
          seriesId: "series_b",
          revisionNumber: 1,
          location: "Vehicle - Exterior",
          name: "Checkpoint B",
        }),
        cp({
          id: "c3",
          seriesId: "series_kitchen",
          revisionNumber: 1,
          location: "Kitchen",
          name: "Kitchen",
        }),
      ],
      current
    );

    expect(targets).toHaveLength(2);
    expect(targets[0].isSuggestedMatch).toBe(true);
    expect(targets[0].seriesId).toBe("series_b");
    expect(getDefaultSeriesReassignTargetId(targets)).toBe("series_b");
    expect(getMergeSeriesGuidance(targets)).toContain("only need to merge once");
  });
});
