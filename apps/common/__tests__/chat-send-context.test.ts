import {
  buildAgentRequestContext,
  buildMessageContextRefs,
  canSendChatMessage,
  getSendBlockReason,
} from "../src/lib/chat-send-context";
import type { Checkpoint, Document } from "../src/types";

const readyCheckpoint = {
  id: "cp1",
  name: "Kitchen",
  analysisStatus: "completed",
  media: [{ url: "https://example.com/a.jpg", gsURI: "gs://b/a.jpg", contentType: "image/jpeg" }],
} as Checkpoint;

const pendingCheckpoint = {
  id: "cp2",
  analysisStatus: "processing",
} as Checkpoint;

const readyDoc = {
  id: "doc1",
  name: "warranty.pdf",
  gsURI: "gs://b/doc.pdf",
  status: "complete",
  ragIndexed: true,
} as Document;

describe("chat-send-context", () => {
  it("builds checkpoint ids only in checkpoint mode", () => {
    const cp = buildAgentRequestContext({
      primaryAgent: "checkpoint",
      readySelectedCheckpoints: [readyCheckpoint],
      readySelectedDocuments: [readyDoc],
      readySelectedReports: [],
    });
    expect(cp.checkpointIds).toEqual(["cp1"]);
    expect(cp.contextDocURIs).toEqual(["gs://b/doc.pdf"]);
  });

  it("omits checkpoint ids in docs mode", () => {
    const cp = buildAgentRequestContext({
      primaryAgent: "docs",
      readySelectedCheckpoints: [readyCheckpoint],
      readySelectedDocuments: [readyDoc],
      readySelectedReports: [],
    });
    expect(cp.checkpointIds).toEqual([]);
  });

  it("blocks send without text", () => {
    expect(
      getSendBlockReason({
        primaryAgent: "checkpoint",
        text: "",
        readySelectedCheckpoints: [readyCheckpoint],
        readySelectedDocuments: [],
        readySelectedReports: [],
        pendingContext: [],
      })
    ).toBe("Enter a message.");
  });

  it("allows send without ready context", () => {
    expect(
      canSendChatMessage({
        primaryAgent: "checkpoint",
        text: "hello",
        readySelectedCheckpoints: [],
        readySelectedDocuments: [],
        readySelectedReports: [],
        pendingContext: [],
      })
    ).toBe(true);
  });

  it("blocks send when checkpoint not ready", () => {
    expect(
      canSendChatMessage({
        primaryAgent: "checkpoint",
        text: "hello",
        readySelectedCheckpoints: [pendingCheckpoint],
        readySelectedDocuments: [],
        readySelectedReports: [],
        pendingContext: [],
      })
    ).toBe(false);
  });

  it("blocks send when pending context exists", () => {
    expect(
      canSendChatMessage({
        primaryAgent: "checkpoint",
        text: "hello",
        readySelectedCheckpoints: [],
        readySelectedDocuments: [],
        readySelectedReports: [],
        pendingContext: [
          {
            kind: "checkpoint",
            id: "pending-1",
            checkpointId: "cp3",
            status: "processing",
            label: "New capture",
          },
        ],
      })
    ).toBe(false);
  });

  it("builds message context refs with ids and names only", () => {
    const refs = buildMessageContextRefs({
      readySelectedCheckpoints: [readyCheckpoint],
      readySelectedDocuments: [readyDoc],
      readySelectedReports: [],
    });
    expect(refs.checkpoints?.[0]).toEqual({ id: "cp1", name: "Kitchen" });
    expect(refs.documents?.[0]).toEqual({ id: "doc1", name: "warranty.pdf" });
  });
});
