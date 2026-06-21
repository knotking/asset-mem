import {
  buildAgentRequestContext,
  buildMessageContextRefs,
  canSendChatMessage,
  getRequiredContextEmptyPillLabel,
  getEmptyContextAddPillLabelFromCounts,
  getSendBlockReason,
} from "../src/lib/chat-send-context";
import { COMPOSER_ADD_REPORT_PILL, COMPOSER_ADD_CHECKPOINT_PILL, COMPOSER_ADD_DOCS_PILL, COMPOSER_ADD_ANALYSIS_PILL } from "../src/lib/chat-context-labels";
import type { Checkpoint, Document, PropertyReport } from "../src/types";

const readyReport = {
  id: "r1",
  title: "Q1 report",
  status: "ready",
} as PropertyReport;

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

  it("returns empty pill label for report mode without attachment", () => {
    expect(
      getRequiredContextEmptyPillLabel({
        primaryAgent: "report",
        readySelectedCheckpoints: [],
        readySelectedDocuments: [],
        readySelectedReports: [],
        pendingContext: [],
      })
    ).toBe(COMPOSER_ADD_REPORT_PILL);
  });

  it("returns empty pill label for checkpoint mode without attachment", () => {
    expect(
      getRequiredContextEmptyPillLabel({
        primaryAgent: "checkpoint",
        readySelectedCheckpoints: [],
        readySelectedDocuments: [],
        readySelectedReports: [],
        pendingContext: [],
      })
    ).toBe(COMPOSER_ADD_CHECKPOINT_PILL);
  });

  it("returns empty pill label for docs mode without attachment", () => {
    expect(
      getRequiredContextEmptyPillLabel({
        primaryAgent: "docs",
        readySelectedCheckpoints: [],
        readySelectedDocuments: [],
        readySelectedReports: [],
        pendingContext: [],
      })
    ).toBe(COMPOSER_ADD_DOCS_PILL);
  });

  it("returns empty pill label for analysis mode without attachment", () => {
    expect(
      getRequiredContextEmptyPillLabel({
        primaryAgent: "analysis",
        readySelectedCheckpoints: [],
        readySelectedDocuments: [],
        readySelectedReports: [],
        pendingContext: [],
      })
    ).toBe(COMPOSER_ADD_ANALYSIS_PILL);
  });

  it("omits empty pill label when report is selected", () => {
    expect(
      getRequiredContextEmptyPillLabel({
        primaryAgent: "report",
        readySelectedCheckpoints: [],
        readySelectedDocuments: [],
        readySelectedReports: [readyReport],
        pendingContext: [],
      })
    ).toBeNull();
  });

  it("matches empty pill label from attachment counts", () => {
    expect(
      getEmptyContextAddPillLabelFromCounts({
        primaryAgent: "checkpoint",
        readyContextCount: 0,
        pendingContextCount: 0,
      })
    ).toBe(COMPOSER_ADD_CHECKPOINT_PILL);
    expect(
      getEmptyContextAddPillLabelFromCounts({
        primaryAgent: "checkpoint",
        readyContextCount: 1,
        pendingContextCount: 0,
      })
    ).toBeNull();
  });

  it("omits empty pill label when pending context exists", () => {
    expect(
      getRequiredContextEmptyPillLabel({
        primaryAgent: "docs",
        readySelectedCheckpoints: [],
        readySelectedDocuments: [],
        readySelectedReports: [],
        pendingContext: [
          {
            kind: "document",
            id: "pending-doc-1",
            docId: "doc-pending-1",
            status: "indexing",
            label: "Indexing warranty",
          },
        ],
      })
    ).toBeNull();
  });

  it("returns docs empty pill label from counts", () => {
    expect(
      getEmptyContextAddPillLabelFromCounts({
        primaryAgent: "docs",
        readyContextCount: 0,
        pendingContextCount: 0,
      })
    ).toBe(COMPOSER_ADD_DOCS_PILL);
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
