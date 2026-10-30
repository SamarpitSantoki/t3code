import type { ProviderRequestKind } from "@t3tools/contracts";

import type { BotStatus } from "../bots/bot-status-model";
import { formatBotTime } from "../bots/bot-status-model";
import type { BotActivity } from "./bot-activity-model";

export type LiveLineTone = "blue" | "amber" | "red" | "muted";

/** "4 bots · 2 working · 1 needs you"; zero counts are left out. */
export function rosterSummary(
  botCount: number,
  activities: ReadonlyArray<BotActivity | undefined>,
): string {
  const working = activities.filter((activity) => activity?.status.kind === "working").length;
  const needsYou = activities.filter((activity) => activity?.status.kind === "needs_you").length;
  return [
    `${botCount} ${botCount === 1 ? "bot" : "bots"}`,
    working > 0 ? `${working} working` : null,
    needsYou > 0 ? `${needsYou} needs you` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/** The one line under a bot's name: what it is doing, in the colour of its state. */
export function botLiveLine(
  status: BotStatus,
  busyThreads: number,
  fallback: string,
): { readonly tone: LiveLineTone; readonly text: string } {
  const threads = busyThreads > 1 ? ` · ${busyThreads} threads` : "";
  const withPreview = (label: string) => (status.preview ? `${label} · ${status.preview}` : label);
  switch (status.kind) {
    case "working":
      return { tone: "blue", text: withPreview("Working") + threads };
    case "needs_you":
      return { tone: "amber", text: withPreview("Waiting for you") + threads };
    case "error":
      return { tone: "red", text: "Hit an error" + threads };
    case "setting_up":
      return { tone: "muted", text: "Setting up" + threads };
    case "idle":
      return { tone: "muted", text: (status.preview ?? fallback) + threads };
  }
}

/** Working bots read "now", like a live presence. */
export function rowTime(status: BotStatus): string {
  return status.kind === "working" ? "now" : formatBotTime(status.updatedAt);
}

export function approvalAction(input: {
  readonly requestKind: ProviderRequestKind;
  readonly appName?: string;
}): string {
  if (input.appName) return `wants to use ${input.appName}`;
  switch (input.requestKind) {
    case "command":
      return "wants to run a command";
    case "file-read":
      return "wants to read a file";
    case "file-change":
      return "wants to edit files";
    case "mcp-elicitation":
      return "wants to use a tool";
    case "permission":
      return "needs your permission";
  }
}

/** First non-empty line, for one-line previews of commands and questions. */
export function firstLine(text: string | undefined): string | null {
  return (
    text
      ?.split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? null
  );
}

/** Opens the thread that needs the user; otherwise the bot's main chat. */
export function chatTarget(
  bot: { readonly id: string; readonly threadId: string },
  activity: Pick<BotActivity, "status" | "threadId"> | undefined,
): { readonly botId: string; readonly threadId?: string } {
  return activity && activity.status.kind === "needs_you" && activity.threadId !== bot.threadId
    ? { botId: bot.id, threadId: activity.threadId }
    : { botId: bot.id };
}
