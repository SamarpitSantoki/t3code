import type * as DateTime from "effect/DateTime";

import { parseAgentMessage } from "../bots/agent-message";
import { deriveBotStatus, type BotStatus } from "../bots/bot-status-model";
import type { Bot, BotTeam } from "../bots/bots-model";
import { serverBotToBot, type ServerBotEntry } from "../bots/server-bots-model";
import { chatThreadKey, isChatUnread, messageTime, type ChatReads } from "./chat-read-model";
import { cleanPreviewText } from "./chat-preview-model";
import type { LiveLineTone } from "./home-model";

type StatusShell = NonNullable<Parameters<typeof deriveBotStatus>[0]>;

export type ChatShell = Omit<StatusShell, "source"> & {
  readonly environmentId: string;
  readonly id: string;
  readonly archivedAt?: string | null;
  readonly settledOverride?: "settled" | "active" | null;
  readonly pinnedAt?: string | null;
  readonly pinOrderKey?: string | null;
  readonly source: {
    readonly latestVisibleMessage: {
      readonly role: "user" | "assistant" | "system";
      readonly text: string;
      readonly updatedAt?: DateTime.Utc | string;
    } | null;
  };
};

export interface ChatLatestMessage {
  readonly role: string;
  readonly text: string;
  readonly time: number | null;
}

interface ChatRowBase {
  readonly key: string;
  readonly title: string;
  readonly status: BotStatus;
  /** The server thread swipe actions change; teams have none of their own. */
  readonly target: { readonly environmentId: string; readonly threadId: string } | null;
  /** Read state follows the thread whose messages the row previews. */
  readonly readKey: string | null;
  readonly muteKey: string;
  readonly latest: ChatLatestMessage | null;
  readonly pinned: boolean;
  readonly pinOrderKey: string | null;
  readonly settled: boolean;
  readonly hidden: boolean;
  readonly muted: boolean;
  readonly unread: boolean;
  /** The bot named in "<from> → <bot>" previews. */
  readonly speaker: string | null;
  readonly preview: ChatPreview;
}

export type ChatRow =
  | (ChatRowBase & { readonly kind: "bot"; readonly bot: Bot })
  | (ChatRowBase & {
      readonly kind: "thread";
      readonly bot: Bot;
      readonly threadId: string;
      readonly subtitle: string;
    })
  | (ChatRowBase & {
      readonly kind: "team";
      readonly team: BotTeam;
      readonly lead: Bot | null;
      readonly roster: ReadonlyArray<Bot>;
    })
  | (ChatRowBase & {
      readonly kind: "server";
      readonly serverBot: ServerBotEntry & { readonly status: BotStatus };
      /** The face it will have once saved. */
      readonly face: Bot;
    });

export interface ChatPreview {
  readonly tone: LiveLineTone | "talk";
  readonly text: string;
  /** The latest message came from another bot. */
  readonly botTalk: boolean;
}

type DraftRow = ChatRow extends infer Row
  ? Row extends ChatRow
    ? Omit<Row, "muted" | "unread" | "preview">
    : never
  : never;

/** Every conversation in Tots, newest activity first; rows without a time go last. */
export function buildChatRows(input: {
  readonly bots: ReadonlyArray<Bot>;
  readonly teams: ReadonlyArray<BotTeam>;
  readonly shells: ReadonlyArray<ChatShell>;
  readonly serverBots?: ReadonlyArray<ServerBotEntry & { readonly status: BotStatus }>;
  /** Threads the server keeps archived, which leave its shell list. */
  readonly archivedKeys?: ReadonlySet<string>;
  readonly reads?: ChatReads;
  readonly muted?: ReadonlyArray<string>;
}): ReadonlyArray<ChatRow> {
  const byThread = new Map(
    input.shells.map((shell) => [chatThreadKey(shell.environmentId, shell.id), shell]),
  );
  const threadFacts = (environmentId: string, threadId: string) => {
    const key = chatThreadKey(environmentId, threadId);
    const shell = byThread.get(key) ?? null;
    const latest = shell?.source.latestVisibleMessage ?? null;
    return {
      target: { environmentId, threadId },
      readKey: key,
      muteKey: key,
      status: deriveBotStatus(shell),
      latest: latest && {
        role: latest.role,
        text: latest.text,
        time: messageTime(latest.updatedAt),
      },
      pinned: shell?.pinnedAt != null,
      pinOrderKey: shell?.pinOrderKey ?? null,
      settled: shell?.settledOverride === "settled",
      hidden: shell?.archivedAt != null || (input.archivedKeys?.has(key) ?? false),
    };
  };

  const drafts: DraftRow[] = input.bots.flatMap((bot): DraftRow[] => [
    {
      kind: "bot",
      key: `bot:${bot.id}`,
      bot,
      title: bot.name,
      speaker: bot.name,
      ...threadFacts(bot.environmentId, bot.threadId),
    },
    ...(bot.threads ?? []).map((thread): DraftRow => ({
      kind: "thread",
      key: `thread:${bot.id}:${thread.threadId}`,
      bot,
      threadId: thread.threadId,
      title: thread.title,
      subtitle: `with ${bot.name}`,
      speaker: bot.name,
      ...threadFacts(bot.environmentId, thread.threadId),
    })),
  ]);

  for (const serverBot of input.serverBots ?? []) {
    const facts = threadFacts(serverBot.environmentId, serverBot.threadId);
    drafts.push({
      kind: "server",
      key: `server:${facts.readKey}`,
      serverBot,
      face: serverBotToBot(serverBot, serverBot.threadId),
      title: serverBot.name,
      speaker: serverBot.name,
      ...facts,
      status: serverBot.status,
    });
  }

  for (const team of input.teams) {
    const lead = input.bots.find((bot) => bot.id === team.leadBotId) ?? null;
    const roster = [team.leadBotId, ...team.memberBotIds]
      .filter((id, index, ids) => ids.indexOf(id) === index)
      .flatMap((id) => input.bots.filter((bot) => bot.id === id));
    const facts = lead ? threadFacts(lead.environmentId, lead.threadId) : null;
    drafts.push({
      kind: "team",
      key: `team:${team.id}`,
      team,
      lead,
      roster,
      title: team.name,
      speaker: lead?.name ?? null,
      target: null,
      readKey: facts?.readKey ?? null,
      muteKey: `team:${team.id}`,
      status: facts?.status ?? deriveBotStatus(null),
      latest: facts?.latest ?? null,
      // The lead's own row carries its thread's pin and settle.
      pinned: false,
      pinOrderKey: null,
      settled: false,
      hidden: false,
    });
  }

  const muted = new Set(input.muted ?? []);
  const rows = drafts.map((draft): ChatRow => {
    const isMuted = muted.has(draft.muteKey);
    return {
      ...draft,
      muted: isMuted,
      unread:
        draft.readKey !== null &&
        isChatUnread({
          latest: draft.latest,
          readAt: input.reads?.[draft.readKey],
          muted: isMuted,
        }),
      preview:
        draft.kind === "team" && draft.lead === null
          ? { tone: "muted", text: "Lead was removed", botTalk: false }
          : chatPreviewLine(draft.status, draft.latest, {
              bot: draft.speaker ?? draft.title,
              speaker: draft.kind === "team" ? (draft.lead?.name ?? undefined) : undefined,
            }),
    } as ChatRow;
  });

  return rows
    .map((row, index) => ({ row, index, time: timeOf(row.status.updatedAt) }))
    .sort((a, b) => {
      if (a.time === null && b.time === null) return a.index - b.index;
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return b.time - a.time || a.index - b.index;
    })
    .map(({ row }) => row);
}

function timeOf(iso: string | null): number | null {
  if (iso === null) return null;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * The line under a conversation's title. `bot` is the chat's bot, named in bot talk;
 * `speaker` names the bot in team rows.
 */
export function chatPreviewLine(
  status: BotStatus,
  latest: Pick<ChatLatestMessage, "role" | "text"> | null,
  names: { readonly bot: string; readonly speaker?: string | undefined },
): ChatPreview {
  if (status.kind === "needs_you")
    return { tone: "amber", text: "Waiting for you", botTalk: false };
  if (status.kind === "error") return { tone: "red", text: "Hit an error", botTalk: false };
  const text = latest === null ? "" : cleanPreviewText(latest.text);
  if (latest === null || text.length === 0) {
    return status.kind === "setting_up"
      ? { tone: "muted", text: "Setting up", botTalk: false }
      : status.kind === "working"
        ? { tone: "blue", text: "Working", botTalk: false }
        : { tone: "muted", text: "No messages yet", botTalk: false };
  }
  const agent = latest.role === "user" ? parseAgentMessage(latest.text) : null;
  if (agent !== null) {
    const body = cleanPreviewText(agent.body);
    return {
      tone: "talk",
      text: `${agent.fromName} → ${names.bot}${body ? `: ${body}` : ""}`,
      botTalk: true,
    };
  }
  const who = latest.role === "assistant" ? names.speaker : "You";
  return {
    tone: status.kind === "working" ? "blue" : "muted",
    text: who ? `${who}: ${text}` : text,
    botTalk: false,
  };
}

export interface ArrangedChats {
  readonly main: ReadonlyArray<ChatRow>;
  readonly settled: ReadonlyArray<ChatRow>;
  readonly hidden: ReadonlyArray<ChatRow>;
}

/** Pinned chats lead the main list; settled and hidden chats get their own sections. */
export function arrangeChatRows(rows: ReadonlyArray<ChatRow>, query = ""): ArrangedChats {
  const shown = rows.filter((row) => chatMatchesSearch(row, query));
  const main = shown.filter((row) => !row.hidden && !row.settled);
  const pinned = main
    .filter((row) => row.pinned)
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const left = a.row.pinOrderKey;
      const right = b.row.pinOrderKey;
      if (left !== null && right !== null && left !== right) return left < right ? -1 : 1;
      if (left !== right) return left === null ? 1 : -1;
      return a.index - b.index;
    })
    .map(({ row }) => row);
  return {
    main: [...pinned, ...main.filter((row) => !row.pinned)],
    settled: shown.filter((row) => !row.hidden && row.settled),
    hidden: shown.filter((row) => row.hidden),
  };
}

/** Case-insensitive match on the title, the bots in it and the preview. */
export function chatMatchesSearch(row: ChatRow, query: string): boolean {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const names =
    row.kind === "team"
      ? row.roster.map((bot) => bot.name)
      : row.kind === "server"
        ? [row.serverBot.name]
        : [row.bot.name];
  const haystack = [row.title, ...names, row.preview.text].join(" ").toLocaleLowerCase();
  return words.every((word) => haystack.includes(word));
}
