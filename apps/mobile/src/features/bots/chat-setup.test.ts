import { describe, expect, it } from "vite-plus/test";

import type { ServerSummary } from "../tots/server-model";
import type { Bot, BotRegistry } from "./bots-model";
import { canMoveBot, replaceBotSetup, restartProjects } from "./chat-setup";

const bot: Bot = {
  id: "b1",
  name: "Nova",
  role: "Reviews PRs",
  environmentId: "old-env",
  threadId: "main-1",
  setupMessageId: "m1",
  createdAt: "2026-10-28T10:00:00.000Z",
};

const registry = (bots: ReadonlyArray<Bot>, teams: BotRegistry["teams"] = []): BotRegistry => ({
  bots,
  teams,
});

const next = {
  environmentId: "new-env",
  threadId: "main-2",
  setupMessageId: "m2",
  createdAt: "2026-10-28T11:00:00.000Z",
};

describe("replaceBotSetup", () => {
  it("moves the main chat to the new server and thread", () => {
    const result = replaceBotSetup(registry([bot]), "b1", "main-1", next);
    expect(result.bots[0]).toEqual({
      ...bot,
      environmentId: "new-env",
      threadId: "main-2",
      setupMessageId: "m2",
    });
  });

  it("replaces only the matching side thread and keeps the bot's server", () => {
    const side = { threadId: "side-1", title: "Fix CI", setupMessageId: "s1", createdAt: "x" };
    const other = { threadId: "side-9", title: "Other", setupMessageId: "s9", createdAt: "y" };
    const result = replaceBotSetup(
      registry([{ ...bot, threads: [side, other] }]),
      "b1",
      "side-1",
      next,
    );
    expect(result.bots[0]?.environmentId).toBe("old-env");
    expect(result.bots[0]?.threadId).toBe("main-1");
    expect(result.bots[0]?.threads).toEqual([
      { threadId: "main-2", title: "Fix CI", setupMessageId: "m2", createdAt: next.createdAt },
      other,
    ]);
  });

  it("leaves other bots alone", () => {
    const other = { ...bot, id: "b2" };
    expect(replaceBotSetup(registry([bot, other]), "b1", "main-1", next).bots[1]).toBe(other);
  });
});

describe("canMoveBot", () => {
  it("allows a lone bot", () => {
    expect(canMoveBot(registry([bot]), bot)).toBe(true);
  });

  it("keeps bots with side threads or teams on their server", () => {
    const withThread = {
      ...bot,
      threads: [{ threadId: "t", title: "t", setupMessageId: "s", createdAt: "c" }],
    };
    expect(canMoveBot(registry([withThread]), withThread)).toBe(false);
    const team = {
      id: "t1",
      name: "Crew",
      environmentId: "old-env",
      leadBotId: "b9",
      memberBotIds: ["b1"],
      briefMessageIds: [],
      createdAt: "c",
    };
    expect(canMoveBot(registry([bot], [team]), bot)).toBe(false);
  });
});

describe("restartProjects", () => {
  const server = (environmentId: string, connected: boolean): ServerSummary => ({
    environmentId,
    environmentLabel: environmentId,
    displayUrl: "",
    isEnabled: true,
    connectionState: connected ? "connected" : "offline",
    connectionError: null,
  });

  it("lists projects on connected servers, skipping the excluded one", () => {
    const projects = [
      { environmentId: "a", id: "p1" },
      { environmentId: "b", id: "p2" },
      { environmentId: "c", id: "p3" },
    ];
    const servers = [server("a", true), server("b", true), server("c", false)];
    expect(restartProjects({ projects, servers }).map((project) => project.id)).toEqual([
      "p1",
      "p2",
    ]);
    expect(
      restartProjects({ projects, servers, excludeEnvironmentId: "a" }).map(
        (project) => project.id,
      ),
    ).toEqual(["p2"]);
  });
});
