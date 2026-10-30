import type { OrchestrationV2ProjectedTurnItem } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

import { formatAgentMessageHeader, parseAgentMessage } from "./agent-message";
import { T3_MANAGER_THREAD_TITLE } from "./bot-identity";
import {
  entryAttachmentsFromMessage,
  type ChatEntryAttachment,
  type MessageAttachmentFields,
} from "./chat-attachments";
import {
  botChatCardCreatedAt,
  botChatCardKind,
  botChatCardText,
  type BotChatCard,
} from "./chat-request-items";

/** A fresh conversation with the same bot, beside its continuous main chat. */
export const BotThread = Schema.Struct({
  threadId: Schema.String,
  title: Schema.String,
  setupMessageId: Schema.String,
  createdAt: Schema.String,
});
export type BotThread = typeof BotThread.Type;

export const Bot = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  role: Schema.String,
  environmentId: Schema.String,
  threadId: Schema.String,
  setupMessageId: Schema.String,
  createdAt: Schema.String,
  emoji: Schema.optional(Schema.String),
  color: Schema.optional(Schema.String),
  accessory: Schema.optional(Schema.String),
  threads: Schema.optional(Schema.Array(BotThread)),
});
export type Bot = typeof Bot.Type;

export const BotTeam = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  environmentId: Schema.String,
  leadBotId: Schema.String,
  memberBotIds: Schema.Array(Schema.String),
  /** Roster briefs sent to the lead; hidden from the team timeline like each bot's setup. */
  briefMessageIds: Schema.Array(Schema.String),
  createdAt: Schema.String,
});
export type BotTeam = typeof BotTeam.Type;

export const BotRegistry = Schema.Struct({
  bots: Schema.Array(Bot),
  teams: Schema.Array(BotTeam),
});
export type BotRegistry = typeof BotRegistry.Type;

export const EMPTY_BOT_REGISTRY: BotRegistry = { bots: [], teams: [] };

export const isBotRegistry = Schema.is(BotRegistry);

/** Identity saved beside the setup, so the server alone can tell which bots exist. */
export interface BotSetupMetadata {
  readonly emoji?: string | undefined;
  readonly color?: string | undefined;
  readonly template?: string | undefined;
}

const SETUP_FIRST_LINE = /^You are (.+), a long-lived teammate in this thread\.$/;
const SETUP_METADATA_PREFIX = "Tots bot: ";
const THREAD_OPENING_LINE =
  "This is a new thread with a fresh start. Earlier threads are not in this conversation.";

function setupMetadataLine(input: BotSetupMetadata) {
  const metadata = {
    v: 1,
    ...(input.emoji ? { emoji: input.emoji } : {}),
    ...(input.color ? { color: input.color } : {}),
    ...(input.template ? { template: input.template } : {}),
  };
  return `${SETUP_METADATA_PREFIX}${JSON.stringify(metadata)}`;
}

/** Where bots keep notes that every thread with the same bot shares. */
export const BOT_MEMORY_DIR = "~/.tots/memory";

/**
 * Each T3 thread runs in its own folder, so a bot's notes live in one file on the server, named
 * after the bot's main chat thread. The main chat does not know its id yet; extra threads do.
 */
export function botMemoryLines(mainThreadId?: string) {
  const file = `${BOT_MEMORY_DIR}/${mainThreadId ?? "<your thread id>"}.md`;
  return [
    "Your memory:",
    `- Your memory file is ${file}. It is shared by every thread with you, so it is how you remember across threads.${mainThreadId ? "" : " Find your own thread id with t3_thread_list (currentThreadId)."}`,
    "- Read it before your first reply. If it does not exist yet, create it.",
    "- When you learn something that should last, update it right away: the user's preferences, decisions, facts about ongoing work, and what you finished. Keep it short, and remove what is no longer true.",
    "- Do not put secrets, passwords or keys in it.",
    '- When the user asks "what do you remember?", answer from this file.',
  ];
}

/** Bots talk like a teammate in a chat app, not like a coding agent in a terminal. */
export const BOT_VOICE_LINES = [
  "How you talk to the user:",
  "- You are in a chat app on the user's phone. Write like a sharp teammate texting back, not like a coding tool printing a report.",
  "- Lead with the answer or the result in the first sentence. Most replies are 1 to 4 short sentences.",
  "- Talk about outcomes, not steps. Do not narrate what you are reading or running. Before long work, send one short line, like \"On it, I'll ping you when it's done.\"",
  "- No headers, tables, or long bullet lists unless the user asks. Use a short list only for 3 or more separate items.",
  '- No file paths, commands, ids, or code unless the user asks for them or needs them to act. Offer them instead: "Want the details?"',
  '- Be warm and direct, with a little personality that fits your name. No filler, no apologies, no "Great question".',
  "- When something needs the user, say exactly what you need in one line. Ask one question at a time, and offer 2 or 3 clear choices when you can.",
  "- End with the next step you suggest when there is one, so the user can reply with one word.",
  "- When the message is from another agent, not the user, skip this style: answer that agent with exact, complete facts.",
] as const;

export function buildBotSetupMessage(
  input: {
    readonly name: string;
    readonly role: string;
    /** Set for a bot's extra threads, so they share the main chat's memory file. */
    readonly mainThreadId?: string | undefined;
  } & BotSetupMetadata,
) {
  return [
    `You are ${input.name}, a long-lived teammate in this thread.`,
    setupMetadataLine(input),
    "",
    "Your role:",
    input.role.trim(),
    "",
    "Stay in this role for every later message. Keep what you learn about the user's preferences and earlier work in mind.",
    "Before you send messages, publish, delete data, spend money, or change production systems, ask the user and wait for approval.",
    "Messages from other T3 threads are from your teammates. Do the work they hand you and reply in this thread with a short summary of the result.",
    `For anything about T3 itself, ask the "${T3_MANAGER_THREAD_TITLE}" thread if it exists (find it with t3_thread_list, titleContains "${T3_MANAGER_THREAD_TITLE}"). Send your question with t3_thread_send and include your own thread id so it can reply to you.`,
    `When you send a message to another bot or thread with t3_thread_send, start it with "${formatAgentMessageHeader({ name: input.name, threadId: "<your thread id>" })}" on its own line. Find your own thread id with t3_thread_list (currentThreadId).`,
    "",
    ...botMemoryLines(input.mainThreadId),
    "",
    ...BOT_VOICE_LINES,
    "",
    `Reply with one short sentence that confirms you are ready as ${input.name}.`,
  ].join("\n");
}

export interface ParsedBotSetup extends BotSetupMetadata {
  readonly name: string;
  readonly role: string;
}

function parseSetupMetadata(line: string | undefined): BotSetupMetadata {
  if (line === undefined || !line.startsWith(SETUP_METADATA_PREFIX)) return {};
  let value: unknown;
  try {
    value = JSON.parse(line.slice(SETUP_METADATA_PREFIX.length));
  } catch {
    return {};
  }
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  const text = (key: string) => {
    const field = record[key];
    return typeof field === "string" && field.length > 0 ? { [key]: field } : {};
  };
  return { ...text("emoji"), ...text("color"), ...text("template") };
}

/**
 * Reads a bot's setup message back into its name, role and identity. Returns null for anything
 * else, including the opening of a bot's extra thread: that thread belongs to an existing bot.
 */
export function parseBotSetupMessage(text: string): ParsedBotSetup | null {
  if (text.includes(FIRST_TASK_MARKER) || text.includes(THREAD_OPENING_LINE)) return null;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const name = SETUP_FIRST_LINE.exec(lines[0]?.trim() ?? "")?.[1]?.trim();
  if (!name) return null;
  const roleStart = lines.indexOf("Your role:");
  if (roleStart === -1) return null;
  const stayIndex = lines.findIndex(
    (line, index) => index > roleStart && line.startsWith("Stay in this role"),
  );
  const roleLines = lines.slice(roleStart + 1, stayIndex === -1 ? undefined : stayIndex);
  const role = roleLines.join("\n").trim();
  if (stayIndex === -1 || role.length === 0) return null;
  return { name, role, ...parseSetupMetadata(lines[1]) };
}

/** Separates the bot's setup from the user's first task when both open a new thread. */
export const FIRST_TASK_MARKER = "\n\nFirst task from the user:\n";

export function buildBotThreadOpening(input: {
  readonly name: string;
  readonly role: string;
  readonly mainThreadId: string;
  readonly task: string;
}) {
  return (
    [buildBotSetupMessage(input).split("\n").slice(0, -1).join("\n"), THREAD_OPENING_LINE].join(
      "\n",
    ) +
    FIRST_TASK_MARKER +
    input.task.trim()
  );
}

/** The user's task from an opening message, or null when the message is setup only. */
export function firstTaskFromOpening(text: string): string | null {
  const index = text.indexOf(FIRST_TASK_MARKER);
  return index === -1 ? null : text.slice(index + FIRST_TASK_MARKER.length).trim() || null;
}

export function addBotThread(registry: BotRegistry, botId: string, thread: BotThread): BotRegistry {
  return {
    ...registry,
    bots: registry.bots.map((bot) =>
      bot.id === botId ? { ...bot, threads: [thread, ...(bot.threads ?? [])] } : bot,
    ),
  };
}

export function removeBotThread(
  registry: BotRegistry,
  botId: string,
  threadId: string,
): BotRegistry {
  return {
    ...registry,
    bots: registry.bots.map((bot) =>
      bot.id === botId
        ? { ...bot, threads: (bot.threads ?? []).filter((thread) => thread.threadId !== threadId) }
        : bot,
    ),
  };
}

/** Every thread a bot owns, main chat first. */
export function botThreadIds(bot: Pick<Bot, "threadId" | "threads">) {
  return [bot.threadId, ...(bot.threads ?? []).map((thread) => thread.threadId)];
}

export function buildTeamBriefMessage(input: {
  readonly teamName: string;
  readonly lead: Pick<Bot, "name">;
  readonly members: ReadonlyArray<Pick<Bot, "name" | "role" | "threadId">>;
}) {
  return [
    `You now lead the team "${input.teamName}". The user talks to the team through you.`,
    "",
    "Teammates:",
    ...input.members.map(
      (member) => `- ${member.name} (thread ${member.threadId}): ${firstLine(member.role)}`,
    ),
    "",
    "When the user asks for work:",
    "1. Split it into tasks and pick the teammate whose role fits each task. Do small tasks yourself.",
    "2. Hand a task to a teammate with t3_thread_send, using their thread id. Name the expected result.",
    "3. Wait for results with t3_thread_wait, and read them with t3_thread_read. Teammates can work in parallel.",
    "4. Reply to the user with the combined result and say which teammate did what.",
    "If a teammate is blocked or asks a question only the user can answer, tell the user.",
    `Reply with one short sentence that confirms you lead ${input.lead.name}'s team.`,
  ].join("\n");
}

function firstLine(text: string) {
  return text.trim().split("\n")[0] ?? "";
}

/** A leading `@Name` sends the message to that teammate instead of the lead. */
export function resolveTeamMessageTarget<T extends Pick<Bot, "id" | "name">>(input: {
  readonly text: string;
  readonly lead: T;
  readonly members: ReadonlyArray<T>;
}): { readonly bot: T; readonly text: string } {
  const text = input.text.trim();
  if (!text.startsWith("@")) return { bot: input.lead, text };
  const lower = text.slice(1).toLowerCase();
  const match = [input.lead, ...input.members]
    .sort((left, right) => right.name.length - left.name.length)
    .find((bot) => {
      const name = bot.name.toLowerCase();
      if (!lower.startsWith(name)) return false;
      const next = lower.charAt(name.length);
      return next === "" || /[\s,:]/.test(next);
    });
  if (!match) return { bot: input.lead, text };
  const rest = text
    .slice(1 + match.name.length)
    .replace(/^[\s,:]+/, "")
    .trim();
  return { bot: match, text: rest.length > 0 ? rest : text };
}

export interface TeamMessageSource {
  readonly bot: Pick<Bot, "id" | "name" | "threadId" | "setupMessageId"> &
    Partial<Pick<Bot, "environmentId">>;
  /** Turn items the thread feed shows as cards, such as secret and link requests. */
  readonly cardItems?: ReadonlyArray<OrchestrationV2ProjectedTurnItem>;
  readonly messages: ReadonlyArray<{
    readonly id: string;
    readonly role: "user" | "assistant" | "system";
    readonly text: string;
    readonly createdAt: string;
    readonly streaming: boolean;
    readonly senderThreadId?: string | undefined;
    readonly attachments?: ReadonlyArray<MessageAttachmentFields> | undefined;
  }>;
}

export interface TeamTimelineEntry {
  readonly id: string;
  /**
   * "agent": another bot wrote it with a `From <Name> (thread <id>):` header, not the user.
   * "card": a turn item the user can act on, such as a secret or link request.
   */
  readonly kind: "user" | "handoff" | "agent" | "bot" | "card";
  /** Who wrote it: "You" or a bot name. */
  readonly from: string;
  /** The bot that received it, for user and handoff entries. */
  readonly to: string | null;
  readonly botId: string;
  readonly text: string;
  readonly createdAt: string;
  readonly streaming: boolean;
  /** The sender's thread, from the header of an "agent" entry. */
  readonly fromThreadId?: string;
  /** Sent from this device and not yet echoed by the server. */
  readonly pending?: boolean;
  /** Photos and files the user sent with the message. */
  readonly attachments?: ReadonlyArray<ChatEntryAttachment>;
  /** The turn item behind a "card" entry. */
  readonly card?: BotChatCard;
}

export function buildTeamTimeline(input: {
  readonly sources: ReadonlyArray<TeamMessageSource>;
  readonly hiddenMessageIds: ReadonlyArray<string>;
  /** Bots outside `sources` that may have sent messages, so handoffs keep their names. */
  readonly senders?: ReadonlyArray<Pick<Bot, "threadId" | "name">>;
}): TeamTimelineEntry[] {
  const hidden = new Set(input.hiddenMessageIds);
  const nameByThreadId = new Map<string, Pick<Bot, "name">>([
    ...(input.senders ?? []).map((bot) => [bot.threadId, bot] as const),
    ...input.sources.map((source) => [source.bot.threadId, source.bot] as const),
  ]);
  const entries: TeamTimelineEntry[] = [];
  for (const source of input.sources) {
    for (const projectedItem of source.cardItems ?? []) {
      const kind = botChatCardKind(projectedItem);
      if (kind === null) continue;
      entries.push({
        id: `${source.bot.id}:card:${projectedItem.item.id}`,
        kind: "card",
        from: source.bot.name,
        to: null,
        botId: source.bot.id,
        text: botChatCardText(projectedItem),
        createdAt: botChatCardCreatedAt(projectedItem),
        streaming: projectedItem.item.type === "proposed_plan" && projectedItem.item.streaming,
        card: {
          environmentId: source.bot.environmentId ?? "",
          threadId: source.bot.threadId,
          kind,
          projectedItem,
        },
      });
    }
    for (const message of source.messages) {
      if (message.id === source.bot.setupMessageId) {
        const task = firstTaskFromOpening(message.text);
        if (task !== null) {
          entries.push({
            id: `${source.bot.id}:${message.id}`,
            kind: "user",
            from: "You",
            to: source.bot.name,
            botId: source.bot.id,
            text: task,
            createdAt: message.createdAt,
            streaming: false,
            ...withAttachments(message.attachments),
          });
        }
        continue;
      }
      if (hidden.has(message.id) || message.role === "system") continue;
      if (message.role === "assistant") {
        if (message.text.trim().length === 0) continue;
        entries.push({
          id: `${source.bot.id}:${message.id}`,
          kind: "bot",
          from: source.bot.name,
          to: null,
          botId: source.bot.id,
          text: message.text,
          createdAt: message.createdAt,
          streaming: message.streaming,
        });
        continue;
      }
      const agent = parseAgentMessage(message.text);
      const base = {
        id: `${source.bot.id}:${message.id}`,
        to: source.bot.name,
        botId: source.bot.id,
        createdAt: message.createdAt,
        streaming: false,
      };
      if (message.senderThreadId !== undefined) {
        const sender = nameByThreadId.get(message.senderThreadId);
        entries.push({
          ...base,
          kind: "handoff",
          from: sender?.name ?? agent?.fromName ?? "Another agent",
          text: agent?.body ?? message.text,
        });
      } else if (agent !== null) {
        entries.push({
          ...base,
          kind: "agent",
          from: agent.fromName,
          fromThreadId: agent.fromThreadId,
          text: agent.body,
        });
      } else {
        entries.push({
          ...base,
          kind: "user",
          from: "You",
          text: message.text,
          ...withAttachments(message.attachments),
        });
      }
    }
  }
  return entries.sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  );
}

function withAttachments(attachments: ReadonlyArray<MessageAttachmentFields> | undefined) {
  const shown = entryAttachmentsFromMessage(attachments);
  return shown.length > 0 ? { attachments: shown } : {};
}

export function addBot(registry: BotRegistry, bot: Bot): BotRegistry {
  return { ...registry, bots: [...registry.bots.filter((item) => item.id !== bot.id), bot] };
}

export function addTeam(registry: BotRegistry, team: BotTeam): BotRegistry {
  return { ...registry, teams: [...registry.teams.filter((item) => item.id !== team.id), team] };
}

/** The bot's thread stays in Chats; only the registry entry and the teams it led go. */
export function removeBot(registry: BotRegistry, botId: string): BotRegistry {
  return {
    bots: registry.bots.filter((bot) => bot.id !== botId),
    teams: registry.teams
      .filter((team) => team.leadBotId !== botId)
      .map((team) =>
        team.memberBotIds.includes(botId)
          ? { ...team, memberBotIds: team.memberBotIds.filter((id) => id !== botId) }
          : team,
      ),
  };
}

export function removeTeam(registry: BotRegistry, teamId: string): BotRegistry {
  return { ...registry, teams: registry.teams.filter((team) => team.id !== teamId) };
}

export function recordTeamBrief(
  registry: BotRegistry,
  teamId: string,
  messageId: string,
): BotRegistry {
  return {
    ...registry,
    teams: registry.teams.map((team) =>
      team.id === teamId
        ? { ...team, briefMessageIds: [...team.briefMessageIds, messageId] }
        : team,
    ),
  };
}
