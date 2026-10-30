import { describe, expect, it } from "vite-plus/test";

import type { TeamTimelineEntry } from "./bots-model";
import { groupHandoffs, handoffLabel, handoffRecipients, taskPreview } from "./chat-handoff-groups";
import type { TeamTimelineItem } from "./team-timeline-layout";

function entry(
  id: string,
  kind: TeamTimelineEntry["kind"],
  createdAt: string,
  extra: Partial<TeamTimelineEntry> = {},
): TeamTimelineItem {
  return {
    kind: "entry",
    id,
    grouped: false,
    entry: {
      id,
      kind,
      from: kind === "user" ? "You" : "Nova",
      to: kind === "bot" ? null : "Rex",
      botId: "rex",
      text: "Build the page",
      createdAt,
      streaming: false,
      ...extra,
    },
  };
}

describe("groupHandoffs", () => {
  it("folds handoffs from one sender within a minute", () => {
    const items = groupHandoffs([
      entry("a", "bot", "2026-10-27T09:36:00Z"),
      entry("b", "handoff", "2026-10-27T09:36:10Z", { to: "Rex" }),
      entry("c", "handoff", "2026-10-27T09:36:40Z", { to: "Ivy", botId: "ivy" }),
    ]);
    expect(items.map((item) => item.kind)).toEqual(["entry", "handoffs"]);
    const group = items[1];
    expect(group?.kind === "handoffs" && group.entries.map((item) => item.id)).toEqual(["b", "c"]);
    expect(group?.id).toBe("handoffs:b");
  });

  it("starts a new group after a minute, a new sender or another row", () => {
    const items = groupHandoffs([
      entry("a", "handoff", "2026-10-27T09:36:00Z"),
      entry("b", "handoff", "2026-10-27T09:37:30Z"),
      entry("c", "handoff", "2026-10-27T09:37:40Z", { from: "Ivy" }),
      entry("d", "bot", "2026-10-27T09:37:45Z"),
      entry("e", "handoff", "2026-10-27T09:37:50Z", { from: "Ivy" }),
    ]);
    expect(
      items.map((item) => (item.kind === "handoffs" ? item.entries.length : item.kind)),
    ).toEqual([1, 1, 1, "entry", 1]);
  });

  it("leaves agent messages as their own rows", () => {
    const items = groupHandoffs([
      entry("a", "handoff", "2026-10-27T09:36:00Z"),
      entry("b", "agent", "2026-10-27T09:36:10Z"),
      entry("c", "handoff", "2026-10-27T09:36:20Z"),
    ]);
    expect(
      items.map((item) => (item.kind === "handoffs" ? item.entries.length : item.kind)),
    ).toEqual([1, "entry", 1]);
  });

  it("keeps day separators and does not group invalid times", () => {
    const items = groupHandoffs([
      { kind: "day", id: "day:1", label: "Today" },
      entry("a", "handoff", "bad"),
      entry("b", "handoff", "bad"),
    ]);
    expect(items.map((item) => item.kind)).toEqual(["day", "handoffs", "handoffs"]);
  });
});

describe("handoff labels", () => {
  const rex = entry("a", "handoff", "2026-10-27T09:36:00Z", { to: "Rex" });
  const ivy = entry("b", "handoff", "2026-10-27T09:36:00Z", { to: "Ivy" });
  const rexAgain = entry("c", "handoff", "2026-10-27T09:36:00Z", { to: "Rex" });
  const entries = [rex, ivy, rexAgain].flatMap((item) =>
    item.kind === "entry" ? [item.entry] : [],
  );

  it("names each recipient once", () => {
    expect(handoffRecipients(entries)).toEqual(["Rex", "Ivy"]);
  });

  it("reads as a team event or a task for one bot", () => {
    expect(handoffLabel({ from: "Nova", entries }, true)).toBe("Nova messaged Rex and Ivy");
    expect(handoffLabel({ from: "Nova", entries: entries.slice(0, 1) }, false)).toBe(
      "Nova handed Rex a task",
    );
    expect(handoffLabel({ from: "Nova", entries: [entries[0]!, entries[2]!] }, false)).toBe(
      "Nova handed Rex 2 tasks",
    );
  });
});

describe("taskPreview", () => {
  it("returns the first non-empty line without markdown marks", () => {
    expect(taskPreview("\n## **Build** the page\nmore")).toBe("Build the page");
    expect(taskPreview("   ")).toBe("");
  });
});
