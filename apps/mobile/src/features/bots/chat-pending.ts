import type { TeamTimelineEntry } from "./bots-model";

export interface PendingChatMessage {
  readonly id: string;
  readonly botId: string;
  readonly botName: string;
  readonly text: string;
  readonly createdAt: string;
}

// Device and server clocks differ, so an echo can carry a slightly earlier time.
const CLOCK_SKEW_MS = 60_000;

/**
 * Shows sent messages until the server echoes them back. An echo is the next user entry to
 * the same bot with the same text, so repeated messages each clear one pending copy.
 */
export function mergePendingMessages(
  entries: ReadonlyArray<TeamTimelineEntry>,
  pending: ReadonlyArray<PendingChatMessage>,
): TeamTimelineEntry[] {
  const claimed = new Set<string>();
  const unresolved = pending.filter((message) => {
    const sentAt = Date.parse(message.createdAt);
    const echo = entries.find(
      (entry) =>
        !claimed.has(entry.id) &&
        entry.kind === "user" &&
        entry.botId === message.botId &&
        entry.text.trim() === message.text.trim() &&
        Date.parse(entry.createdAt) >= sentAt - CLOCK_SKEW_MS,
    );
    if (echo) claimed.add(echo.id);
    return !echo;
  });
  if (unresolved.length === 0) return [...entries];
  return [
    ...entries,
    ...unresolved.map((message): TeamTimelineEntry => ({
      id: `pending:${message.id}`,
      kind: "user",
      from: "You",
      to: message.botName,
      botId: message.botId,
      text: message.text,
      createdAt: message.createdAt,
      streaming: false,
      pending: true,
    })),
  ];
}
