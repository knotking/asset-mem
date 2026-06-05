import {
  canSelectMoreCheckpoints,
  capSelectedCheckpoints,
  filterCheckpointsBySearch,
  getRecentReadyCheckpoints,
  pickDefaultReadyCheckpoint,
  pickDefaultReadyDocument,
} from "../src/lib/chat-context-picker";
import type { Checkpoint, Document } from "../src/types";

const mkCp = (id: string, name: string, status: string): Checkpoint =>
  ({
    id,
    name,
    analysisStatus: status,
    createdAt: { toMillis: () => Number(id.replace(/\D/g, "") || 0) },
  }) as Checkpoint;

describe("chat-context-picker", () => {
  it("filters ready checkpoints by search", () => {
    const list = [
      mkCp("cp1", "Kitchen sink", "completed"),
      mkCp("cp2", "Garage door", "completed"),
      mkCp("cp3", "Kitchen floor", "processing"),
    ];
    expect(filterCheckpointsBySearch(list, "kitchen").map((c) => c.id)).toEqual(["cp1"]);
  });

  it("returns recent ready checkpoints only", () => {
    const list = Array.from({ length: 15 }, (_, i) =>
      mkCp(`cp${i}`, `Item ${i}`, "completed")
    );
    expect(getRecentReadyCheckpoints(list, 10)).toHaveLength(10);
  });

  it("enforces selection caps", () => {
    expect(canSelectMoreCheckpoints(4)).toBe(true);
    expect(canSelectMoreCheckpoints(5)).toBe(false);
    const capped = capSelectedCheckpoints(
      Array.from({ length: 8 }, (_, i) => mkCp(`cp${i}`, `x${i}`, "completed"))
    );
    expect(capped).toHaveLength(5);
  });

  it("picks one recent ready checkpoint and document by default", () => {
    const checkpoints = [
      mkCp("cp10", "Older", "completed"),
      mkCp("cp20", "Newest", "completed"),
      mkCp("cp30", "Pending", "processing"),
    ];
    expect(pickDefaultReadyCheckpoint(checkpoints, "checkpoint")?.id).toBe("cp20");
    expect(pickDefaultReadyCheckpoint(checkpoints, "docs")).toBeUndefined();

    const documents = [
      { id: "d1", name: "old.pdf", createdAt: { toMillis: () => 1 } },
      { id: "d2", name: "new.pdf", createdAt: { toMillis: () => 2 } },
    ] as Document[];
    expect(pickDefaultReadyDocument(documents)?.id).toBe("d2");
  });
});
