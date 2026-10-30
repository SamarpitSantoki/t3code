import { botThreadIds, type Bot } from "./bots-model";

type SenderBot = Pick<Bot, "id" | "name" | "threadId" | "threads">;

export interface AgentSenderMatch<T extends SenderBot> {
  readonly bot: T;
  /** The sender's thread when it is one of the bot's threads; null when only the name matched. */
  readonly threadId: string | null;
}

/** The saved bot that sent a bot-to-bot message: by thread id first, then by name. */
export function findAgentSender<T extends SenderBot>(
  bots: ReadonlyArray<T>,
  sender: { readonly fromName: string; readonly fromThreadId?: string | undefined },
): AgentSenderMatch<T> | null {
  if (sender.fromThreadId !== undefined) {
    const threadId = sender.fromThreadId;
    const byThread = bots.find((bot) => botThreadIds(bot).includes(threadId));
    if (byThread) return { bot: byThread, threadId };
  }
  const name = sender.fromName.trim().toLowerCase();
  if (name.length === 0) return null;
  const byName = bots.find((bot) => bot.name.trim().toLowerCase() === name);
  return byName ? { bot: byName, threadId: null } : null;
}

/** "T3 Manager → Tot". */
export function agentTalkLabel(from: string, to: string | null) {
  return to ? `${from} → ${to}` : from;
}
