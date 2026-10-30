import { describe, expect, it } from "vite-plus/test";

import type { BotStatus, BotStatusKind } from "../bots/bot-status-model";
import { summarizeBotActivity } from "./bot-activity-model";

function status(kind: BotStatusKind, updatedAt: string | null = null): BotStatus {
  return { kind, label: kind, preview: null, previewFromBot: false, updatedAt };
}

describe("summarizeBotActivity", () => {
  it("surfaces a side thread that needs the user over a working main chat", () => {
    const summary = summarizeBotActivity([
      { threadId: "main", status: status("working", "2026-10-28T10:00:00.000Z") },
      { threadId: "side", status: status("needs_you", "2026-10-28T09:00:00.000Z") },
    ]);
    expect(summary).toMatchObject({
      threadId: "side",
      busyThreads: 2,
      status: { kind: "needs_you", updatedAt: "2026-10-28T10:00:00.000Z" },
    });
  });

  it("keeps the main chat when every thread is idle", () => {
    expect(
      summarizeBotActivity([
        { threadId: "main", status: status("idle") },
        { threadId: "side", status: status("idle") },
      ])?.threadId,
    ).toBe("main");
  });
});
