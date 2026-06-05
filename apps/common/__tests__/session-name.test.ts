import {
  deriveSessionNameFromFirstMessage,
  formatSessionFallbackName,
  messageTextForSessionName,
} from "../src/lib/session-name";

describe("deriveSessionNameFromFirstMessage", () => {
  it("uses trimmed message text when long enough", () => {
    expect(
      deriveSessionNameFromFirstMessage("  Why is my roof leaking?  ")
    ).toBe("Why is my roof leaking?");
  });

  it("truncates long messages", () => {
    const long = "a".repeat(80);
    const name = deriveSessionNameFromFirstMessage(long, { maxLength: 20 });
    expect(name.endsWith("…")).toBe(true);
    expect(name.length).toBe(20);
  });

  it("falls back for short messages", () => {
    expect(deriveSessionNameFromFirstMessage("hi")).toBe(
      formatSessionFallbackName()
    );
  });
});

describe("messageTextForSessionName", () => {
  it("prefers contentMarkdown", () => {
    expect(
      messageTextForSessionName({
        content: "legacy",
        contentMarkdown: "markdown",
      })
    ).toBe("markdown");
  });
});
