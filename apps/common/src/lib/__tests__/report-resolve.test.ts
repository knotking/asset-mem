import type { Checkpoint } from "../../types";
import {
  canResolveReportPreviewLocally,
  pickLatestCheckpointPerLocation,
  resolveComparisonFromCheckpoints,
  resolveSnapshotPreviewFromCheckpoints,
} from "../report-resolve";

function cp(
  id: string,
  location: string,
  iso: string,
  extras: Partial<Checkpoint> = {}
): Checkpoint {
  const createdAt = { toDate: () => new Date(iso) } as Checkpoint["createdAt"];
  return {
    id,
    userId: "u1",
    propertyId: "p1",
    name: location,
    createdAt,
    media: [],
    location,
    ...extras,
  };
}

describe("report-resolve", () => {
  it("picks latest checkpoint per location by date", () => {
    const picked = pickLatestCheckpointPerLocation([
      cp("old", "Garage", "2026-06-01T10:00:00.000Z", { assetConfidence: 0.9 }),
      cp("new", "Garage", "2026-06-08T10:00:00.000Z", { assetConfidence: 0.4 }),
    ]);
    expect(picked.get("garage")?.id).toBe("new");
  });

  it("resolves snapshot preview with latest per location in range", () => {
    const preview = resolveSnapshotPreviewFromCheckpoints(
      [
        cp("k1", "Kitchen", "2026-06-09T10:00:00.000Z"),
        cp("k2", "Kitchen", "2026-06-09T15:00:00.000Z"),
        cp("g1", "Garage", "2026-06-09T11:00:00.000Z"),
      ],
      { start: "2026-06-09", end: "2026-06-09" }
    );
    expect(preview.mode).toBe("snapshot");
    if (preview.mode !== "snapshot") {
      throw new Error("expected snapshot preview");
    }
    expect(preview.checkpoints).toHaveLength(2);
    expect(preview.checkpoints.map((row) => row.checkpointId).sort()).toEqual([
      "g1",
      "k2",
    ]);
  });

  it("pairs comparison checkpoints by location", () => {
    const resolution = resolveComparisonFromCheckpoints(
      [
        cp("b1", "Garage", "2026-01-01T00:00:00.000Z"),
        cp("b2", "Kitchen", "2026-01-02T00:00:00.000Z"),
        cp("c1", "Garage", "2026-06-01T00:00:00.000Z"),
        cp("c3", "Bedroom", "2026-06-02T00:00:00.000Z"),
      ],
      { start: "2026-01-01", end: "2026-01-31" },
      { start: "2026-06-01", end: "2026-06-30" }
    );
    expect(resolution.pairs).toHaveLength(1);
    expect(resolution.pairs[0]?.baselineCheckpointId).toBe("b1");
    expect(resolution.pairs[0]?.comparisonCheckpointId).toBe("c1");
    expect(resolution.baselineOnly.map((row) => row.checkpointId)).toEqual(["b2"]);
    expect(resolution.comparisonOnly.map((row) => row.checkpointId)).toEqual(["c3"]);
  });

  it("allows local resolve when all checkpoints are loaded", () => {
    const checkpoints = [cp("1", "Kitchen", "2026-06-09T10:00:00.000Z")];
    expect(
      canResolveReportPreviewLocally(checkpoints, {
        loading: false,
        hasMoreCheckpoints: false,
        mode: "snapshot",
        snapshotRange: { start: "2026-06-09", end: "2026-06-09" },
      })
    ).toBe(true);
  });

  it("blocks local resolve when paginated history may be missing", () => {
    const checkpoints = [cp("1", "Kitchen", "2026-06-09T10:00:00.000Z")];
    expect(
      canResolveReportPreviewLocally(checkpoints, {
        loading: false,
        hasMoreCheckpoints: true,
        mode: "comparison",
        comparisonRanges: {
          baselineStart: "2026-01-01",
          baselineEnd: "2026-01-31",
          comparisonStart: "2026-06-01",
          comparisonEnd: "2026-06-30",
        },
      })
    ).toBe(false);
  });
});
