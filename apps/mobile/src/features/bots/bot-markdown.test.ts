import { describe, expect, it } from "vite-plus/test";

import { parseChatMarkdown, parseInline } from "./bot-markdown";

describe("parseChatMarkdown", () => {
  it("splits headings, lists, code fences and paragraphs", () => {
    expect(
      parseChatMarkdown(
        [
          "## Plan",
          "First line",
          "continues here.",
          "",
          "- fix **login**",
          "2) ship",
          "```ts",
          "const a = 1;",
          "```",
        ].join("\n"),
      ),
    ).toStrictEqual([
      { kind: "heading", spans: [{ kind: "text", text: "Plan" }] },
      { kind: "paragraph", spans: [{ kind: "text", text: "First line continues here." }] },
      {
        kind: "bullet",
        marker: "•",
        spans: [
          { kind: "text", text: "fix " },
          { kind: "bold", text: "login" },
        ],
      },
      { kind: "bullet", marker: "2.", spans: [{ kind: "text", text: "ship" }] },
      { kind: "code", text: "const a = 1;" },
    ]);
  });

  it("keeps an unclosed fence as code to the end", () => {
    expect(parseChatMarkdown("```\nstill typing")).toStrictEqual([
      { kind: "code", text: "still typing" },
    ]);
  });
});

describe("parseInline", () => {
  it("marks inline code and leaves lone markers as text", () => {
    expect(parseInline("run `vp test` * now")).toStrictEqual([
      { kind: "text", text: "run " },
      { kind: "code", text: "vp test" },
      { kind: "text", text: " * now" },
    ]);
  });
});
