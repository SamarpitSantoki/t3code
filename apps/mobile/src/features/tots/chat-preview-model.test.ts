import { describe, expect, it } from "vite-plus/test";

import { cleanPreviewText } from "./chat-preview-model";

describe("cleanPreviewText", () => {
  it("removes emphasis and heading marks", () => {
    expect(cleanPreviewText("## Plan\n**Ship** it _today_, *please*")).toBe(
      "Plan Ship it today, please",
    );
  });

  it("keeps link and image text only", () => {
    expect(cleanPreviewText("See [the docs](https://x.dev) and ![chart](a.png)")).toBe(
      "See the docs and chart",
    );
  });

  it("unwraps inline and fenced code", () => {
    expect(cleanPreviewText("Run `vp test`:\n```bash\nvp test run\n```\nDone")).toBe(
      "Run vp test: vp test run Done",
    );
  });

  it("drops list bullets, task boxes, quotes and rules", () => {
    expect(cleanPreviewText("> quoted\n- one\n* [x] two\n1. three\n---")).toBe(
      "quoted one two three",
    );
  });

  it("keeps snake_case words and lone stars", () => {
    expect(cleanPreviewText("set max_retry_count to 2 * 3")).toBe("set max_retry_count to 2 * 3");
  });

  it("collapses whitespace to one line and caps the length", () => {
    expect(cleanPreviewText("  a \n\n\t b  ")).toBe("a b");
    const long = cleanPreviewText("word ".repeat(100));
    expect(long.length).toBeLessThanOrEqual(240);
    expect(long.endsWith("...")).toBe(true);
  });
});
