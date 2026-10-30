import { describe, expect, it } from "vite-plus/test";

import type { TeamTimelineEntry } from "./bots-model";
import { mergePendingMessages, type PendingChatMessage } from "./chat-pending";

function userEntry(id: string, text: string, createdAt: string): TeamTimelineEntry {
  return {
    id,
    kind: "user",
    from: "You",
    to: "Coder",
    botId: "coder",
    text,
    createdAt,
    streaming: false,
  };
}

function pending(id: string, text: string, createdAt: string): PendingChatMessage {
  return { id, botId: "coder", botName: "Coder", text, createdAt };
}

describe("mergePendingMessages", () => {
  it("shows a sent message until the server echoes it", () => {
    const sent = pending("p1", "fix login", "2026-10-27T10:00:00.000Z");
    expect(
      mergePendingMessages([], [sent]).map((entry) => [entry.id, entry.pending]),
    ).toStrictEqual([["pending:p1", true]]);
    expect(
      mergePendingMessages([userEntry("m1", " fix login ", "2026-10-27T09:59:30.000Z")], [sent]),
    ).toStrictEqual([userEntry("m1", " fix login ", "2026-10-27T09:59:30.000Z")]);
  });

  it("lets each echo clear only one copy of a repeated message", () => {
    const merged = mergePendingMessages(
      [userEntry("m1", "again", "2026-10-27T10:00:01.000Z")],
      [
        pending("p1", "again", "2026-10-27T10:00:00.000Z"),
        pending("p2", "again", "2026-10-27T10:00:05.000Z"),
      ],
    );
    expect(merged.map((entry) => entry.id)).toStrictEqual(["m1", "pending:p2"]);
  });

  it("ignores an older message with the same text", () => {
    const merged = mergePendingMessages(
      [userEntry("old", "ok", "2026-10-27T08:00:00.000Z")],
      [pending("p1", "ok", "2026-10-27T10:00:00.000Z")],
    );
    expect(merged.map((entry) => entry.id)).toStrictEqual(["old", "pending:p1"]);
  });

  it("does not take an agent message as the echo of a sent one", () => {
    const agent: TeamTimelineEntry = {
      ...userEntry("m1", "ok", "2026-10-27T10:00:01.000Z"),
      kind: "agent",
      from: "Nova",
    };
    const merged = mergePendingMessages([agent], [pending("p1", "ok", "2026-10-27T10:00:00.000Z")]);
    expect(merged.map((entry) => [entry.id, entry.pending])).toStrictEqual([
      ["m1", undefined],
      ["pending:p1", true],
    ]);
  });
});
