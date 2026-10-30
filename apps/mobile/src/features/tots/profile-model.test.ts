import { describe, expect, it } from "vite-plus/test";

import type { Bot, BotRegistry } from "../bots/bots-model";
import { botNameTaken, buildRoleChangeMessage, updateBotProfile } from "./profile-model";

function bot(id: string, name: string): Bot {
  return {
    id,
    name,
    role: "Old role",
    environmentId: "env",
    threadId: `thread-${id}`,
    setupMessageId: `setup-${id}`,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

const registry: BotRegistry = { bots: [bot("a", "Nova"), bot("b", "Rex")], teams: [] };

describe("updateBotProfile", () => {
  it("changes only the chosen bot and trims text", () => {
    const next = updateBotProfile(registry, "a", {
      name: " Ora ",
      role: " Chief of staff ",
      color: "#F97316",
      accessory: "ears",
    });
    expect(next.bots[0]).toMatchObject({
      name: "Ora",
      role: "Chief of staff",
      color: "#F97316",
      accessory: "ears",
      threadId: "thread-a",
    });
    expect(next.bots[1]).toBe(registry.bots[1]);
  });
});

describe("botNameTaken", () => {
  it("ignores case and the bot being edited", () => {
    expect(botNameTaken(registry, " rex ")).toBe(true);
    expect(botNameTaken(registry, "Nova", "a")).toBe(false);
    expect(botNameTaken(registry, "Ivy")).toBe(false);
  });
});

describe("buildRoleChangeMessage", () => {
  it("mentions a new name only when it changed", () => {
    expect(buildRoleChangeMessage({ previousName: "Ora", name: "Ora", role: "Plan" })).toMatch(
      /^Your job has changed\./,
    );
    const renamed = buildRoleChangeMessage({ previousName: "Nova", name: "Ora", role: "Plan" });
    expect(renamed).toMatch(/^Your name is now Ora/);
    expect(renamed).toContain("Your new role:\nPlan");
  });
});
