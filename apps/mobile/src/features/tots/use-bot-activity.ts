import { deriveBotStatus } from "../bots/bot-status-model";
import { botThreadIds, type Bot } from "../bots/bots-model";
import { useThreadShells } from "../../state/entities";
import { summarizeBotActivity, type BotActivity } from "./bot-activity-model";

/** One pass over the thread list for every bot, instead of a subscription per thread. */
export function useBotsActivity(bots: ReadonlyArray<Bot>): ReadonlyMap<string, BotActivity> {
  const shells = useThreadShells();
  const byThread = new Map(shells.map((shell) => [`${shell.environmentId}:${shell.id}`, shell]));
  const activity = new Map<string, BotActivity>();
  for (const bot of bots) {
    const summary = summarizeBotActivity(
      botThreadIds(bot).map((threadId) => ({
        threadId,
        status: deriveBotStatus(byThread.get(`${bot.environmentId}:${threadId}`) ?? null),
      })),
    );
    if (summary) activity.set(bot.id, summary);
  }
  return activity;
}

/** Status of one of a bot's threads. */
export function useBotThreadStatus(bot: Pick<Bot, "environmentId">, threadId: string) {
  const shells = useThreadShells();
  return deriveBotStatus(
    shells.find((shell) => shell.environmentId === bot.environmentId && shell.id === threadId) ??
      null,
  );
}
