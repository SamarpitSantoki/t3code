import { describe, expect, it } from "vite-plus/test";

import { BOT_TEMPLATES, T3_MANAGER_THREAD_TITLE } from "./bot-identity";
import {
  addBot,
  addTeam,
  BOT_MEMORY_DIR,
  BOT_VOICE_LINES,
  buildBotSetupMessage,
  buildBotThreadOpening,
  buildTeamTimeline,
  EMPTY_BOT_REGISTRY,
  firstTaskFromOpening,
  isBotRegistry,
  parseBotSetupMessage,
  removeBot,
  resolveTeamMessageTarget,
  type Bot,
  type BotTeam,
} from "./bots-model";

function makeBot(id: string, name: string): Bot {
  return {
    id,
    name,
    role: `${name} role`,
    environmentId: "env-1",
    threadId: `thread-${id}`,
    setupMessageId: `setup-${id}`,
    createdAt: "2026-10-27T00:00:00.000Z",
  };
}

const lead = makeBot("lead", "Lead");
const coder = makeBot("coder", "Coder");
const codeReviewer = makeBot("reviewer", "Code Reviewer");

describe("resolveTeamMessageTarget", () => {
  it("sends plain messages to the lead", () => {
    expect(resolveTeamMessageTarget({ text: " Ship it ", lead, members: [coder] })).toStrictEqual({
      bot: lead,
      text: "Ship it",
    });
  });

  it("routes a leading mention to that teammate and strips it", () => {
    expect(
      resolveTeamMessageTarget({ text: "@coder: fix the build", lead, members: [coder] }),
    ).toStrictEqual({ bot: coder, text: "fix the build" });
  });

  it("prefers the longest matching name and needs a word boundary", () => {
    const code = makeBot("code", "Code");
    expect(
      resolveTeamMessageTarget({
        text: "@Code Reviewer look at #12",
        lead,
        members: [code, codeReviewer],
      }).bot,
    ).toBe(codeReviewer);
    expect(
      resolveTeamMessageTarget({ text: "@Coders unite", lead, members: [coder] }),
    ).toStrictEqual({ bot: lead, text: "@Coders unite" });
  });
});

describe("buildTeamTimeline", () => {
  it("merges threads by time, hides setup and briefs, and labels handoffs", () => {
    const timeline = buildTeamTimeline({
      hiddenMessageIds: ["brief-1"],
      sources: [
        {
          bot: lead,
          messages: [
            {
              id: "setup-lead",
              role: "user",
              text: "You are Lead",
              createdAt: "2026-10-27T10:00:00.000Z",
              streaming: false,
            },
            {
              id: "brief-1",
              role: "user",
              text: "Teammates: ...",
              createdAt: "2026-10-27T10:00:01.000Z",
              streaming: false,
            },
            {
              id: "m1",
              role: "user",
              text: "Fix login",
              createdAt: "2026-10-27T10:01:00.000Z",
              streaming: false,
            },
            {
              id: "m4",
              role: "assistant",
              text: "Coder fixed it.",
              createdAt: "2026-10-27T10:04:00.000Z",
              streaming: true,
            },
            {
              id: "m5",
              role: "assistant",
              text: "  ",
              createdAt: "2026-10-27T10:05:00.000Z",
              streaming: true,
            },
          ],
        },
        {
          bot: coder,
          messages: [
            {
              id: "m2",
              role: "user",
              text: "Please fix login",
              createdAt: "2026-10-27T10:02:00.000Z",
              streaming: false,
              senderThreadId: lead.threadId,
            },
            {
              id: "m3",
              role: "assistant",
              text: "Done",
              createdAt: "2026-10-27T10:03:00.000Z",
              streaming: false,
            },
          ],
        },
      ],
    });
    expect(timeline.map((entry) => [entry.kind, entry.from, entry.to, entry.text])).toStrictEqual([
      ["user", "You", "Lead", "Fix login"],
      ["handoff", "Lead", "Coder", "Please fix login"],
      ["bot", "Coder", null, "Done"],
      ["bot", "Lead", null, "Coder fixed it."],
    ]);
  });
});

describe("buildTeamTimeline senders", () => {
  it("names handoffs from bots outside the chat and marks unknown agents", () => {
    const timeline = buildTeamTimeline({
      hiddenMessageIds: [],
      senders: [lead],
      sources: [
        {
          bot: coder,
          messages: [
            {
              id: "a",
              role: "user",
              text: "From lead",
              createdAt: "2026-10-27T10:00:00.000Z",
              streaming: false,
              senderThreadId: lead.threadId,
            },
            {
              id: "b",
              role: "user",
              text: "From a scheduled task",
              createdAt: "2026-10-27T10:01:00.000Z",
              streaming: false,
              senderThreadId: "thread-unknown",
            },
          ],
        },
      ],
    });
    expect(timeline.map((entry) => [entry.kind, entry.from, entry.to])).toStrictEqual([
      ["handoff", "Lead", "Coder"],
      ["handoff", "Another agent", "Coder"],
    ]);
  });
});

describe("registry", () => {
  it("removing a bot drops the teams it led and its memberships elsewhere", () => {
    const team = (id: string, leadBotId: string, memberBotIds: string[]): BotTeam => ({
      id,
      name: id,
      environmentId: "env-1",
      leadBotId,
      memberBotIds,
      briefMessageIds: [],
      createdAt: "2026-10-27T00:00:00.000Z",
    });
    let registry = [lead, coder, codeReviewer].reduce(addBot, EMPTY_BOT_REGISTRY);
    registry = addTeam(registry, team("a", "coder", ["reviewer"]));
    registry = addTeam(registry, team("b", "lead", ["coder", "reviewer"]));

    const next = removeBot(registry, "coder");

    expect(next.bots.map((bot) => bot.id)).toStrictEqual(["lead", "reviewer"]);
    expect(next.teams).toStrictEqual([team("b", "lead", ["reviewer"])]);
    expect(isBotRegistry(next)).toBe(true);
  });
});

describe("T3 Manager", () => {
  it("has a template that renames its thread so agents can find it", () => {
    const template = BOT_TEMPLATES.find((candidate) => candidate.id === "t3-manager");
    expect(template?.name).toBe(T3_MANAGER_THREAD_TITLE);
    expect(template?.role).toContain(`rename this thread to "${T3_MANAGER_THREAD_TITLE}"`);
    expect(template?.role).toContain("t3_thread_send");
  });

  it("tells every bot to ask the T3 Manager about T3", () => {
    const message = buildBotSetupMessage({ name: "Rex", role: "Code things." });
    expect(message).toContain(`titleContains "${T3_MANAGER_THREAD_TITLE}"`);
    expect(message.split("\n").at(-1)).toBe(
      "Reply with one short sentence that confirms you are ready as Rex.",
    );
  });
});

describe("bot setup metadata", () => {
  const manager = BOT_TEMPLATES.find((candidate) => candidate.id === "t3-manager")!;

  it("puts one metadata line second and keeps the rest", () => {
    const lines = buildBotSetupMessage({
      name: manager.name,
      role: manager.role,
      emoji: manager.emoji,
      color: manager.color,
      template: manager.id,
    }).split("\n");
    expect(lines[0]).toBe("You are T3 Manager, a long-lived teammate in this thread.");
    expect(lines[1]).toBe(
      'Tots bot: {"v":1,"emoji":"🧭","color":"#06B6D4","template":"t3-manager"}',
    );
    expect(lines[2]).toBe("");
    expect(lines[3]).toBe("Your role:");
  });

  it("leaves out keys without a value", () => {
    const lines = buildBotSetupMessage({ name: "Rex", role: "Code things.", emoji: "" }).split(
      "\n",
    );
    expect(lines[1]).toBe('Tots bot: {"v":1}');
  });

  it("reads a setup message back", () => {
    const message = buildBotSetupMessage({
      name: manager.name,
      role: manager.role,
      emoji: manager.emoji,
      color: manager.color,
      template: manager.id,
    });
    expect(parseBotSetupMessage(message)).toStrictEqual({
      name: "T3 Manager",
      role: manager.role,
      emoji: "🧭",
      color: "#06B6D4",
      template: "t3-manager",
    });
  });

  it("reads setups from before the metadata line", () => {
    const old = [
      "You are Rex, a long-lived teammate in this thread.",
      "",
      "Your role:",
      "Code things.",
      "Test them too.",
      "",
      "Stay in this role for every later message.",
      "Reply with one short sentence that confirms you are ready as Rex.",
    ].join("\n");
    expect(parseBotSetupMessage(old)).toStrictEqual({
      name: "Rex",
      role: "Code things.\nTest them too.",
    });
  });

  it("ignores a metadata line that is not valid JSON", () => {
    const message = buildBotSetupMessage({ name: "Rex", role: "Code things.", color: "#fff" })
      .split("\n")
      .map((line, index) => (index === 1 ? "Tots bot: {nope" : line))
      .join("\n");
    expect(parseBotSetupMessage(message)).toStrictEqual({ name: "Rex", role: "Code things." });
  });

  it("returns null for the opening of a bot's extra thread", () => {
    expect(
      parseBotSetupMessage(
        buildBotThreadOpening({
          name: "Rex",
          role: "Code things.",
          mainThreadId: "t1",
          task: "Fix the build",
        }),
      ),
    ).toBeNull();
  });

  it("returns null for other messages", () => {
    expect(parseBotSetupMessage("")).toBeNull();
    expect(parseBotSetupMessage("Fix the login bug please")).toBeNull();
    expect(
      parseBotSetupMessage("You are Rex, a long-lived teammate in this thread.\nNo role here"),
    ).toBeNull();
  });
});

describe("bot voice", () => {
  it("tells every bot to talk like a chat teammate, and still ends with the ready line", () => {
    const message = buildBotSetupMessage({ name: "Nova", role: "Plan things." });
    for (const line of BOT_VOICE_LINES) expect(message).toContain(line);
    expect(message.split("\n").at(-1)).toBe(
      "Reply with one short sentence that confirms you are ready as Nova.",
    );
  });
});

describe("bot-to-bot header", () => {
  it("tells every bot to sign messages it sends to other threads, and still round-trips", () => {
    const message = buildBotSetupMessage({
      name: "Rex",
      role: "Code things.\nAnd test.",
      emoji: "R",
    });
    const lines = message.split("\n");
    const rule = lines.find((line) => line.includes('"From Rex (thread <your thread id>):"'));
    expect(rule).toContain("t3_thread_send");
    expect(rule).toContain("t3_thread_list (currentThreadId)");
    expect(lines.indexOf(rule!)).toBeLessThan(lines.indexOf(BOT_VOICE_LINES[0]));
    expect(lines.at(-1)).toBe("Reply with one short sentence that confirms you are ready as Rex.");
    expect(parseBotSetupMessage(message)).toStrictEqual({
      name: "Rex",
      role: "Code things.\nAnd test.",
      emoji: "R",
    });
  });
});

describe("buildTeamTimeline agent messages", () => {
  const message = (id: string, text: string, minute: number, senderThreadId?: string) => ({
    id,
    role: "user" as const,
    text,
    createdAt: `2026-10-27T10:0${minute}:00.000Z`,
    streaming: false,
    ...(senderThreadId ? { senderThreadId } : {}),
  });

  it("shows a signed user-role message as the agent's, not the user's", () => {
    const timeline = buildTeamTimeline({
      hiddenMessageIds: [],
      sources: [
        {
          bot: coder,
          messages: [
            message("a", "From T3 Manager (thread thread-m):\nUpdate **done**.", 0),
            message("b", "From Lead (thread thread-lead):\nPlease fix login", 1, lead.threadId),
            message("c", "From a friend, hi", 2),
          ],
        },
      ],
      senders: [lead],
    });
    expect(
      timeline.map((entry) => [entry.kind, entry.from, entry.to, entry.text, entry.fromThreadId]),
    ).toStrictEqual([
      ["agent", "T3 Manager", "Coder", "Update **done**.", "thread-m"],
      ["handoff", "Lead", "Coder", "Please fix login", undefined],
      ["user", "You", "Coder", "From a friend, hi", undefined],
    ]);
  });
});

describe("bot memory", () => {
  it("tells the main chat to keep its memory in a file named after its own thread", () => {
    const message = buildBotSetupMessage({ name: "Rex", role: "Code things." });
    expect(message).toContain(`${BOT_MEMORY_DIR}/<your thread id>.md`);
    expect(message).toContain("currentThreadId");
    expect(parseBotSetupMessage(message)).toStrictEqual({ name: "Rex", role: "Code things." });
  });

  it("points an extra thread at the main chat's memory file", () => {
    const opening = buildBotThreadOpening({
      name: "Rex",
      role: "Code things.",
      mainThreadId: "thread-main",
      task: "Fix the build",
    });
    expect(opening).toContain(`${BOT_MEMORY_DIR}/thread-main.md`);
    expect(opening).not.toContain("<your thread id>.md");
    expect(firstTaskFromOpening(opening)).toBe("Fix the build");
  });
});

describe("buildTeamTimeline attachments", () => {
  const photo = {
    type: "image",
    id: "att-1",
    name: "screen.png",
    mimeType: "image/png",
    sizeBytes: 1200,
  };

  it("keeps the photos and files of user messages, also without text", () => {
    const timeline = buildTeamTimeline({
      hiddenMessageIds: [],
      sources: [
        {
          bot: lead,
          messages: [
            {
              id: "m1",
              role: "user",
              text: "",
              createdAt: "2026-10-27T10:01:00.000Z",
              streaming: false,
              attachments: [photo],
            },
            {
              id: "m2",
              role: "user",
              text: "No files",
              createdAt: "2026-10-27T10:02:00.000Z",
              streaming: false,
            },
          ],
        },
      ],
    });
    expect(timeline.map((entry) => [entry.text, entry.attachments])).toStrictEqual([
      [
        "",
        [
          {
            id: "att-1",
            kind: "image",
            name: "screen.png",
            mimeType: "image/png",
            sizeBytes: 1200,
            assetId: "att-1",
          },
        ],
      ],
      ["No files", undefined],
    ]);
  });

  it("keeps the attachments of a new thread's first task", () => {
    const opening = buildBotThreadOpening({
      name: "Lead",
      role: "Leads",
      mainThreadId: "main",
      task: "Look at this",
    });
    const timeline = buildTeamTimeline({
      hiddenMessageIds: [],
      sources: [
        {
          bot: { ...lead, setupMessageId: "open" },
          messages: [
            {
              id: "open",
              role: "user",
              text: opening,
              createdAt: "2026-10-27T10:01:00.000Z",
              streaming: false,
              attachments: [photo],
            },
          ],
        },
      ],
    });
    expect(timeline.map((entry) => [entry.text, entry.attachments?.length])).toStrictEqual([
      ["Look at this", 1],
    ]);
  });
});
