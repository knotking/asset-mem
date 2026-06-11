import { normalizeChatMarkdownSpacing } from "../src/lib/normalize-chat-markdown";

describe("normalizeChatMarkdownSpacing", () => {
  it("collapses triple newlines between paragraphs", () => {
    expect(normalizeChatMarkdownSpacing("Overview\n\n\n**Next**")).toBe(
      "Overview\n\n**Next**"
    );
  });

  it("tightens spacing around horizontal rules", () => {
    const input = [
      "**Overview**",
      "Summary text.",
      "",
      "",
      "---",
      "",
      "",
      "**Detailed Breakdown**",
    ].join("\n");
    expect(normalizeChatMarkdownSpacing(input)).toBe(
      ["**Overview**", "Summary text.", "", "---", "", "**Detailed Breakdown**"].join(
        "\n"
      )
    );
  });

  it("treats whitespace-only lines as blank lines", () => {
    expect(normalizeChatMarkdownSpacing("A\n   \nB")).toBe("A\n\nB");
  });

  it("preserves intentional single blank lines", () => {
    expect(normalizeChatMarkdownSpacing("A\n\nB")).toBe("A\n\nB");
  });
});
