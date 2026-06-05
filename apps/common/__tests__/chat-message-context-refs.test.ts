import {
  buildSuppressRepeatedContextRefsByMessageId,
  contextRefsFingerprint,
  getContextRefsSummaryLabel,
  splitMessageContextRefItems,
} from "../src/lib/chat-message-context-refs";

describe("splitMessageContextRefItems", () => {
  it("shows first two items and counts the rest", () => {
    const { visible, hiddenCount } = splitMessageContextRefItems({
      checkpoints: [
        { id: "cp1", name: "Kitchen" },
        { id: "cp2", name: "Roof" },
      ],
      documents: [{ id: "doc1", name: "warranty.pdf" }],
    });
    expect(visible).toHaveLength(2);
    expect(visible[0]?.name).toBe("Kitchen");
    expect(visible[1]?.name).toBe("Roof");
    expect(hiddenCount).toBe(1);
  });
});

describe("contextRefsFingerprint", () => {
  it("ignores item order and names", () => {
    const a = {
      checkpoints: [{ id: "cp2", name: "B" }, { id: "cp1", name: "A" }],
      documents: [{ id: "doc1", name: "warranty.pdf" }],
    };
    const b = {
      checkpoints: [{ id: "cp1", name: "Renamed" }, { id: "cp2", name: "Other" }],
      documents: [{ id: "doc1", name: "other.pdf" }],
    };
    expect(contextRefsFingerprint(a)).toBe(contextRefsFingerprint(b));
  });
});

describe("getContextRefsSummaryLabel", () => {
  it("summarizes multiple attachments", () => {
    expect(
      getContextRefsSummaryLabel({
        checkpoints: [{ id: "cp1", name: "Vehicle Exterior" }],
        documents: [{ id: "doc1", name: "car_insurance.pdf" }],
      })
    ).toBe("Vehicle Exterior +1 more");
  });
});

describe("buildSuppressRepeatedContextRefsByMessageId", () => {
  const refsA = {
    checkpoints: [{ id: "cp1", name: "Kitchen" }],
    documents: [],
  };

  it("suppresses consecutive duplicate user context", () => {
    const map = buildSuppressRepeatedContextRefsByMessageId([
      { id: "u1", role: "user", contextRefs: refsA },
      { id: "a1", role: "assistant" },
      { id: "u2", role: "user", contextRefs: refsA },
    ]);
    expect(map.get("u1")).toBe(false);
    expect(map.get("u2")).toBe(true);
  });

  it("resets after a user message without context", () => {
    const map = buildSuppressRepeatedContextRefsByMessageId([
      { id: "u1", role: "user", contextRefs: refsA },
      { id: "u2", role: "user" },
      { id: "u3", role: "user", contextRefs: refsA },
    ]);
    expect(map.get("u3")).toBe(false);
  });
});
