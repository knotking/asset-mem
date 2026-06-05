import {
  isDocumentReady,
  isDocumentExtractReady,
  isCheckpointReady,
} from "../src/lib/chat-context-readiness";
import type { Checkpoint, Document } from "../src/types";

describe("chat-context-readiness", () => {
  it("treats missing or null document status as ready (legacy)", () => {
    expect(isDocumentReady({ id: "d1", name: "old.pdf" } as Document)).toBe(true);
    expect(
      isDocumentReady({ id: "d2", name: "old2.pdf", status: undefined } as Document)
    ).toBe(true);
    expect(isDocumentExtractReady(null)).toBe(true);
    expect(isDocumentExtractReady(undefined)).toBe(true);
  });

  it("treats complete without ragIndexed as ready (legacy extract-only docs)", () => {
    expect(
      isDocumentReady({
        id: "d3",
        name: "legacy-complete.pdf",
        status: "complete",
      } as Document)
    ).toBe(true);
  });

  it("requires ragIndexed true for new pipeline, rejects explicit false", () => {
    expect(
      isDocumentReady({
        id: "d4",
        name: "new.pdf",
        status: "complete",
        ragIndexed: true,
      } as Document)
    ).toBe(true);
    expect(
      isDocumentReady({
        id: "d5",
        name: "indexing.pdf",
        status: "complete",
        ragIndexed: false,
      } as Document)
    ).toBe(false);
  });

  it("rejects in-flight or failed document status", () => {
    expect(
      isDocumentReady({ id: "d5", status: "analyzing" } as Document)
    ).toBe(false);
    expect(isDocumentReady({ id: "d6", status: "failed" } as Document)).toBe(false);
  });

  it("checkpoint ready only when analysis completed", () => {
    expect(
      isCheckpointReady({ id: "cp1", analysisStatus: "completed" } as Checkpoint)
    ).toBe(true);
    expect(
      isCheckpointReady({ id: "cp2", analysisStatus: "processing" } as Checkpoint)
    ).toBe(false);
  });
});
