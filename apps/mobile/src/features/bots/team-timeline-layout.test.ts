import { describe, expect, it } from "vite-plus/test";

import type { TeamTimelineEntry } from "./bots-model";
import { formatDayLabel, joinNames, layoutTeamTimeline, withMention } from "./team-timeline-layout";

function entry(
  id: string,
  kind: TeamTimelineEntry["kind"],
  botId: string,
  createdAt: Date,
): TeamTimelineEntry {
  return {
    id,
    kind,
    from: kind === "user" ? "You" : botId,
    to: kind === "bot" ? null : botId,
    botId,
    text: id,
    createdAt: createdAt.toISOString(),
    streaming: false,
  };
}

const now = new Date(2026, 9, 27, 15, 0);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);

describe("formatDayLabel", () => {
  it("names today and yesterday", () => {
    expect(formatDayLabel(at(27, 1), now)).toBe("Today");
    expect(formatDayLabel(at(26, 23), now)).toBe("Yesterday");
  });

  it("uses a short date for older days", () => {
    const label = formatDayLabel(at(20, 9), now);
    expect(label).not.toBe("Today");
    expect(label).toContain("20");
  });

  it("handles yesterday across a month boundary", () => {
    expect(formatDayLabel(new Date(2026, 9, 31, 8), new Date(2026, 10, 1, 9))).toBe("Yesterday");
  });
});

describe("layoutTeamTimeline", () => {
  it("adds a separator for each new day", () => {
    const items = layoutTeamTimeline(
      [
        entry("a", "user", "lead", at(26, 10)),
        entry("b", "bot", "lead", at(26, 10, 1)),
        entry("c", "user", "lead", at(27, 9)),
      ],
      now,
    );
    expect(items.map((item) => (item.kind === "day" ? item.label : item.id))).toEqual([
      "Yesterday",
      "a",
      "b",
      "Today",
      "c",
    ]);
  });

  it("groups messages from the same bot within five minutes", () => {
    const items = layoutTeamTimeline(
      [
        entry("a", "bot", "coder", at(27, 10)),
        entry("b", "bot", "coder", at(27, 10, 4)),
        entry("c", "bot", "reviewer", at(27, 10, 5)),
        entry("d", "bot", "reviewer", at(27, 10, 20)),
        entry("e", "user", "lead", at(27, 10, 21)),
        entry("f", "user", "lead", at(27, 10, 22)),
      ],
      now,
    );
    const grouped = items.flatMap((item) => (item.kind === "entry" ? [item.grouped] : []));
    expect(grouped).toEqual([false, true, false, false, false, true]);
  });

  it("never groups handoffs", () => {
    const items = layoutTeamTimeline(
      [entry("a", "handoff", "coder", at(27, 10)), entry("b", "handoff", "coder", at(27, 10, 1))],
      now,
    );
    expect(items.flatMap((item) => (item.kind === "entry" ? [item.grouped] : []))).toEqual([
      false,
      false,
    ]);
  });
});

describe("layoutTeamTimeline agent messages", () => {
  it("never groups agent messages, and a user message after one starts fresh", () => {
    const items = layoutTeamTimeline(
      [
        entry("a", "agent", "coder", at(27, 10)),
        entry("b", "agent", "coder", at(27, 10, 1)),
        entry("c", "user", "coder", at(27, 10, 2)),
      ],
      now,
    );
    expect(items.flatMap((item) => (item.kind === "entry" ? [item.grouped] : []))).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe("joinNames", () => {
  it("joins names like a sentence", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["Coder"])).toBe("Coder");
    expect(joinNames(["Coder", "Reviewer"])).toBe("Coder and Reviewer");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("withMention", () => {
  const names = ["Lead", "Code", "Code Reviewer"];

  it("prefixes a draft with the mention", () => {
    expect(withMention("", "Code", names)).toBe("@Code ");
    expect(withMention("fix the tests", "Code", names)).toBe("@Code fix the tests");
  });

  it("replaces a leading mention of another member", () => {
    expect(withMention("@Lead fix it", "Code", names)).toBe("@Code fix it");
    expect(withMention("@code reviewer, check it", "Lead", names)).toBe("@Lead check it");
  });

  it("keeps a mention-like word that is not a member", () => {
    expect(withMention("@Coder go", "Lead", names)).toBe("@Lead @Coder go");
  });
});
