import { describe, expect, it } from "vite-plus/test";

import type { BotStatus, BotStatusKind } from "../bots/bot-status-model";
import type { BotActivity } from "./bot-activity-model";
import {
  approvalAction,
  botLiveLine,
  chatTarget,
  firstLine,
  rosterSummary,
  rowTime,
} from "./home-model";

function status(kind: BotStatusKind, preview: string | null = null): BotStatus {
  return { kind, label: kind, preview, previewFromBot: true, updatedAt: null };
}

function activity(kind: BotStatusKind, threadId = "main"): BotActivity {
  return { status: status(kind), threadId, busyThreads: 0 };
}

describe("rosterSummary", () => {
  it("counts working bots and bots that need the user", () => {
    expect(
      rosterSummary(4, [
        activity("working"),
        activity("working"),
        activity("needs_you"),
        undefined,
      ]),
    ).toBe("4 bots · 2 working · 1 needs you");
  });

  it("leaves out zero counts and uses the singular", () => {
    expect(rosterSummary(1, [activity("idle")])).toBe("1 bot");
  });
});

describe("botLiveLine", () => {
  it("shows what a working bot is doing in blue", () => {
    expect(botLiveLine(status("working", "reading sources"), 1, "role")).toEqual({
      tone: "blue",
      text: "Working · reading sources",
    });
  });

  it("adds the thread count when more than one thread is busy", () => {
    expect(botLiveLine(status("needs_you", "run tests"), 3, "role")).toEqual({
      tone: "amber",
      text: "Waiting for you · run tests · 3 threads",
    });
  });

  it("shows errors in red without the preview", () => {
    expect(botLiveLine(status("error", "boom"), 0, "role")).toEqual({
      tone: "red",
      text: "Hit an error",
    });
  });

  it("falls back when an idle bot has no messages", () => {
    expect(botLiveLine(status("idle"), 0, "Finds answers")).toEqual({
      tone: "muted",
      text: "Finds answers",
    });
  });
});

describe("rowTime", () => {
  it("reads now while working and nothing without a time", () => {
    expect(rowTime(status("working"))).toBe("now");
    expect(rowTime(status("idle"))).toBe("");
  });
});

describe("approvalAction", () => {
  it("names the app when there is one", () => {
    expect(approvalAction({ requestKind: "command", appName: "Linear" })).toBe(
      "wants to use Linear",
    );
    expect(approvalAction({ requestKind: "command" })).toBe("wants to run a command");
  });
});

describe("firstLine", () => {
  it("returns the first non-empty line", () => {
    expect(firstLine("\n  pnpm test --filter api \nmore")).toBe("pnpm test --filter api");
    expect(firstLine(undefined)).toBeNull();
  });
});

describe("chatTarget", () => {
  const bot = { id: "rex", threadId: "main" };

  it("opens a side thread that needs the user", () => {
    expect(chatTarget(bot, activity("needs_you", "side"))).toEqual({
      botId: "rex",
      threadId: "side",
    });
  });

  it("opens the main chat otherwise", () => {
    expect(chatTarget(bot, activity("working", "side"))).toEqual({ botId: "rex" });
    expect(chatTarget(bot, undefined)).toEqual({ botId: "rex" });
  });
});
