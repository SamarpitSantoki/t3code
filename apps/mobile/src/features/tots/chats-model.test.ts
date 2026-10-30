import { describe, expect, it } from "vite-plus/test";

import type { BotStatus } from "../bots/bot-status-model";
import type { Bot, BotTeam } from "../bots/bots-model";
import { arrangeChatRows, buildChatRows, chatPreviewLine, type ChatShell } from "./chats-model";

function bot(id: string, threads: ReadonlyArray<string> = []): Bot {
  return {
    id,
    name: id.toUpperCase(),
    role: "",
    environmentId: "env",
    threadId: `${id}-main`,
    setupMessageId: "setup",
    createdAt: "2026-10-01T00:00:00.000Z",
    threads: threads.map((threadId) => ({
      threadId,
      title: `Task ${threadId}`,
      setupMessageId: "setup",
      createdAt: "2026-10-01T00:00:00.000Z",
    })),
  };
}

function shell(
  id: string,
  updatedAt: string,
  options: {
    readonly approval?: boolean;
    readonly text?: string;
    readonly fromUser?: boolean;
    readonly pinOrderKey?: string;
    readonly settled?: boolean;
  } = {},
): ChatShell {
  return {
    environmentId: "env",
    id,
    updatedAt,
    hasPendingApprovals: options.approval ?? false,
    hasPendingUserInput: false,
    runtime: null,
    pinnedAt: options.pinOrderKey ? updatedAt : null,
    pinOrderKey: options.pinOrderKey ?? null,
    settledOverride: options.settled ? "settled" : null,
    source: {
      latestVisibleMessage: options.text
        ? {
            role: options.fromUser ? ("user" as const) : ("assistant" as const),
            text: options.text,
            updatedAt,
          }
        : null,
    },
  };
}

const team: BotTeam = {
  id: "crew",
  name: "Crew",
  environmentId: "env",
  leadBotId: "nova",
  memberBotIds: ["rex", "nova"],
  briefMessageIds: [],
  createdAt: "2026-10-01T00:00:00.000Z",
};

describe("buildChatRows", () => {
  it("lists main chats, side threads and teams by latest activity", () => {
    const rows = buildChatRows({
      bots: [bot("rex", ["fix"]), bot("nova")],
      teams: [team],
      shells: [
        shell("rex-main", "2026-10-28T09:00:00.000Z"),
        shell("fix", "2026-10-28T10:00:00.000Z"),
        shell("nova-main", "2026-10-28T08:00:00.000Z"),
      ],
    });
    expect(rows.map((row) => row.key)).toEqual([
      "thread:rex:fix",
      "bot:rex",
      "bot:nova",
      "team:crew",
    ]);
    expect(rows[0]?.title).toBe("Task fix");
    expect(rows[0]?.kind === "thread" ? rows[0].subtitle : null).toBe("with REX");
  });

  it("puts rows without a time last, in registry order", () => {
    const rows = buildChatRows({
      bots: [bot("rex"), bot("nova"), bot("ivy")],
      teams: [],
      shells: [shell("ivy-main", "2026-10-28T09:00:00.000Z")],
    });
    expect(rows.map((row) => row.key)).toEqual(["bot:ivy", "bot:rex", "bot:nova"]);
  });

  it("gives a team its lead's status and a deduplicated roster", () => {
    const rows = buildChatRows({
      bots: [bot("rex"), bot("nova")],
      teams: [team],
      shells: [shell("nova-main", "2026-10-28T09:00:00.000Z", { approval: true })],
    });
    const teamRow = rows.find((row) => row.kind === "team");
    expect(teamRow?.status.kind).toBe("needs_you");
    expect(teamRow?.kind === "team" ? teamRow.roster.map((member) => member.id) : []).toEqual([
      "nova",
      "rex",
    ]);
  });

  it("keeps a team whose lead was removed", () => {
    const rows = buildChatRows({ bots: [], teams: [team], shells: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind === "team" ? rows[0].lead : "missing").toBeNull();
  });
  it("lists server bots that are not saved yet", () => {
    const rows = buildChatRows({
      bots: [],
      teams: [],
      shells: [shell("srv", "2026-10-28T09:00:00.000Z", { text: "Hi" })],
      serverBots: [
        {
          name: "Ivy",
          role: "Writes",
          setupMessageId: "setup",
          environmentId: "env",
          threadId: "srv",
          createdAt: "2026-10-01T00:00:00.000Z",
          status: status({ updatedAt: "2026-10-28T09:00:00.000Z" }),
        } as never,
      ],
    });
    expect(rows.map((row) => [row.kind, row.title, row.unread])).toEqual([["server", "Ivy", true]]);
  });

  it("marks rows unread until opened after the bot spoke, except muted ones", () => {
    const shells = [
      shell("rex-main", "2026-10-28T09:00:00.000Z", { text: "Done" }),
      shell("nova-main", "2026-10-28T09:00:00.000Z", { text: "Done" }),
      shell("ivy-main", "2026-10-28T09:00:00.000Z", { text: "Go", fromUser: true }),
    ];
    const rows = buildChatRows({
      bots: [bot("rex"), bot("nova"), bot("ivy")],
      teams: [],
      shells,
      reads: { "env:rex-main": "2026-10-28T08:00:00.000Z" },
      muted: ["env:nova-main"],
    });
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
    expect(byKey["bot:rex"]?.unread).toBe(true);
    expect(byKey["bot:nova"]).toMatchObject({ unread: false, muted: true });
    expect(byKey["bot:ivy"]?.unread).toBe(false);
  });

  it("hides archived threads and the server's archive list", () => {
    const rows = buildChatRows({
      bots: [bot("rex", ["fix"])],
      teams: [],
      shells: [shell("rex-main", "2026-10-28T09:00:00.000Z")],
      archivedKeys: new Set(["env:fix"]),
    });
    expect(rows.find((row) => row.kind === "thread")?.hidden).toBe(true);
    expect(rows.find((row) => row.kind === "bot")?.hidden).toBe(false);
  });
});

describe("arrangeChatRows", () => {
  const rows = buildChatRows({
    bots: [bot("rex"), bot("nova"), bot("ivy"), bot("max")],
    teams: [],
    shells: [
      shell("rex-main", "2026-10-28T10:00:00.000Z", { text: "Shipped the **fix**" }),
      shell("nova-main", "2026-10-28T09:00:00.000Z", { pinOrderKey: "b" }),
      shell("ivy-main", "2026-10-28T08:00:00.000Z", { pinOrderKey: "a" }),
      shell("max-main", "2026-10-28T11:00:00.000Z", { settled: true }),
    ],
  });

  it("puts pinned chats on top in pin order, and settled ones apart", () => {
    const arranged = arrangeChatRows(rows);
    expect(arranged.main.map((row) => row.key)).toEqual(["bot:ivy", "bot:nova", "bot:rex"]);
    expect(arranged.settled.map((row) => row.key)).toEqual(["bot:max"]);
    expect(arranged.hidden).toEqual([]);
  });

  it("searches titles, bot names and clean previews", () => {
    expect(arrangeChatRows(rows, "shipped fix").main.map((row) => row.key)).toEqual(["bot:rex"]);
    expect(arrangeChatRows(rows, "  MAX ").settled.map((row) => row.key)).toEqual(["bot:max"]);
    expect(arrangeChatRows(rows, "nobody").main).toEqual([]);
  });
});

function status(overrides: Partial<BotStatus>): BotStatus {
  return {
    kind: "idle",
    label: "Ready",
    preview: null,
    previewFromBot: true,
    updatedAt: null,
    ...overrides,
  };
}

describe("chatPreviewLine", () => {
  const names = { bot: "Rex" };
  const said = (text: string, role = "assistant") => ({ role, text });

  it("prefixes the user's own last message", () => {
    expect(chatPreviewLine(status({}), said("Ship it", "user"), names)).toEqual({
      tone: "muted",
      text: "You: Ship it",
      botTalk: false,
    });
  });

  it("shows the bot's line plain, or with the speaker for teams", () => {
    expect(chatPreviewLine(status({}), said("Done"), names).text).toBe("Done");
    expect(chatPreviewLine(status({}), said("Done"), { bot: "Nova", speaker: "Nova" }).text).toBe(
      "Nova: Done",
    );
  });

  it("strips markdown to one line", () => {
    expect(chatPreviewLine(status({}), said("# Done\n- **all** `tests`"), names).text).toBe(
      "Done all tests",
    );
  });

  it("shows bot talk with who spoke to whom", () => {
    expect(
      chatPreviewLine(
        status({}),
        said("From Nova (thread t-1):\nCan you **review**?", "user"),
        names,
      ),
    ).toEqual({ tone: "talk", text: "Nova → Rex: Can you review?", botTalk: true });
  });

  it("flags rows that wait for the user in amber", () => {
    expect(chatPreviewLine(status({ kind: "needs_you" }), said("Run tests?"), names)).toEqual({
      tone: "amber",
      text: "Waiting for you",
      botTalk: false,
    });
  });

  it("shows working rows in blue", () => {
    expect(chatPreviewLine(status({ kind: "working" }), said("Reading"), names).tone).toBe("blue");
    expect(chatPreviewLine(status({ kind: "working" }), null, names).text).toBe("Working");
  });
});
