import { describe, expect, it } from "vite-plus/test";

import { botAccessory } from "../tots/bot-face-model";
import { buildBotSetupMessage, buildBotThreadOpening, type BotRegistry } from "./bots-model";
import {
  firstUserMessage,
  serverBotCandidates,
  serverBotSetup,
  serverBotToBot,
} from "./server-bots-model";

function shell(id: string, overrides: Record<string, unknown> = {}) {
  return {
    environmentId: "env-1",
    id,
    createdAt: `2026-10-${id.padStart(2, "0")}T00:00:00.000Z`,
    archivedAt: null,
    lineage: { parentThreadId: null, relationshipToParent: null },
    ...overrides,
  };
}

const registry: BotRegistry = {
  teams: [],
  bots: [
    {
      id: "saved",
      name: "Rex",
      role: "Code.",
      environmentId: "env-1",
      threadId: "1",
      setupMessageId: "m1",
      createdAt: "2026-10-01T00:00:00.000Z",
      threads: [{ threadId: "2", title: "Side", setupMessageId: "m2", createdAt: "" }],
    },
  ],
};

describe("serverBotCandidates", () => {
  it("keeps newest top-level threads no saved bot owns", () => {
    const candidates = serverBotCandidates(
      [
        shell("1"),
        shell("2"),
        shell("3"),
        shell("4", { archivedAt: "2026-10-05T00:00:00.000Z" }),
        shell("5", { lineage: { parentThreadId: "3", relationshipToParent: "subagent" } }),
        shell("6", { environmentId: "env-2", id: "1" }),
        shell("7"),
      ],
      registry,
    );
    expect(candidates.map((candidate) => `${candidate.environmentId}:${candidate.id}`)).toEqual([
      "env-1:7",
      "env-2:1",
      "env-1:3",
    ]);
  });

  it("caps the number of threads", () => {
    expect(serverBotCandidates([shell("3"), shell("4"), shell("5")], registry, 2)).toHaveLength(2);
  });
});

describe("serverBotSetup", () => {
  it("reads the bot from a first message", () => {
    const text = buildBotSetupMessage({ name: "Ada", role: "Research.", color: "#3B82F6" });
    expect(serverBotSetup({ id: "m9", text })).toStrictEqual({
      name: "Ada",
      role: "Research.",
      color: "#3B82F6",
      setupMessageId: "m9",
    });
  });

  it("skips plain threads and extra bot threads", () => {
    expect(serverBotSetup(null)).toBeNull();
    expect(serverBotSetup({ id: "m", text: "Fix the build" })).toBeNull();
    const opening = buildBotThreadOpening({
      name: "Ada",
      role: "Research.",
      mainThreadId: "t1",
      task: "Look",
    });
    expect(serverBotSetup({ id: "m", text: opening })).toBeNull();
  });
});

describe("firstUserMessage", () => {
  it("picks the earliest user message", () => {
    expect(
      firstUserMessage([
        { id: "b", role: "assistant", createdAt: "2026-10-01T00:00:00.000Z" },
        { id: "c", role: "user", createdAt: "2026-10-03T00:00:00.000Z" },
        { id: "a", role: "user", createdAt: "2026-10-02T00:00:00.000Z" },
      ])?.id,
    ).toBe("a");
    expect(firstUserMessage([])).toBeNull();
  });
});

describe("serverBotToBot", () => {
  const entry = {
    name: "Ada",
    role: "Research.",
    setupMessageId: "m9",
    environmentId: "env-1",
    threadId: "t9",
    createdAt: "2026-10-09T00:00:00.000Z",
  };

  it("uses the identity from the metadata", () => {
    const bot = serverBotToBot(
      { ...entry, emoji: "🔬", color: "#3B82F6", template: "researcher" },
      "id-1",
    );
    expect(bot).toMatchObject({ id: "id-1", emoji: "🔬", color: "#3B82F6", threadId: "t9" });
    expect(bot.accessory).toBe(botAccessory({ id: "researcher" }));
  });

  it("falls back to a stable identity", () => {
    const bot = serverBotToBot(entry, "id-1");
    expect(bot.emoji).toBeTruthy();
    expect(bot.color).toMatch(/^#/);
    expect(serverBotToBot(entry, "id-1")).toStrictEqual(bot);
  });
});
