import { botAccessory } from "../tots/bot-face-model";
import { botIdentity } from "./bot-identity";
import {
  botThreadIds,
  parseBotSetupMessage,
  type Bot,
  type BotRegistry,
  type ParsedBotSetup,
} from "./bots-model";

/** Newest top-level threads checked for a bot setup; older ones are left alone. */
export const SERVER_BOT_CANDIDATE_LIMIT = 40;

export interface ServerBotCandidateShell {
  readonly environmentId: string;
  readonly id: string;
  readonly createdAt: string;
  readonly archivedAt: string | null;
  readonly lineage: {
    readonly parentThreadId: string | null;
    readonly relationshipToParent: string | null;
  };
}

/** The thread's first user message, read once: it never changes. */
export interface ServerBotSetup extends ParsedBotSetup {
  readonly setupMessageId: string;
}

export function serverThreadKey(environmentId: string, threadId: string) {
  return `${environmentId}:${threadId}`;
}

/** Top-level, unarchived threads that no saved bot owns, newest first. */
export function serverBotCandidates<T extends ServerBotCandidateShell>(
  shells: ReadonlyArray<T>,
  registry: BotRegistry,
  limit = SERVER_BOT_CANDIDATE_LIMIT,
): T[] {
  const saved = new Set(
    registry.bots.flatMap((bot) =>
      botThreadIds(bot).map((threadId) => serverThreadKey(bot.environmentId, threadId)),
    ),
  );
  return shells
    .filter(
      (shell) =>
        shell.archivedAt === null &&
        shell.lineage.parentThreadId === null &&
        shell.lineage.relationshipToParent === null &&
        !saved.has(serverThreadKey(shell.environmentId, shell.id)),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

/** The bot a thread's first user message sets up, or null when it is not a bot setup. */
export function serverBotSetup(
  first: { readonly id: string; readonly text: string } | null,
): ServerBotSetup | null {
  if (first === null) return null;
  const parsed = parseBotSetupMessage(first.text);
  return parsed === null ? null : { ...parsed, setupMessageId: first.id };
}

/** Earliest user message by time; ties keep list order. */
export function firstUserMessage<T extends { readonly role: string; readonly createdAt: string }>(
  messages: ReadonlyArray<T>,
): T | null {
  let first: T | null = null;
  for (const message of messages) {
    if (message.role !== "user") continue;
    if (first === null || message.createdAt < first.createdAt) first = message;
  }
  return first;
}

/** A bot found on the server; saving it lists it on this phone. */
export interface ServerBotEntry extends ServerBotSetup {
  readonly environmentId: string;
  readonly threadId: string;
  readonly createdAt: string;
}

/** The registry entry for a server bot, with the identity it was hired with when known. */
export function serverBotToBot(entry: ServerBotEntry, id: string): Bot {
  const identity = botIdentity({
    id,
    ...(entry.emoji ? { emoji: entry.emoji } : {}),
    ...(entry.color ? { color: entry.color } : {}),
  });
  return {
    id,
    name: entry.name,
    role: entry.role,
    environmentId: entry.environmentId,
    threadId: entry.threadId,
    setupMessageId: entry.setupMessageId,
    createdAt: entry.createdAt,
    emoji: identity.emoji,
    color: identity.color,
    // Hired bots wear their template's accessory, so the face matches the one they had.
    accessory: botAccessory({ id: entry.template ?? id }),
  };
}
