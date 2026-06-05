import { splitMessageContextRefItems } from "../src/lib/chat-message-context-refs";

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
