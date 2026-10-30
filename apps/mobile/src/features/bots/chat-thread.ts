import type { BotStatusKind } from "./bot-status-model";
import type { Bot } from "./bots-model";

export type ShownChat =
  | { readonly kind: "new"; readonly threadId: null }
  | { readonly kind: "main"; readonly threadId: string }
  | { readonly kind: "side"; readonly threadId: string; readonly title: string };

/** Which of the bot's threads a BotChat route shows. */
export function resolveShownChat(
  bot: Pick<Bot, "threadId" | "threads">,
  params: { readonly threadId?: string | undefined; readonly newThread?: boolean | undefined },
): ShownChat {
  if (params.newThread) return { kind: "new", threadId: null };
  if (!params.threadId || params.threadId === bot.threadId) {
    return { kind: "main", threadId: bot.threadId };
  }
  const thread = bot.threads?.find((candidate) => candidate.threadId === params.threadId);
  return { kind: "side", threadId: params.threadId, title: thread?.title ?? "Thread" };
}

export type ChatStatusTone = "blue" | "amber" | "red" | "muted";

/** The header's status line under the bot's name. */
export function chatStatusLine(kind: BotStatusKind): {
  readonly label: string;
  readonly tone: ChatStatusTone;
} {
  switch (kind) {
    case "working":
      return { label: "Working", tone: "blue" };
    case "needs_you":
      return { label: "Waiting for you", tone: "amber" };
    case "error":
      return { label: "Hit an error", tone: "red" };
    case "setting_up":
      return { label: "Setting up", tone: "muted" };
    case "idle":
      return { label: "Ready", tone: "muted" };
  }
}
